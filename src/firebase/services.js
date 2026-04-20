// src/firebase/services.js
import {
  collection, doc, addDoc, getDoc, getDocs,
  updateDoc, query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { db, auth } from './config.js';

// ─── AUTH ────────────────────────────────────────────────────────────────────

export const registerUser = async (email, password, displayName, role = 'alumno') => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await addDoc(collection(db, 'usuarios'), {
    uid: cred.user.uid,
    email,
    nombre: displayName,
    rol: role,
    creadoEn: serverTimestamp(),
  });
  return cred.user;
};

export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const logoutUser = () => signOut(auth);

export const getUserData = async (uid) => {
  const q = query(collection(db, 'usuarios'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

export const getAllAlumnos = async () => {
  const q = query(collection(db, 'usuarios'), where('rol', '==', 'alumno'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ─── CURSOS ──────────────────────────────────────────────────────────────────

const generarCodigo = () => {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '0123456789';
  const p1 = Array.from({length: 4}, () => letras[Math.floor(Math.random()*letras.length)]).join('');
  const p2 = Array.from({length: 4}, () => nums[Math.floor(Math.random()*nums.length)]).join('');
  return `${p1}-${p2}`;
};

export const crearCurso = async (datos) => {
  const codigo = generarCodigo();
  const ref = await addDoc(collection(db, 'cursos'), {
    ...datos,
    codigo,
    creadoEn: serverTimestamp(),
  });
  return { id: ref.id, codigo };
};

export const getCursos = async () => {
  const snap = await getDocs(collection(db, 'cursos'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getCursosByDocente = async (docenteUid) => {
  const q = query(collection(db, 'cursos'), where('docenteUid', '==', docenteUid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getCursoByCodigo = async (codigo) => {
  const q = query(collection(db, 'cursos'), where('codigo', '==', codigo.toUpperCase()));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

export const getCurso = async (id) => {
  const snap = await getDoc(doc(db, 'cursos', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const actualizarCurso = (id, datos) =>
  updateDoc(doc(db, 'cursos', id), datos);

// ─── MATRÍCULAS ──────────────────────────────────────────────────────────────

export const solicitarMatricula = async (alumnoUid, alumnoNombre, alumnoEmail, cursoId) => {
  // Verificar si ya existe solicitud
  const q = query(collection(db, 'matriculas'),
    where('alumnoUid', '==', alumnoUid),
    where('cursoId', '==', cursoId));
  const snap = await getDocs(q);
  if (!snap.empty) {
    return { id: snap.docs[0].id, estado: snap.docs[0].data().estado, yaExiste: true };
  }
  const ref = await addDoc(collection(db, 'matriculas'), {
    alumnoUid,
    alumnoNombre,
    alumnoEmail,
    cursoId,
    estado: 'pendiente', // pendiente | aprobado | rechazado
    creadoEn: serverTimestamp(),
  });
  return { id: ref.id, estado: 'pendiente', yaExiste: false };
};

export const aprobarMatricula = (matriculaId) =>
  updateDoc(doc(db, 'matriculas', matriculaId), {
    estado: 'aprobado',
    aprobadoEn: serverTimestamp(),
  });

export const rechazarMatricula = (matriculaId) =>
  updateDoc(doc(db, 'matriculas', matriculaId), {
    estado: 'rechazado',
  });

export const getMatriculasByAlumno = async (alumnoUid) => {
  const q = query(collection(db, 'matriculas'), where('alumnoUid', '==', alumnoUid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getMatriculasByCurso = async (cursoId) => {
  const q = query(collection(db, 'matriculas'), where('cursoId', '==', cursoId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getPendientesByCurso = async (cursoId) => {
  const q = query(collection(db, 'matriculas'),
    where('cursoId', '==', cursoId),
    where('estado', '==', 'pendiente'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ─── RUBRICAS ────────────────────────────────────────────────────────────────

export const guardarRubrica = (rubrica) =>
  addDoc(collection(db, 'rubricas'), { ...rubrica, creadoEn: serverTimestamp() });

export const getRubricas = async (cursoId) => {
  const q = cursoId
    ? query(collection(db, 'rubricas'), where('cursoId', '==', cursoId))
    : query(collection(db, 'rubricas'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getRubrica = async (id) => {
  const snap = await getDoc(doc(db, 'rubricas', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// ─── ENTREGAS ────────────────────────────────────────────────────────────────

export const crearEntrega = (entrega) =>
  addDoc(collection(db, 'entregas'), {
    ...entrega,
    estado: 'pendiente',
    creadoEn: serverTimestamp(),
  });

export const getEntregasByAlumnoYCurso = async (alumnoUid, cursoId) => {
  const q = query(collection(db, 'entregas'),
    where('alumnoUid', '==', alumnoUid),
    where('cursoId', '==', cursoId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getEntregasByCurso = async (cursoId) => {
  const q = query(collection(db, 'entregas'), where('cursoId', '==', cursoId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const actualizarEntrega = (id, datos) =>
  updateDoc(doc(db, 'entregas', id), { ...datos, evaluadoEn: serverTimestamp() });

// ─── EVALUACIONES (legado) ───────────────────────────────────────────────────

export const guardarEvaluacion = (evaluacion) =>
  addDoc(collection(db, 'evaluaciones'), {
    ...evaluacion,
    creadoEn: serverTimestamp(),
  });

export const getEvaluacionesByAlumno = async (alumnoUid) => {
  const q = query(
    collection(db, 'evaluaciones'),
    where('alumnoUid', '==', alumnoUid),
    orderBy('creadoEn', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getTodasEvaluaciones = async () => {
  const snap = await getDocs(collection(db, 'evaluaciones'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ─── PONDERADO FINAL ─────────────────────────────────────────────────────────

export const calcularNotaFinal = (entregas, tiposEvaluacion) => {
  let notaFinal = 0;
  let pesoUsado = 0;
  for (const tipo of tiposEvaluacion) {
    const ents = entregas.filter(e => e.tipoEvaluacion === tipo.nombre && e.estado === 'evaluado');
    if (ents.length === 0) continue;
    const prom = ents.reduce((s, e) => s + (e.notaFinal || 0), 0) / ents.length;
    notaFinal += prom * (tipo.peso / 100);
    pesoUsado += tipo.peso;
  }
  if (pesoUsado === 0) return null;
  if (pesoUsado < 100) notaFinal = notaFinal * (100 / pesoUsado);
  return Math.round(notaFinal * 10) / 10;
};