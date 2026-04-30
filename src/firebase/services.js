// src/firebase/services.js
import {
  collection, doc, addDoc, getDoc, getDocs,
  setDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from './config.js';

const safeDeleteStorageObject = async (path) => {
  if (!path) return;
  try {
    await deleteObject(storageRef(storage, path));
  } catch {
    // ignore (file may not exist / permissions)
  }
};

// ─── AUTH ────────────────────────────────────────────────────────────────────

export const registerUser = async (email, password, displayName, role = 'alumno') => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await setDoc(doc(db, 'usuarios', cred.user.uid), {
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
  const snap = await getDoc(doc(db, 'usuarios', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getAllAlumnos = async () => {
  const q = query(collection(db, 'usuarios'), where('rol', '==', 'alumno'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const eliminarAlumno = (documentId) =>
  deleteDoc(doc(db, 'usuarios', documentId));

export const crearUsuarioSiNoExiste = async (firebaseUser, rol = 'docente') => {
  if (!firebaseUser?.uid) throw new Error('Usuario inválido');
  const existing = await getUserData(firebaseUser.uid);
  if (existing) return existing;
  const nombre = firebaseUser.displayName || firebaseUser.email || 'Usuario';
  await setDoc(doc(db, 'usuarios', firebaseUser.uid), {
    uid: firebaseUser.uid,
    email: firebaseUser.email || null,
    nombre,
    rol,
    creadoEn: serverTimestamp(),
  });
  return await getUserData(firebaseUser.uid);
};

// ─── CURSOS ──────────────────────────────────────────────────────────────────

export const crearCurso = async (datos) => {
  const ref = await addDoc(collection(db, 'cursos'), { ...datos, creadoEn: serverTimestamp() });
  return { id: ref.id };
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

export const buscarCursos = async ({ nombre, docenteNombre, seccion }) => {
  const snap = await getDocs(collection(db, 'cursos'));
  const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return todos.filter(c => {
    const matchNombre = !nombre || c.nombre?.toLowerCase().includes(nombre.toLowerCase());
    const matchDocente = !docenteNombre || c.docenteNombre?.toLowerCase().includes(docenteNombre.toLowerCase());
    const matchSeccion = !seccion || c.seccion?.toLowerCase().includes(seccion.toLowerCase());
    return matchNombre && matchDocente && matchSeccion;
  });
};

export const getCurso = async (id) => {
  const snap = await getDoc(doc(db, 'cursos', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const actualizarCurso = (id, datos) => updateDoc(doc(db, 'cursos', id), datos);
export const eliminarCurso = (id) => deleteDoc(doc(db, 'cursos', id));

// ─── ACTIVIDADES ─────────────────────────────────────────────────────────────

export const crearActividad = async (actividad) => {
  const ref = await addDoc(collection(db, 'actividades'), {
    ...actividad, creadoEn: serverTimestamp(),
  });
  return { id: ref.id };
};

export const getActividadesByCurso = async (cursoId) => {
  const q = query(
    collection(db, 'actividades'),
    where('cursoId', '==', cursoId),
    orderBy('creadoEn', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getActividad = async (id) => {
  const snap = await getDoc(doc(db, 'actividades', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const eliminarActividad = (id) => deleteDoc(doc(db, 'actividades', id));

// ─── MATRÍCULAS ──────────────────────────────────────────────────────────────

export const solicitarMatricula = async (alumnoUid, alumnoNombre, alumnoEmail, cursoId) => {
  const q = query(collection(db, 'matriculas'),
    where('alumnoUid', '==', alumnoUid),
    where('cursoId', '==', cursoId));
  const snap = await getDocs(q);
  if (!snap.empty) {
    return { id: snap.docs[0].id, estado: snap.docs[0].data().estado, yaExiste: true };
  }
  const ref = await addDoc(collection(db, 'matriculas'), {
    alumnoUid, alumnoNombre, alumnoEmail, cursoId,
    estado: 'pendiente', creadoEn: serverTimestamp(),
  });
  return { id: ref.id, estado: 'pendiente', yaExiste: false };
};

export const aprobarMatricula = (matriculaId) =>
  updateDoc(doc(db, 'matriculas', matriculaId), {
    estado: 'aprobado', aprobadoEn: serverTimestamp(),
  });

export const rechazarMatricula = (matriculaId) =>
  updateDoc(doc(db, 'matriculas', matriculaId), { estado: 'rechazado' });

export const eliminarMatricula = (matriculaId) =>
  deleteDoc(doc(db, 'matriculas', matriculaId));

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

export const eliminarRubrica = (id) => deleteDoc(doc(db, 'rubricas', id));

// ─── ENTREGAS ────────────────────────────────────────────────────────────────

export const crearEntrega = async (entrega) => {
  const ref = await addDoc(collection(db, 'entregas'), { ...entrega, creadoEn: serverTimestamp() });
  return { id: ref.id };
};

export const subirPdfEntrega = async ({ file, entregaId, alumnoUid, cursoId }) => {
  if (!file || !entregaId || !alumnoUid || !cursoId) throw new Error('Faltan datos para subir el PDF');
  const path = `entregas/${cursoId}/${alumnoUid}/${entregaId}/${Date.now()}_${file.name}`;
  const objRef = storageRef(storage, path);
  await uploadBytes(objRef, file, { contentType: file.type || 'application/pdf' });
  const url = await getDownloadURL(objRef);
  return {
    archivoUrl: url,
    archivoPath: path,
    archivoNombre: file.name,
    archivoMime: file.type || 'application/pdf',
    archivoSize: file.size || null,
  };
};

export const eliminarArchivoEntrega = (archivoPath) => safeDeleteStorageObject(archivoPath);

export const actualizarEntregaAlumno = (id, datos) =>
  updateDoc(doc(db, 'entregas', id), { ...datos, actualizadoEn: serverTimestamp() });

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

// Todas las entregas para el dashboard del docente
export const getTodasEntregas = async () => {
  const snap = await getDocs(
    query(collection(db, 'entregas'), orderBy('creadoEn', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const actualizarEntrega = (id, datos) =>
  updateDoc(doc(db, 'entregas', id), { ...datos, evaluadoEn: serverTimestamp() });

export const eliminarEntrega = async (id) => {
  const snap = await getDoc(doc(db, 'entregas', id));
  const data = snap.exists() ? snap.data() : null;
  await deleteDoc(doc(db, 'entregas', id));
  if (data?.archivoPath) await safeDeleteStorageObject(data.archivoPath);
};

// ─── EVALUACIONES (legado) ───────────────────────────────────────────────────

export const guardarEvaluacion = (evaluacion) =>
  addDoc(collection(db, 'evaluaciones'), { ...evaluacion, creadoEn: serverTimestamp() });

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

export const eliminarEvaluacion = (id) => deleteDoc(doc(db, 'evaluaciones', id));

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