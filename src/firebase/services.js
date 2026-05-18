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

// ── NUEVAS: actualizar actividad y subir enunciado al Storage ─────────────────

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

// ─── EXPORTACIÓN DE NOTAS ────────────────────────────────────────────────────

export const exportarNotasExcel = async (entregas, docenteNombre = '', cursoNombre = '') => {
  const XLSX = await import('xlsx');

  const fecha = new Date().toLocaleDateString('es-PE');
  const titulo = cursoNombre
    ? `Notas — ${cursoNombre}`
    : 'Reporte de Notas — EduEval AI';

  const metaRows = [
    [`EduEval AI — Reporte de Notas`],
    [`Docente: ${docenteNombre}`],
    [`Fecha: ${fecha}`],
    cursoNombre ? [`Curso: ${cursoNombre}`] : [],
    [],
  ].filter(r => r.length >= 0);

  const headers = [
    'N°', 'Alumno', 'Curso', 'Tipo de Evaluación',
    'Título / Trabajo', 'Nota Final', 'Nivel', 'Estado', 'Fecha Entrega',
  ];

  const rows = entregas.map((e, i) => [
    i + 1,
    e.alumnoNombre || '—',
    e.cursoNombre || '—',
    e.tipoEvaluacion || '—',
    e.titulo || '—',
    e.estado === 'evaluado' ? (e.notaFinal ?? '—') : '—',
    e.nivelGlobal || '—',
    e.estado === 'evaluado' ? 'Evaluado' : 'Pendiente',
    e.creadoEn?.toDate?.()?.toLocaleDateString('es-PE') || '—',
  ]);

  const evaluadas = entregas.filter(e => e.estado === 'evaluado');
  const promedio = evaluadas.length
    ? (evaluadas.reduce((s, e) => s + (e.notaFinal || 0), 0) / evaluadas.length).toFixed(1)
    : '—';

  const summaryRows = [
    [],
    ['', '', '', '', 'Total entregas:', entregas.length],
    ['', '', '', '', 'Promedio clase:', promedio],
    ['', '', '', '', 'Aprobados (≥11):', evaluadas.filter(e => e.notaFinal >= 11).length],
    ['', '', '', '', 'Desaprobados (<11):', evaluadas.filter(e => e.notaFinal < 11).length],
  ];

  const allRows = [...metaRows, headers, ...rows, ...summaryRows];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  ws['!cols'] = [
    { wch: 5 }, { wch: 28 }, { wch: 22 }, { wch: 20 },
    { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 15 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Notas');

  const nombreArchivo = `EduEval_Notas_${(cursoNombre || 'General').replace(/\s+/g, '_')}_${fecha.replace(/\//g, '-')}.xlsx`;
  XLSX.writeFile(wb, nombreArchivo);
};

export const exportarNotasPDF = async (entregas, docenteNombre = '', cursoNombre = '') => {
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const fecha = new Date().toLocaleDateString('es-PE');
  const evaluadas = entregas.filter(e => e.estado === 'evaluado');
  const promedio = evaluadas.length
    ? (evaluadas.reduce((s, e) => s + (e.notaFinal || 0), 0) / evaluadas.length).toFixed(1)
    : '—';

  doc.setFillColor(15, 12, 41);
  doc.rect(0, 0, 297, 35, 'F');

  doc.setFillColor(102, 126, 234);
  doc.rect(0, 35, 297, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('EduEval AI — Reporte de Notas', 14, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(167, 139, 250);
  const sub = cursoNombre ? `Curso: ${cursoNombre}` : 'Todos los cursos';
  doc.text(sub, 14, 22);

  doc.setTextColor(200, 200, 220);
  doc.setFontSize(9);
  doc.text(`Docente: ${docenteNombre}`, 297 - 14, 14, { align: 'right' });
  doc.text(`Fecha: ${fecha}`, 297 - 14, 21, { align: 'right' });

  const statsY = 42;
  const statItems = [
    { label: 'Total Entregas', value: entregas.length, color: [102, 126, 234] },
    { label: 'Promedio Clase', value: `${promedio}/20`, color: [34, 197, 94] },
    { label: 'Aprobados', value: evaluadas.filter(e => e.notaFinal >= 11).length, color: [59, 130, 246] },
    { label: 'Desaprobados', value: evaluadas.filter(e => e.notaFinal < 11).length, color: [239, 68, 68] },
  ];

  statItems.forEach((s, i) => {
    const x = 14 + i * 68;
    doc.setFillColor(25, 20, 55);
    doc.roundedRect(x, statsY, 62, 18, 2, 2, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...s.color);
    doc.text(String(s.value), x + 31, statsY + 10, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 140, 180);
    doc.text(s.label.toUpperCase(), x + 31, statsY + 15, { align: 'center' });
  });

  const tableData = entregas.map((e, i) => [
    i + 1,
    e.alumnoNombre || '—',
    e.cursoNombre || '—',
    e.tipoEvaluacion || '—',
    e.titulo || '—',
    e.estado === 'evaluado' ? `${e.notaFinal ?? '—'}/20` : '—',
    e.nivelGlobal || '—',
    e.estado === 'evaluado' ? 'Evaluado' : 'Pendiente',
    e.creadoEn?.toDate?.()?.toLocaleDateString('es-PE') || '—',
  ]);

  doc.autoTable({
    startY: statsY + 24,
    head: [['N°', 'Alumno', 'Curso', 'Tipo', 'Trabajo', 'Nota', 'Nivel', 'Estado', 'Fecha']],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [220, 215, 240],
      lineColor: [40, 35, 80],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 25, 65],
      textColor: [167, 139, 250],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [20, 16, 50] },
    bodyStyles: { fillColor: [15, 12, 41] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 45 },
      2: { cellWidth: 38 },
      3: { cellWidth: 28 },
      4: { cellWidth: 50 },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 26, halign: 'center' },
    },
    didParseCell(data) {
      if (data.column.index === 5 && data.section === 'body') {
        const nota = parseFloat(data.cell.raw);
        if (!isNaN(nota)) {
          data.cell.styles.textColor = nota >= 14
            ? [34, 197, 94]
            : nota >= 11 ? [245, 158, 11] : [239, 68, 68];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(15, 12, 41);
    doc.rect(0, doc.internal.pageSize.height - 10, 297, 10, 'F');
    doc.setFontSize(7);
    doc.setTextColor(100, 90, 140);
    doc.text(
      `EduEval AI — Generado el ${fecha} por ${docenteNombre}`,
      14, doc.internal.pageSize.height - 3
    );
    doc.text(
      `Página ${i} de ${pageCount}`,
      297 - 14, doc.internal.pageSize.height - 3,
      { align: 'right' }
    );
  }

  const nombreArchivo = `EduEval_Notas_${(cursoNombre || 'General').replace(/\s+/g, '_')}_${fecha.replace(/\//g, '-')}.pdf`;
  doc.save(nombreArchivo);
};