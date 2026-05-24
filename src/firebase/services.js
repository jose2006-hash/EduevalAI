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
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from './config.js';

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

// ─── SUBIR AVATAR ────────────────────────────────────────────────────────────

export const subirAvatar = async (file, uid) => {
  if (!file) throw new Error('No se proporcionó archivo');
  const ext = file.name.split('.').pop();
  const path = `avatars/${uid}/avatar.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  const q = query(collection(db, 'usuarios'), where('uid', '==', uid));
  const snap = await getDocs(q);
  if (!snap.empty) {
    await updateDoc(doc(db, 'usuarios', snap.docs[0].id), { avatarUrl: url });
  }
  return url;
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

export const actualizarActividad = (id, datos) =>
  updateDoc(doc(db, 'actividades', id), { ...datos, actualizadoEn: serverTimestamp() });

export const subirEnunciadoActividad = async (file, cursoId, actividadId) => {
  if (!file) return { enunciadoNombre: null, enunciadoUrl: null };
  const path = `enunciados/${cursoId}/${actividadId || Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { enunciadoNombre: file.name, enunciadoUrl: url };
};

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

export const checkIAWithTurnitinMock = async (entregaId, archivoUrl) => {
  const iaScore = Math.round(Math.random() * 60) + 20;
  const iaObservacion = `Mock: ${iaScore}% probable contenido generado por IA. Sustituir por Turnitin real.`;
  try {
    await updateDoc(doc(db, 'entregas', entregaId), {
      iaScore, iaObservacion, iaCheckedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Error guardando resultado IA mock:', err);
  }
  return { iaScore, iaObservacion };
};

export const checkIAWithTurnitin = async (entregaId, archivoUrl) => {
  const serverUrl = process.env.REACT_APP_TURNITIN_URL || 'http://localhost:4000';
  try {
    const res = await fetch(`${serverUrl}/api/turnitin/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entregaId, archivoUrl }),
    });
    if (!res.ok) throw new Error('No se pudo contactar al servidor Turnitin');
    const data = await res.json();
    try {
      await updateDoc(doc(db, 'entregas', entregaId), {
        iaScore: data.iaScore, iaObservacion: data.iaObservacion, iaCheckedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error guardando resultado IA:', err);
    }
    return data;
  } catch (err) {
    console.warn('Fallo al usar endpoint Turnitin, usando mock:', err.message);
    return checkIAWithTurnitinMock(entregaId, archivoUrl);
  }
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

export const getEntregasByDocente = async (docenteUid) => {
  const cursosSnap = await getDocs(
    query(collection(db, 'cursos'), where('docenteUid', '==', docenteUid))
  );
  const cursoIds = cursosSnap.docs.map(d => d.id);
  if (cursoIds.length === 0) return [];
  const promises = cursoIds.map(cid =>
    getDocs(query(collection(db, 'entregas'), where('cursoId', '==', cid)))
  );
  const snaps = await Promise.all(promises);
  const todas = snaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() })));
  todas.sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0));
  return todas;
};

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

// ─── ARCHIVOS (Storage) ──────────────────────────────────────────────────────

export const subirPdfEntrega = async (file, alumnoUid, cursoId, timestamp) => {
  if (!file) return { archivoNombre: null, archivoUrl: null };
  try {
    const path = `entregas/${cursoId}/${alumnoUid}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { archivoNombre: file.name, archivoUrl: url };
  } catch (err) {
    console.error('Error subiendo PDF:', err);
    return { archivoNombre: file?.name || null, archivoUrl: null };
  }
};

export const eliminarArchivoEntrega = async (archivoUrl) => {
  if (!archivoUrl) return;
  try {
    const storageRef = ref(storage, archivoUrl);
    await deleteObject(storageRef);
  } catch (err) {
    console.error('Error eliminando archivo:', err);
  }
};

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

// ─── HELPER: agrupar entregas por tarea ──────────────────────────────────────
// Devuelve: [ { tarea, tipo, items: [...] }, ... ]
// ordenado por número de entregas desc, y dentro de cada grupo evaluadas primero
const agruparPorTarea = (entregas) => {
  const map = {};
  entregas.forEach(e => {
    const key = e.actividadTitulo?.trim() || e.titulo?.trim() || 'Sin tarea';
    if (!map[key]) map[key] = { tarea: key, tipo: e.tipoEvaluacion || '—', items: [] };
    map[key].items.push(e);
  });
  Object.values(map).forEach(g => {
    g.items.sort((a, b) => {
      if (a.estado === 'evaluado' && b.estado !== 'evaluado') return -1;
      if (a.estado !== 'evaluado' && b.estado === 'evaluado') return 1;
      return (b.notaFinal ?? -1) - (a.notaFinal ?? -1);
    });
  });
  return Object.values(map).sort((a, b) => b.items.length - a.items.length);
};

// ─── EXPORTACIÓN EXCEL (agrupada por tarea + hoja resumen) ───────────────────
export const exportarNotasExcel = async (entregas, docenteNombre = '', cursoNombre = '') => {
  const XLSX = await import('xlsx');
  const fecha = new Date().toLocaleDateString('es-PE');
  const grupos = agruparPorTarea(entregas);
  const evaluadas = entregas.filter(e => e.estado === 'evaluado');
  const promedio = evaluadas.length
    ? (evaluadas.reduce((s, e) => s + (e.notaFinal || 0), 0) / evaluadas.length).toFixed(1)
    : '—';

  const wb = XLSX.utils.book_new();

  // ── Hoja GENERAL (todas las entregas agrupadas por tarea) ─────────────────
  const metaRows = [
    [`EduEval AI — Reporte de Notas`],
    [`Docente: ${docenteNombre}`],
    [`Fecha: ${fecha}`],
    cursoNombre ? [`Curso: ${cursoNombre}`] : [`Todos los cursos`],
    [],
    [`Total entregas: ${entregas.length}`, '', `Promedio: ${promedio}/20`, '',
     `Aprobados: ${evaluadas.filter(e => e.notaFinal >= 11).length}`, '',
     `Desaprobados: ${evaluadas.filter(e => e.notaFinal < 11).length}`],
    [],
  ];

  const headers = ['N°', 'Alumno', 'Curso', 'Tarea / Actividad', 'Tipo', 'Nota', 'Nivel', 'Estado', 'Fecha'];
  const allRows = [...metaRows, headers];

  let rowNum = 1;
  grupos.forEach(({ tarea, tipo, items }) => {
    // Fila separadora de grupo
    allRows.push([`── ${tarea} (${tipo}) ──`]);
    items.forEach(e => {
      allRows.push([
        rowNum++,
        e.alumnoNombre || '—',
        e.cursoNombre || '—',
        tarea,
        tipo,
        e.estado === 'evaluado' ? (e.notaFinal ?? '—') : '—',
        e.nivelGlobal || '—',
        e.estado === 'evaluado' ? 'Evaluado' : 'Pendiente',
        e.creadoEn?.toDate?.()?.toLocaleDateString('es-PE') || '—',
      ]);
    });

    // Mini resumen por grupo
    const evG = items.filter(x => x.estado === 'evaluado');
    const promG = evG.length
      ? (evG.reduce((s, x) => s + (x.notaFinal || 0), 0) / evG.length).toFixed(1)
      : '—';
    allRows.push(['', '', '', '', 'Promedio tarea:', promG, '', `${evG.length}/${items.length} eval.`]);
    allRows.push([]);
  });

  const ws = XLSX.utils.aoa_to_sheet(allRows);
  ws['!cols'] = [
    { wch: 5 }, { wch: 28 }, { wch: 20 }, { wch: 32 }, { wch: 16 },
    { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'General');

  // ── Una hoja por cada tarea ───────────────────────────────────────────────
  grupos.forEach(({ tarea, tipo, items }) => {
    const evG = items.filter(x => x.estado === 'evaluado');
    const promG = evG.length
      ? (evG.reduce((s, x) => s + (x.notaFinal || 0), 0) / evG.length).toFixed(1)
      : '—';

    const tareaRows = [
      [`EduEval AI — ${tarea}`],
      [`Tipo: ${tipo}  |  Docente: ${docenteNombre}  |  Fecha: ${fecha}`],
      [`Promedio: ${promG}/20  |  Evaluados: ${evG.length}/${items.length}`,
       '', '',
       `Aprobados: ${evG.filter(x => x.notaFinal >= 11).length}`,
       '', '',
       `Desaprobados: ${evG.filter(x => x.notaFinal < 11).length}`],
      [],
      ['N°', 'Alumno', 'Curso', 'Nota', 'Nivel', 'Estado', 'Fecha'],
    ];

    items.forEach((e, i) => {
      tareaRows.push([
        i + 1,
        e.alumnoNombre || '—',
        e.cursoNombre || '—',
        e.estado === 'evaluado' ? (e.notaFinal ?? '—') : '—',
        e.nivelGlobal || '—',
        e.estado === 'evaluado' ? 'Evaluado' : 'Pendiente',
        e.creadoEn?.toDate?.()?.toLocaleDateString('es-PE') || '—',
      ]);
    });

    const wsT = XLSX.utils.aoa_to_sheet(tareaRows);
    wsT['!cols'] = [
      { wch: 5 }, { wch: 28 }, { wch: 20 },
      { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    ];
    // Nombre de hoja: máx 31 chars, sin chars inválidos
    const sheetName = tarea.replace(/[\\/:*?[\]]/g, '').slice(0, 28);
    XLSX.utils.book_append_sheet(wb, wsT, sheetName);
  });

  const nombreArchivo = `EduEval_Notas_${(cursoNombre || 'General').replace(/\s+/g, '_')}_${fecha.replace(/\//g, '-')}.xlsx`;
  XLSX.writeFile(wb, nombreArchivo);
};

// ─── EXPORTACIÓN PDF (agrupada por tarea + gráficos) ─────────────────────────
//
//  Página 1:  Cabecera + Stats + Gráfico dona + Gráfico barras
//  Págs sig:  Una sección por cada tarea, con tabla de alumnos
//
export const exportarNotasPDF = async (entregas, docenteNombre = '', cursoNombre = '') => {
  const { default: jsPDF } = await import('jspdf');

  // ── Constantes ────────────────────────────────────────────────────────────
  const PAGE_W = 297;
  const PAGE_H = 210;
  const M = 16;           // margen
  const ROW_H = 7;
  const HEAD_H = 8;

  // Paleta
  const BLACK = [10, 10, 10];
  const G1    = [70, 70, 70];
  const G2    = [140, 140, 140];
  const G3    = [210, 210, 210];
  const G4    = [248, 248, 248];
  const WHITE = [255, 255, 255];
  const BLUE  = [0, 122, 255];
  const GREEN = [52, 199, 89];
  const AMBER = [255, 149, 0];
  const RED   = [255, 59, 48];
  const PURPLE= [102, 126, 234];

  const fecha = new Date().toLocaleDateString('es-PE');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fc = (c) => doc.setFillColor(...c);
  const dc = (c) => doc.setDrawColor(...c);
  const tc = (c) => doc.setTextColor(...c);
  const noteColor = (n) => n >= 17 ? GREEN : n >= 14 ? BLUE : n >= 11 ? AMBER : RED;
  const clip = (s, mm) => {
    const max = Math.floor(mm / 1.78);
    return (s || '').length > max ? (s || '').slice(0, max - 1) + '…' : (s || '');
  };

  // ── Stats globales ────────────────────────────────────────────────────────
  const evaluadas = entregas.filter(e => e.estado === 'evaluado');
  const promedio  = evaluadas.length
    ? (evaluadas.reduce((s, e) => s + (e.notaFinal || 0), 0) / evaluadas.length).toFixed(1)
    : '—';
  const aprobados  = evaluadas.filter(e => e.notaFinal >= 11).length;
  const desaprob   = evaluadas.filter(e => e.notaFinal < 11).length;
  const distribucion = {
    Excelente:    evaluadas.filter(e => e.notaFinal >= 17).length,
    Bueno:        evaluadas.filter(e => e.notaFinal >= 14 && e.notaFinal < 17).length,
    Regular:      evaluadas.filter(e => e.notaFinal >= 11 && e.notaFinal < 14).length,
    Insuficiente: evaluadas.filter(e => e.notaFinal < 11).length,
  };

  const grupos = agruparPorTarea(entregas);

  // ── drawPageChrome: barra top + footer ────────────────────────────────────
  const drawChrome = (pg, total) => {
    // Fondo blanco
    fc(WHITE); doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
    // Barra top
    fc(BLACK); doc.rect(0, 0, PAGE_W, 1.5, 'F');
    // Footer
    dc(G3); doc.setLineWidth(0.2);
    doc.line(M, PAGE_H - 10, PAGE_W - M, PAGE_H - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6); tc(G2);
    doc.text(`EduEval AI  ·  ${docenteNombre}  ·  ${fecha}`, M, PAGE_H - 6);
    doc.text(`Pág. ${pg}/${total}`, PAGE_W - M, PAGE_H - 6, { align: 'right' });
    // Barra bottom
    fc(BLACK); doc.rect(0, PAGE_H - 1.5, PAGE_W, 1.5, 'F');
  };

  // ── drawDoughnut: gráfico de dona ─────────────────────────────────────────
  const drawDoughnut = (cx, cy, r, data, colors) => {
    const total = data.reduce((s, v) => s + v, 0);
    if (total === 0) return;
    let startAngle = -Math.PI / 2;
    data.forEach((val, i) => {
      if (val === 0) return;
      const slice = (val / total) * 2 * Math.PI;
      const endAngle = startAngle + slice;
      // Dibujar sector
      const pts = [[cx, cy]];
      const steps = Math.max(8, Math.round(slice * 20));
      for (let s = 0; s <= steps; s++) {
        const a = startAngle + (slice * s) / steps;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      fc(colors[i]); dc(colors[i]);
      doc.setLineWidth(0.1);
      // Dibujar como polígono
      doc.lines(
        pts.slice(1).map((p, idx) => {
          const prev = idx === 0 ? pts[0] : pts[idx];
          return [p[0] - prev[0], p[1] - prev[1]];
        }),
        pts[0][0], pts[0][1], [1, 1], 'F', true
      );
      startAngle = endAngle;
    });
    // Hueco central (dona)
    fc(WHITE); dc(WHITE);
    doc.circle(cx, cy, r * 0.55, 'F');
  };

  // ── drawBarChart: gráfico de barras ───────────────────────────────────────
  const drawBarChart = (x, y, w, h, labels, values, maxVal, color) => {
    const n = labels.length;
    if (n === 0) return;
    const barW = (w / n) * 0.6;
    const gap  = w / n;
    const scaleH = h - 8;

    // Eje Y (líneas de referencia)
    dc(G3); doc.setLineWidth(0.15);
    [0, 5, 10, 15, 20].forEach(v => {
      const vy = y + scaleH - (v / maxVal) * scaleH;
      doc.line(x, vy, x + w, vy);
      doc.setFontSize(5); tc(G2);
      doc.text(String(v), x - 2, vy + 1, { align: 'right' });
    });

    // Barras
    values.forEach((val, i) => {
      const bx = x + i * gap + (gap - barW) / 2;
      const bh = val > 0 ? (val / maxVal) * scaleH : 0;
      const by = y + scaleH - bh;
      fc(color); dc(color);
      doc.roundedRect(bx, by, barW, bh, 0.8, 0.8, 'F');
      // Etiqueta valor
      if (val > 0) {
        doc.setFontSize(5); tc(G1); doc.setFont('helvetica', 'bold');
        doc.text(String(val), bx + barW / 2, by - 1, { align: 'center' });
      }
      // Etiqueta X
      doc.setFontSize(4.5); tc(G2); doc.setFont('helvetica', 'normal');
      const lbl = (labels[i] || '').split(' ')[0].slice(0, 8);
      doc.text(lbl, bx + barW / 2, y + scaleH + 5, { align: 'center' });
    });
  };

  // ── PÁGINA 1: Portada + gráficos ──────────────────────────────────────────
  // Estimar total de páginas: 1 portada + páginas de tablas
  // (estimación rápida: cada grupo ocupa HEAD_H + items*ROW_H + 12 de margen)
  let estimY = 0;
  let pagesForTables = 1;
  const TABLE_TOP = 14 + HEAD_H;
  const TABLE_BOTTOM = PAGE_H - 12;
  const usableH = TABLE_BOTTOM - TABLE_TOP;

  grupos.forEach(({ tarea, items }) => {
    const needed = HEAD_H + 8 + items.length * ROW_H + 6; // header grupo + rows + gap
    if (estimY + needed > usableH) {
      pagesForTables++;
      estimY = needed;
    } else {
      estimY += needed;
    }
  });
  const totalPg = 1 + pagesForTables;

  // Dibujar portada
  drawChrome(1, totalPg);

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22); tc(BLACK);
  doc.text('EduEval AI', M, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9); tc(G1);
  doc.text('Reporte de Notas por Tarea', M, 22);

  // Meta
  doc.setFontSize(7); tc(G2);
  doc.text(`Docente: ${docenteNombre}`, PAGE_W - M, 10, { align: 'right' });
  doc.text(cursoNombre ? `Curso: ${cursoNombre}` : 'Todos los cursos', PAGE_W - M, 15, { align: 'right' });
  doc.text(`Fecha: ${fecha}`, PAGE_W - M, 20, { align: 'right' });

  // Separador
  dc(G3); doc.setLineWidth(0.3);
  doc.line(M, 25, PAGE_W - M, 25);

  // Stats cards
  const SY = 27, CW = 52, CH = 18, GAP = 6;
  [
    { lbl: 'TOTAL ENTREGAS', val: String(entregas.length), col: BLACK },
    { lbl: 'PROMEDIO CLASE',  val: `${promedio}/20`,       col: BLUE  },
    { lbl: 'APROBADOS',       val: String(aprobados),      col: GREEN },
    { lbl: 'DESAPROBADOS',    val: String(desaprob),       col: RED   },
  ].forEach(({ lbl, val, col }, i) => {
    const sx = M + i * (CW + GAP);
    fc(G4); dc(G3); doc.setLineWidth(0.2);
    doc.roundedRect(sx, SY, CW, CH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13); tc(col);
    doc.text(val, sx + CW / 2, SY + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5); tc(G2);
    doc.text(lbl, sx + CW / 2, SY + 15, { align: 'center' });
  });

  // ── Gráfico de dona (distribución niveles) ─────────────────────────────────
  const DONA_X = M + 30;
  const DONA_Y = 75;
  const DONA_R = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8); tc(BLACK);
  doc.text('Distribución de Niveles', M, 52);
  dc(G3); doc.setLineWidth(0.2);
  doc.line(M, 54, M + 110, 54);

  const donaData   = [distribucion.Excelente, distribucion.Bueno, distribucion.Regular, distribucion.Insuficiente];
  const donaColors = [GREEN, BLUE, AMBER, RED];
  const donaLabels = ['Excelente', 'Bueno', 'Regular', 'Insuficiente'];

  drawDoughnut(DONA_X + DONA_R + 5, DONA_Y, DONA_R, donaData, donaColors);

  // Leyenda dona
  donaLabels.forEach((lbl, i) => {
    const ly = DONA_Y - DONA_R + i * 9 + 2;
    const lx = DONA_X + DONA_R * 2 + 15;
    fc(donaColors[i]); dc(donaColors[i]);
    doc.roundedRect(lx, ly - 3.5, 4, 4, 0.5, 0.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7); tc(G1);
    doc.text(`${lbl}: ${donaData[i]}`, lx + 6, ly);
  });

  // ── Gráfico de barras (notas por tarea) ────────────────────────────────────
  const BAR_X = M + 135;
  const BAR_Y = 57;
  const BAR_W = PAGE_W - BAR_X - M;
  const BAR_H = 85;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8); tc(BLACK);
  doc.text('Promedio por Tarea', BAR_X, 52);
  dc(G3); doc.setLineWidth(0.2);
  doc.line(BAR_X, 54, PAGE_W - M, 54);

  const barLabels = grupos.map(g => g.tarea.slice(0, 14));
  const barValues = grupos.map(({ items }) => {
    const ev = items.filter(x => x.estado === 'evaluado');
    if (!ev.length) return 0;
    return parseFloat((ev.reduce((s, x) => s + (x.notaFinal || 0), 0) / ev.length).toFixed(1));
  });

  drawBarChart(BAR_X + 8, BAR_Y, BAR_W - 10, BAR_H, barLabels, barValues, 20, PURPLE);

  // ── Resumen de tareas en portada ──────────────────────────────────────────
  // Mini tabla de tareas al pie de la portada
  const MINI_Y = 150;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8); tc(BLACK);
  doc.text('Resumen por Tarea', M, MINI_Y - 4);
  dc(G3); doc.setLineWidth(0.2);
  doc.line(M, MINI_Y - 2, PAGE_W - M, MINI_Y - 2);

  // Encabezado mini tabla
  fc(BLACK); doc.rect(M, MINI_Y, PAGE_W - M * 2, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5); tc(WHITE);
  const miniCols  = [90, 30, 20, 20, 20, 20, 20, 20];
  const miniHdrs  = ['Tarea / Actividad', 'Tipo', 'Total', 'Eval.', 'Promedio', 'Excelente', 'Aprobados', 'Desaprob.'];
  let mx = M + 2;
  miniHdrs.forEach((h, i) => {
    doc.text(h, mx, MINI_Y + 5, { align: i > 0 ? 'center' : 'left', maxWidth: miniCols[i] });
    mx += miniCols[i];
  });

  let miny = MINI_Y + 7;
  grupos.forEach(({ tarea, tipo, items }, gi) => {
    if (miny > PAGE_H - 14) return; // no cabe
    const evG  = items.filter(x => x.estado === 'evaluado');
    const promG = evG.length
      ? (evG.reduce((s, x) => s + (x.notaFinal || 0), 0) / evG.length).toFixed(1)
      : '—';
    const exG  = evG.filter(x => x.notaFinal >= 17).length;
    const apG  = evG.filter(x => x.notaFinal >= 11).length;
    const daG  = evG.filter(x => x.notaFinal < 11).length;

    fc(gi % 2 === 0 ? WHITE : G4);
    doc.rect(M, miny, PAGE_W - M * 2, 6, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2); tc(BLACK);

    let rx = M + 2;
    [tarea, tipo, items.length, evG.length, promG, exG, apG, daG].forEach((v, i) => {
      const txt = String(v);
      doc.text(i === 0 ? clip(txt, miniCols[0] - 3) : txt,
        i === 0 ? rx : rx + miniCols[i] / 2,
        miny + 4,
        { align: i === 0 ? 'left' : 'center' });
      rx += miniCols[i];
    });

    // Separador horizontal
    dc(G3); doc.setLineWidth(0.1);
    doc.line(M, miny + 6, PAGE_W - M, miny + 6);
    miny += 6;
  });

  // ── PÁGINAS DE TABLAS: una sección por tarea ──────────────────────────────
  let pg = 2;
  doc.addPage();
  drawChrome(pg, totalPg);

  let y = 14;

  // Cabecera de página (pequeña)
  const drawPageHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5); tc(BLACK);
    doc.text('EduEval AI — Detalle por Tarea', M, 10);
    doc.setFont('helvetica', 'normal'); tc(G2);
    doc.text(`${docenteNombre}  ·  ${cursoNombre || 'Todos los cursos'}  ·  ${fecha}`, PAGE_W - M, 10, { align: 'right' });
    dc(G3); doc.setLineWidth(0.25);
    doc.line(M, 12, PAGE_W - M, 12);
    return 14;
  };

  y = drawPageHeader();

  // Columnas de la tabla de alumnos
  const COLS = [10, 72, 22, 20, 20, 22, 24];
  const HDRS = ['N°', 'Alumno', 'Tipo', 'Nota', 'Nivel', 'Estado', 'Fecha'];

  const drawTHead = (yy) => {
    fc(BLACK); doc.rect(M, yy, PAGE_W - M * 2, HEAD_H, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5); tc(WHITE);
    let xx = M + 2;
    HDRS.forEach((h, i) => {
      const center = i !== 1;
      doc.text(h, center ? xx + COLS[i] / 2 : xx, yy + HEAD_H - 2, { align: center ? 'center' : 'left' });
      xx += COLS[i];
    });
    return yy + HEAD_H;
  };

  const drawAlumnoRow = (e, ri, yy) => {
    fc(ri % 2 === 0 ? WHITE : G4);
    doc.rect(M, yy, PAGE_W - M * 2, ROW_H, 'F');
    dc(G3); doc.setLineWidth(0.1);
    doc.line(M, yy + ROW_H, PAGE_W - M, yy + ROW_H);

    const ev   = e.estado === 'evaluado';
    const nota = e.notaFinal;
    const ty   = yy + ROW_H - 1.8;
    doc.setFontSize(7);

    const cells = [
      { t: String(ri + 1),         center: true,  color: G2,    bold: false },
      { t: clip(e.alumnoNombre || '—', COLS[1] - 3), center: false, color: BLACK, bold: true },
      { t: e.tipoEvaluacion || '—', center: true,  color: G1,    bold: false },
      { t: ev ? `${nota}/20` : '—', center: true,  color: ev ? noteColor(nota) : G2, bold: ev },
      { t: e.nivelGlobal || '—',   center: true,  color: G1,    bold: false },
      { t: ev ? 'Evaluado' : 'Pendiente', center: true, color: ev ? GREEN : AMBER, bold: false },
      { t: e.creadoEn?.toDate?.()?.toLocaleDateString('es-PE') || '—', center: true, color: G2, bold: false },
    ];

    let xx = M + 2;
    cells.forEach((c, i) => {
      doc.setFont('helvetica', c.bold ? 'bold' : 'normal');
      tc(c.color);
      doc.text(c.t, c.center ? xx + COLS[i] / 2 : xx, ty, { align: c.center ? 'center' : 'left' });
      xx += COLS[i];
    });
  };

  // Iterar grupos
  for (const { tarea, tipo, items } of grupos) {
    const evG  = items.filter(x => x.estado === 'evaluado');
    const promG = evG.length
      ? (evG.reduce((s, x) => s + (x.notaFinal || 0), 0) / evG.length).toFixed(1)
      : '—';

    // ¿Cabe el encabezado de grupo + al menos 1 fila?
    const needForHeader = 10 + HEAD_H + ROW_H;
    if (y + needForHeader > PAGE_H - 12) {
      drawChrome(pg, totalPg);
      doc.addPage(); pg++;
      drawChrome(pg, totalPg);
      y = drawPageHeader();
    }

    // Encabezado de grupo (fila verde oscuro)
    fc(PURPLE); dc(PURPLE);
    doc.roundedRect(M, y, PAGE_W - M * 2, 8, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5); tc(WHITE);
    doc.text(clip(tarea, PAGE_W - M * 2 - 80), M + 4, y + 5.5);

    // Stats del grupo (derecha)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(
      `${tipo}  ·  Promedio: ${promG}/20  ·  ${evG.length}/${items.length} evaluados  ·  Aprobados: ${evG.filter(x => x.notaFinal >= 11).length}`,
      PAGE_W - M - 4, y + 5.5, { align: 'right' }
    );
    y += 9;

    // Tabla de alumnos
    y = drawTHead(y);
    items.forEach((e, ri) => {
      if (y + ROW_H > PAGE_H - 12) {
        drawChrome(pg, totalPg);
        doc.addPage(); pg++;
        drawChrome(pg, totalPg);
        y = drawPageHeader();
        y = drawTHead(y);
      }
      drawAlumnoRow(e, ri, y);
      y += ROW_H;
    });

    y += 8; // espacio entre grupos
  }

  drawChrome(pg, totalPg);

  const file = `EduEval_Notas_${(cursoNombre || 'General').replace(/\s+/g, '_')}_${fecha.replace(/\//g, '-')}.pdf`;
  doc.save(file);
};