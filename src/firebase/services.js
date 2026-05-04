// src/firebase/services.js
import {
  collection, doc, addDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  deleteUser,
} from 'firebase/auth';
import { db, auth } from './config.js';

// ─── AUTH ────────────────────────────────────────────────────────────────────

export const registerUser = async (email, password, displayName, role = 'alumno') => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await addDoc(collection(db, 'usuarios'), {
    uid: cred.user.uid, email, nombre: displayName, rol: role, creadoEn: serverTimestamp(),
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

export const eliminarCuentaUsuario = async (uid) => {
  const q = query(collection(db, 'usuarios'), where('uid', '==', uid));
  const snap = await getDocs(q);
  if (!snap.empty) await deleteDoc(doc(db, 'usuarios', snap.docs[0].id));
  if (auth.currentUser && auth.currentUser.uid === uid) {
    await deleteUser(auth.currentUser);
  }
};

export const crearUsuarioSiNoExiste = async (firebaseUser) => {
  const data = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    nombre: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuario',
    rol: 'alumno',
    creadoEn: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'usuarios'), data);
  return { id: ref.id, ...data };
};

export const getAllAlumnos = async () => {
  const q = query(collection(db, 'usuarios'), where('rol', '==', 'alumno'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const eliminarAlumno = (documentId) =>
  deleteDoc(doc(db, 'usuarios', documentId));

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
  const ref = await addDoc(collection(db, 'entregas'), {
    ...entrega, creadoEn: serverTimestamp(),
  });
  return { id: ref.id, ...entrega };
};

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

// ✅ Solo las entregas de los cursos que pertenecen al docente
export const getEntregasByDocente = async (docenteUid) => {
  // 1. Obtener los cursos del docente
  const cursosSnap = await getDocs(
    query(collection(db, 'cursos'), where('docenteUid', '==', docenteUid))
  );
  const cursoIds = cursosSnap.docs.map(d => d.id);
  if (cursoIds.length === 0) return [];

  // 2. Traer entregas de cada curso en paralelo (Firestore no tiene IN con orderBy cross-collection)
  const promises = cursoIds.map(cid =>
    getDocs(query(collection(db, 'entregas'), where('cursoId', '==', cid)))
  );
  const snaps = await Promise.all(promises);
  const todas = snaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() })));

  // 3. Ordenar por fecha descendente
  todas.sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0));
  return todas;
};

// Legado — solo para compatibilidad, NO usar en dashboard (muestra todo)
export const getTodasEntregas = async () => {
  const snap = await getDocs(
    query(collection(db, 'entregas'), orderBy('creadoEn', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const actualizarEntrega = (id, datos) =>
  updateDoc(doc(db, 'entregas', id), { ...datos, evaluadoEn: serverTimestamp() });

export const actualizarEntregaAlumno = (id, datos) =>
  updateDoc(doc(db, 'entregas', id), { ...datos, modificadoEn: serverTimestamp() });

export const editarNotaEntrega = (id, notaFinal, comentarioDocente = '') =>
  updateDoc(doc(db, 'entregas', id), {
    notaFinal,
    notaEditadaManualmente: true,
    comentarioDocente,
    editadoPorDocenteEn: serverTimestamp(),
    nivelGlobal: notaFinal >= 18 ? 'Excelente'
      : notaFinal >= 14 ? 'Bueno'
      : notaFinal >= 11 ? 'Regular'
      : 'Insuficiente',
  });

export const subirPdfEntrega = async ({ file }) =>
  ({ archivoNombre: file?.name || null, archivoUrl: null });

export const eliminarArchivoEntrega = async () => {};

export const eliminarEntrega = (id) => deleteDoc(doc(db, 'entregas', id));

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