// src/firebase/services.js
import {
  collection, doc, addDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp
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

// ─── CURSOS ──────────────────────────────────────────────────────────────────

const generarCodigo = () => {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '0123456789';
  const parte1 = Array.from({length: 4}, () => letras[Math.floor(Math.random()*letras.length)]).join('');
  const parte2 = Array.from({length: 4}, () => nums[Math.floor(Math.random()*nums.length)]).join('');
  return `${parte1}-${parte2}`;
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

export const matricularAlumno = async (alumnoUid, alumnoNombre, cursoId) => {
  // Verificar si ya está matriculado
  const q = query(collection(db, 'matriculas'),
    where('alumnoUid', '==', alumnoUid),
    where('cursoId', '==', cursoId));
  const snap = await getDocs(q);
  if (!snap.empty) return { id: snap.docs[0].id, yaExiste: true };

  const ref = await addDoc(collection(db, 'matriculas'), {
    alumnoUid,
    alumnoNombre,
    cursoId,
    estado: 'activo',
    creadoEn: serverTimestamp(),
  });
  return { id: ref.id, yaExiste: false };
};

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
  const snap = await getDocs(query(collection(db, 'evaluaciones'), orderBy('creadoEn', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ─── PONDERADO FINAL ─────────────────────────────────────────────────────────

export const calcularNotaFinal = (entregas, tiposEvaluacion) => {
  // tiposEvaluacion: [{nombre, peso}]  — los pesos deben sumar 100
  let notaFinal = 0;
  let pesoUsado = 0;

  for (const tipo of tiposEvaluacion) {
    const entregasTipo = entregas.filter(e =>
      e.tipoEvaluacion === tipo.nombre && e.estado === 'evaluado'
    );
    if (entregasTipo.length === 0) continue;

    const promTipo = entregasTipo.reduce((s, e) => s + (e.notaFinal || 0), 0) / entregasTipo.length;
    notaFinal += promTipo * (tipo.peso / 100);
    pesoUsado += tipo.peso;
  }

  // Si no hay entregas en todos los tipos, ajusta proporcional
  if (pesoUsado === 0) return null;
  if (pesoUsado < 100) notaFinal = notaFinal * (100 / pesoUsado);

  return Math.round(notaFinal * 10) / 10;
};
export const getAllAlumnos = async () => {
  const q = query(collection(db, 'usuarios'), where('rol', '==', 'alumno'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};