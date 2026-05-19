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

  // Ordenar por nota descendente
  const sorted = [...entregas].sort((a, b) => {
    if (a.estado === 'evaluado' && b.estado !== 'evaluado') return -1;
    if (a.estado !== 'evaluado' && b.estado === 'evaluado') return 1;
    return (b.notaFinal ?? -1) - (a.notaFinal ?? -1);
  });

  const rows = sorted.map((e, i) => [
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

// ─── PDF ESTILO APPLE — sin jspdf-autotable, tabla dibujada a mano ───────────
//
//   · Fondo blanco puro, tipografía Helvetica
//   · Líneas negras de acento arriba y abajo (gesto Jobs)
//   · Stats cards con borde sutil
//   · Filas ordenadas: evaluados de mayor a menor nota, luego pendientes
//   · Nota coloreada: verde ≥17, azul ≥14, ámbar ≥11, rojo <11
//   · Cero dependencias externas además de jsPDF
//
export const exportarNotasPDF = async (entregas, docenteNombre = '', cursoNombre = '') => {
  const { default: jsPDF } = await import('jspdf');

  // ── Constantes de layout ───────────────────────────────────────────────────
  const PAGE_W  = 297;
  const PAGE_H  = 210;
  const MARGIN  = 16;
  const ROW_H   = 7;
  const HEAD_H  = 8.5;

  // Anchos de columna: N°|Alumno|Curso|Tipo|Nota|Nivel|Estado|Fecha
  const COLS = [10, 62, 32, 28, 18, 22, 22, 24];
  const HDRS = ['N°', 'Alumno', 'Curso', 'Tipo', 'Nota', 'Nivel', 'Estado', 'Fecha'];

  // ── Paleta Apple ───────────────────────────────────────────────────────────
  const BLACK  = [10, 10, 10];
  const G1     = [70, 70, 70];
  const G2     = [140, 140, 140];
  const G3     = [210, 210, 210];
  const G4     = [248, 248, 248];
  const WHITE  = [255, 255, 255];
  const BLUE   = [0, 122, 255];
  const GREEN  = [52, 199, 89];
  const AMBER  = [255, 149, 0];
  const RED    = [255, 59, 48];

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fc = (d, c) => d.setFillColor(...c);
  const dc = (d, c) => d.setDrawColor(...c);
  const tc = (d, c) => d.setTextColor(...c);

  const clip = (s, maxMm) => {
    // ~1.9 pts per char at size 7.5
    const max = Math.floor(maxMm / 1.78);
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  };

  const noteColor = (n) =>
    n >= 17 ? GREEN : n >= 14 ? BLUE : n >= 11 ? AMBER : RED;

  // ── Ordenar ────────────────────────────────────────────────────────────────
  const sorted = [...entregas].sort((a, b) => {
    if (a.estado === 'evaluado' && b.estado !== 'evaluado') return -1;
    if (a.estado !== 'evaluado' && b.estado === 'evaluado') return 1;
    return (b.notaFinal ?? -1) - (a.notaFinal ?? -1);
  });

  const evaluadas   = sorted.filter(e => e.estado === 'evaluado');
  const promedio    = evaluadas.length
    ? (evaluadas.reduce((s, e) => s + (e.notaFinal || 0), 0) / evaluadas.length).toFixed(1)
    : '—';
  const aprobados   = evaluadas.filter(e => e.notaFinal >= 11).length;
  const desaprob    = evaluadas.filter(e => e.notaFinal < 11).length;
  const fecha       = new Date().toLocaleDateString('es-PE');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // ── drawHeader: devuelve Y donde empieza la tabla ─────────────────────────
  const drawHeader = (pg, total) => {
    // Fondo blanco
    fc(doc, WHITE); doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
    // Barra negra superior
    fc(doc, BLACK); doc.rect(0, 0, PAGE_W, 1.5, 'F');

    if (pg === 1) {
      // Título
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24); tc(doc, BLACK);
      doc.text('EduEval AI', MARGIN, 19);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10); tc(doc, G1);
      doc.text('Reporte de Notas', MARGIN, 26);

      // Separador
      dc(doc, G3); doc.setLineWidth(0.3);
      doc.line(MARGIN, 29, PAGE_W - MARGIN, 29);

      // Meta (derecha)
      doc.setFontSize(7.5); tc(doc, G2);
      doc.text(`Docente: ${docenteNombre}`,                          PAGE_W - MARGIN, 11, { align: 'right' });
      doc.text(cursoNombre ? `Curso: ${cursoNombre}` : 'Todos los cursos', PAGE_W - MARGIN, 17, { align: 'right' });
      doc.text(`Fecha: ${fecha}`,                                    PAGE_W - MARGIN, 23, { align: 'right' });

      // Stats cards
      const SY = 32, CW = 56, CH = 22, GAP = 7;
      const stats = [
        { lbl: 'TOTAL ENTREGAS', val: String(entregas.length), col: BLACK },
        { lbl: 'PROMEDIO CLASE', val: `${promedio}/20`,         col: BLUE  },
        { lbl: 'APROBADOS',      val: String(aprobados),        col: GREEN },
        { lbl: 'DESAPROBADOS',   val: String(desaprob),         col: RED   },
      ];
      stats.forEach(({ lbl, val, col }, i) => {
        const x = MARGIN + i * (CW + GAP);
        fc(doc, G4); dc(doc, G3); doc.setLineWidth(0.2);
        doc.roundedRect(x, SY, CW, CH, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15); tc(doc, col);
        doc.text(val, x + CW / 2, SY + 12, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6); tc(doc, G2);
        doc.text(lbl, x + CW / 2, SY + 18, { align: 'center' });
      });

      return SY + CH + 5; // ← Y inicio tabla
    } else {
      // Páginas 2+: mini cabecera
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5); tc(doc, BLACK);
      doc.text('EduEval AI — Reporte de Notas', MARGIN, 9);

      doc.setFont('helvetica', 'normal'); tc(doc, G2);
      doc.text(
        `${docenteNombre}  ·  ${fecha}  ·  Pág. ${pg}/${total}`,
        PAGE_W - MARGIN, 9, { align: 'right' }
      );
      dc(doc, G3); doc.setLineWidth(0.25);
      doc.line(MARGIN, 11.5, PAGE_W - MARGIN, 11.5);

      return 14;
    }
  };

  // ── drawTableHeader ────────────────────────────────────────────────────────
  const drawTHead = (y) => {
    fc(doc, BLACK);
    doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, HEAD_H, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8); tc(doc, WHITE);

    let x = MARGIN + 2;
    HDRS.forEach((h, i) => {
      const center = i === 0 || i >= 4;
      const cx = center ? x + COLS[i] / 2 : x;
      doc.text(h, cx, y + HEAD_H - 2, { align: center ? 'center' : 'left' });
      x += COLS[i];
    });
    return y + HEAD_H;
  };

  // ── drawRow ────────────────────────────────────────────────────────────────
  const drawRow = (entry, ri, y) => {
    fc(doc, ri % 2 === 0 ? WHITE : G4);
    doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, ROW_H, 'F');

    dc(doc, G3); doc.setLineWidth(0.12);
    doc.line(MARGIN, y + ROW_H, PAGE_W - MARGIN + MARGIN, y + ROW_H);

    const ev   = entry.estado === 'evaluado';
    const nota = entry.notaFinal;
    const ty   = y + ROW_H - 1.8;

    const cells = [
      { t: String(ri + 1),                                               center: true,  color: G2,    bold: false },
      { t: clip(entry.alumnoNombre || '—', COLS[1] - 3),                 center: false, color: BLACK, bold: true  },
      { t: clip(entry.cursoNombre  || '—', COLS[2] - 3),                 center: false, color: G1,    bold: false },
      { t: clip(entry.tipoEvaluacion || '—', COLS[3] - 3),               center: false, color: G1,    bold: false },
      { t: ev ? `${nota}/20` : '—',                                      center: true,  color: ev ? noteColor(nota) : G2, bold: ev },
      { t: entry.nivelGlobal || '—',                                     center: true,  color: G1,    bold: false },
      { t: ev ? 'Evaluado' : 'Pendiente',                                center: true,  color: ev ? GREEN : AMBER, bold: false },
      { t: entry.creadoEn?.toDate?.()?.toLocaleDateString('es-PE') || '—', center: true, color: G2, bold: false },
    ];

    doc.setFontSize(7.2);
    let x = MARGIN + 2;
    cells.forEach((c, i) => {
      doc.setFont('helvetica', c.bold ? 'bold' : 'normal');
      tc(doc, c.color);
      const cx = c.center ? x + COLS[i] / 2 : x;
      doc.text(c.t, cx, ty, { align: c.center ? 'center' : 'left' });
      x += COLS[i];
    });
  };

  // ── drawFooter ─────────────────────────────────────────────────────────────
  const drawFooter = (pg, total) => {
    const fy = PAGE_H - 9;
    dc(doc, G3); doc.setLineWidth(0.2);
    doc.line(MARGIN, fy - 1, PAGE_W - MARGIN, fy - 1);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6); tc(doc, G2);
    doc.text(`EduEval AI  ·  ${fecha}  ·  ${docenteNombre}`, MARGIN, fy + 3);
    doc.text(`Página ${pg} de ${total}`, PAGE_W - MARGIN, fy + 3, { align: 'right' });

    // Barra negra inferior
    fc(doc, BLACK);
    doc.rect(0, PAGE_H - 1.5, PAGE_W, 1.5, 'F');
  };

  // ── Estimar páginas ────────────────────────────────────────────────────────
  const firstTableY = 63;
  const rpp1  = Math.floor((PAGE_H - firstTableY - 14 - HEAD_H) / ROW_H);
  const rppN  = Math.floor((PAGE_H - 14 - 14 - HEAD_H) / ROW_H);
  let totalPg = 1;
  if (sorted.length > rpp1) {
    totalPg += Math.ceil((sorted.length - rpp1) / rppN);
  }

  // ── Renderizar ─────────────────────────────────────────────────────────────
  let pg   = 1;
  let tY   = drawHeader(pg, totalPg);
  let y    = drawTHead(tY);
  let ri   = 0;

  for (const entry of sorted) {
    if (y + ROW_H > PAGE_H - 12) {
      drawFooter(pg, totalPg);
      doc.addPage();
      pg++;
      tY = drawHeader(pg, totalPg);
      y  = drawTHead(tY);
    }
    drawRow(entry, ri, y);
    y  += ROW_H;
    ri++;
  }

  // ── Resumen final ──────────────────────────────────────────────────────────
  const SH = 16;
  if (y + SH + 14 > PAGE_H) {
    drawFooter(pg, totalPg);
    doc.addPage(); pg++;
    tY = drawHeader(pg, totalPg);
    y  = tY + 4;
  } else {
    y += 5;
  }

  fc(doc, G4); dc(doc, G3); doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, SH, 2, 2, 'FD');

  const sums = [
    { lbl: 'TOTAL',        val: String(entregas.length), col: BLACK },
    { lbl: 'PROMEDIO',     val: `${promedio}/20`,        col: BLUE  },
    { lbl: 'APROBADOS',    val: String(aprobados),       col: GREEN },
    { lbl: 'DESAPROBADOS', val: String(desaprob),        col: RED   },
  ];
  const cw = (PAGE_W - MARGIN * 2) / sums.length;
  sums.forEach(({ lbl, val, col }, i) => {
    const cx = MARGIN + i * cw + cw / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11); tc(doc, col);
    doc.text(val, cx, y + 9, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6); tc(doc, G2);
    doc.text(lbl, cx, y + 13.5, { align: 'center' });
  });

  drawFooter(pg, totalPg);

  const file = `EduEval_Notas_${(cursoNombre || 'General').replace(/\s+/g, '_')}_${fecha.replace(/\//g, '-')}.pdf`;
  doc.save(file);
};