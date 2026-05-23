// src/pages/GestionCursos.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCursosByDocente, crearCurso, eliminarCurso,
  getMatriculasByCurso, getPendientesByCurso,
  aprobarMatricula, rechazarMatricula, eliminarMatricula,
  crearActividad, getActividadesByCurso, eliminarActividad,
  getEntregasByCurso, eliminarEntrega,
  getRubricas,
  actualizarEntregaAlumno,
  actualizarActividad,
} from '../firebase/services.js';
import { generarReporteEstadistico } from '../openai/evaluador.js';
import { useAuth } from '../components/AuthContext.jsx';

const TIPOS_DEFAULT = [
  { nombre: 'Tareas', peso: 30 },
  { nombre: 'Exámenes', peso: 40 },
  { nombre: 'Participación', peso: 20 },
  { nombre: 'Otros', peso: 10 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const iaBadgeStyle = (pct) => {
  if (pct === null || pct === undefined) return null;
  const bg = pct >= 81 ? 'rgba(239,68,68,0.18)' : pct >= 56 ? 'rgba(245,158,11,0.18)' : pct >= 26 ? 'rgba(99,102,241,0.18)' : 'rgba(34,197,94,0.15)';
  const color = pct >= 81 ? '#ef4444' : pct >= 56 ? '#f59e0b' : pct >= 26 ? '#818cf8' : '#22c55e';
  return { background: bg, color, border: `1px solid ${color}44`, padding: '2px 7px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' };
};
const iaLabel = (pct) => {
  if (pct === null || pct === undefined) return null;
  if (pct >= 81) return `🤖 ${pct}% IA`;
  if (pct >= 56) return `⚠️ ${pct}% IA`;
  if (pct >= 26) return `🔍 ${pct}% IA`;
  return `✅ ${pct}% IA`;
};

export default function GestionCursos() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [cursos, setCursos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [cursoPendientes, setCursoPendientes] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [aprobados, setAprobados] = useState([]);
  const [confirm, setConfirm] = useState(null);

  // Actividades
  const [cursoActividades, setCursoActividades] = useState(null);
  const [actividades, setActividades] = useState([]);
  const [rubricas, setRubricas] = useState([]);
  const [showActForm, setShowActForm] = useState(false);
  const [guardandoAct, setGuardandoAct] = useState(false);
  const [msgAct, setMsgAct] = useState('');
  const [editingActividadId, setEditingActividadId] = useState(null);
  const [editFecha, setEditFecha] = useState('');
  const [formAct, setFormAct] = useState({
    titulo: '', tipoEvaluacion: '', descripcion: '',
    enunciadoTexto: '', enunciadoNombre: '', rubricaId: '', fechaLimite: '',
  });
  const [leyendoAct, setLeyendoAct] = useState(false);

  // Entregas
  const [cursoEntregas, setCursoEntregas] = useState(null);
  const [entregas, setEntregas] = useState([]);
  const [entregaDetalle, setEntregaDetalle] = useState(null);
  const [filtroAlumno, setFiltroAlumno] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [gruposExpandidos, setGruposExpandidos] = useState({});

  // Edición de nota
  const [editandoNota, setEditandoNota] = useState(false);
  const [notaEditada, setNotaEditada] = useState('');
  const [comentarioDocente, setComentarioDocente] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [msgNota, setMsgNota] = useState('');

  // Reporte estadístico
  const [showReporte, setShowReporte] = useState(false);
  const [reporte, setReporte] = useState(null);
  const [generandoReporte, setGenerandoReporte] = useState(false);
  const [msgReporte, setMsgReporte] = useState('');
  const [tabReporte, setTabReporte] = useState('resumen'); // resumen | alumnos | temas | plan

  const [form, setForm] = useState({
    nombre: '', seccion: '', codigo: '', descripcion: '', ciclo: '',
    silaboTexto: '', silaboNombre: '', tiposEvaluacion: TIPOS_DEFAULT,
  });
  const [leyendoPDF, setLeyendoPDF] = useState(false);

  useEffect(() => { if (userData?.uid) cargarCursos(); }, [userData]);

  const cargarCursos = async () => {
    const crs = await getCursosByDocente(userData.uid);
    setCursos(crs);
  };

  const abrirSolicitudes = async (curso) => {
    setCursoPendientes(curso);
    const [pends, todos] = await Promise.all([
      getPendientesByCurso(curso.id), getMatriculasByCurso(curso.id),
    ]);
    setPendientes(pends);
    setAprobados(todos.filter(m => m.estado === 'aprobado'));
  };

  const handleAprobar = async (id) => { await aprobarMatricula(id); await abrirSolicitudes(cursoPendientes); };
  const handleRechazar = async (id) => { await rechazarMatricula(id); await abrirSolicitudes(cursoPendientes); };
  const handleExpulsarAlumno = (m) => setConfirm({ tipo: 'alumno', id: m.id, nombre: m.alumnoNombre });
  const handleEliminarActividad = (a) => setConfirm({ tipo: 'actividad', id: a.id, nombre: a.titulo });
  const handleEliminarCurso = (c) => setConfirm({ tipo: 'curso', id: c.id, nombre: c.nombre });
  const handleEliminarEntregaDocente = (e) => setConfirm({ tipo: 'entrega', id: e.id, nombre: `${e.alumnoNombre} — ${e.titulo}` });

  const ejecutarConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.tipo === 'alumno') { await eliminarMatricula(confirm.id); await abrirSolicitudes(cursoPendientes); setMsg('✅ Alumno eliminado'); }
      else if (confirm.tipo === 'actividad') { await eliminarActividad(confirm.id); setActividades(await getActividadesByCurso(cursoActividades.id)); setMsgAct('✅ Actividad eliminada'); }
      else if (confirm.tipo === 'curso') { await eliminarCurso(confirm.id); await cargarCursos(); setMsg('✅ Curso eliminado'); }
      else if (confirm.tipo === 'entrega') { await eliminarEntrega(confirm.id); setEntregaDetalle(null); setEntregas(await getEntregasByCurso(cursoEntregas.id)); setMsg('✅ Entrega eliminada'); }
    } catch (err) { setMsg('❌ Error: ' + err.message); }
    setConfirm(null);
  };

  const handleEditarActividad = (a) => { setEditingActividadId(a.id); setEditFecha(a.fechaLimite || ''); };
  const handleCancelarEditar = () => { setEditingActividadId(null); setEditFecha(''); };
  const handleGuardarFecha = async () => {
    if (!editingActividadId) return;
    try {
      setGuardandoAct(true);
      await actualizarActividad(editingActividadId, { fechaLimite: editFecha });
      setActividades(await getActividadesByCurso(cursoActividades.id));
      setMsgAct('✅ Fecha actualizada');
      setEditingActividadId(null); setEditFecha('');
    } catch (err) { setMsgAct('❌ ' + err.message); }
    finally { setGuardandoAct(false); }
  };

  const handleGuardarNota = async () => {
    const nota = parseFloat(notaEditada);
    if (isNaN(nota) || nota < 0 || nota > 20) return setMsgNota('❌ La nota debe ser entre 0 y 20');
    setGuardandoNota(true); setMsgNota('');
    try {
      const porcentaje = Math.round((nota / 20) * 100);
      const nivelGlobal = nota >= 17 ? 'Excelente' : nota >= 14 ? 'Bueno' : nota >= 11 ? 'Regular' : 'Insuficiente';
      await actualizarEntregaAlumno(entregaDetalle.id, { notaFinal: nota, porcentaje, nivelGlobal, notaEditadaManualmente: true, comentarioDocente: comentarioDocente.trim(), estado: 'evaluado' });
      const entregaActualizada = { ...entregaDetalle, notaFinal: nota, porcentaje, nivelGlobal, notaEditadaManualmente: true, comentarioDocente: comentarioDocente.trim(), estado: 'evaluado' };
      setEntregaDetalle(entregaActualizada);
      setEntregas(await getEntregasByCurso(cursoEntregas.id));
      setMsgNota('✅ Nota guardada'); setEditandoNota(false);
    } catch (err) { setMsgNota('❌ Error: ' + err.message); }
    finally { setGuardandoNota(false); }
  };

  const abrirEditarNota = () => { setNotaEditada(String(entregaDetalle.notaFinal ?? '')); setComentarioDocente(entregaDetalle.comentarioDocente || ''); setMsgNota(''); setEditandoNota(true); };

  const abrirEntregas = async (curso) => {
    setCursoEntregas(curso);
    setFiltroAlumno(''); setFiltroTipo('');
    setEntregaDetalle(null); setEditandoNota(false); setMsgNota('');
    setGruposExpandidos({}); setReporte(null); setShowReporte(false);
    const ents = await getEntregasByCurso(curso.id);
    ents.sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0));
    setEntregas(ents);
  };

  const abrirActividades = async (curso) => {
    setCursoActividades(curso); setShowActForm(false); setMsgAct('');
    const [acts, rubs] = await Promise.all([getActividadesByCurso(curso.id), getRubricas(curso.id)]);
    setActividades(acts); setRubricas(rubs);
    setFormAct(f => ({ ...f, tipoEvaluacion: curso.tiposEvaluacion?.[0]?.nombre || '', fechaLimite: '' }));
  };

  const leerPDFActividad = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ').replace(/\s{3,}/g, '\n').substring(0, 8000);
      resolve(text);
    };
    reader.readAsText(file, 'latin1');
  });

  // ── CORRECCIÓN: async + await extraído fuera del setter ──────────────────
  const handleEnunciadoPDF = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLeyendoAct(true);
    const texto = await leerPDFActividad(file);
    setFormAct(f => ({ ...f, enunciadoTexto: texto, enunciadoNombre: file.name }));
    setLeyendoAct(false);
  };

  const handleGuardarActividad = async () => {
    if (!formAct.titulo.trim()) return setMsgAct('❌ El título es obligatorio');
    if (!formAct.tipoEvaluacion) return setMsgAct('❌ Selecciona el tipo de evaluación');
    if (!formAct.enunciadoTexto.trim() && !formAct.descripcion.trim()) return setMsgAct('❌ Agrega descripción o enunciado');
    setGuardandoAct(true); setMsgAct('');
    try {
      await crearActividad({ ...formAct, cursoId: cursoActividades.id, cursoNombre: cursoActividades.nombre, docenteUid: userData.uid, docenteNombre: userData.nombre });
      setMsgAct(`✅ Actividad "${formAct.titulo}" publicada`);
      setShowActForm(false);
      setFormAct({ titulo: '', tipoEvaluacion: cursoActividades.tiposEvaluacion?.[0]?.nombre || '', descripcion: '', enunciadoTexto: '', enunciadoNombre: '', rubricaId: '', fechaLimite: '' });
      setActividades(await getActividadesByCurso(cursoActividades.id));
    } catch (err) { setMsgAct('❌ Error: ' + err.message); }
    finally { setGuardandoAct(false); }
  };

  const handleSilaboPDF = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLeyendoPDF(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ').replace(/\s{3,}/g, '\n').substring(0, 8000);
      setForm(f => ({ ...f, silaboTexto: text, silaboNombre: file.name }));
      setLeyendoPDF(false);
    };
    reader.readAsText(file, 'latin1');
  };

  const updateTipo = (i, field, val) => {
    const tipos = [...form.tiposEvaluacion];
    tipos[i] = { ...tipos[i], [field]: field === 'peso' ? Number(val) : val };
    setForm(f => ({ ...f, tiposEvaluacion: tipos }));
  };

  const totalPeso = form.tiposEvaluacion.reduce((s, t) => s + (t.peso || 0), 0);

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return setMsg('❌ Nombre obligatorio');
    if (!form.seccion.trim()) return setMsg('❌ Sección obligatoria');
    if (!form.codigo.trim()) return setMsg('❌ Código obligatorio');
    if (totalPeso !== 100) return setMsg(`❌ Los pesos deben sumar 100% (ahora: ${totalPeso}%)`);
    setGuardando(true); setMsg('');
    try {
      await crearCurso({ ...form, docenteUid: userData.uid, docenteNombre: userData.nombre });
      setMsg(`✅ Curso "${form.nombre}" creado`);
      await cargarCursos(); setShowForm(false);
      setForm({ nombre: '', seccion: '', codigo: '', descripcion: '', ciclo: '', silaboTexto: '', silaboNombre: '', tiposEvaluacion: TIPOS_DEFAULT });
    } catch (err) { setMsg('❌ Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  // ── Reporte estadístico ───────────────────────────────────────────────────
  const handleGenerarReporte = async () => {
    setGenerandoReporte(true); setMsgReporte(''); setTabReporte('resumen');
    try {
      const resultado = await generarReporteEstadistico(entregas, cursoEntregas.nombre, userData.nombre);
      setReporte(resultado);
      setShowReporte(true);
    } catch (err) { setMsgReporte('❌ ' + err.message); }
    finally { setGenerandoReporte(false); }
  };

  const fechaLimiteDisplay = (fechaStr) => {
    if (!fechaStr) return null;
    const fecha = new Date(fechaStr); const hoy = new Date();
    return { fecha, vencida: fecha < hoy, diff: Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24)) };
  };

  const nivelColor = (nota) => {
    if (!nota && nota !== 0) return '#667eea';
    if (nota >= 17) return '#22c55e';
    if (nota >= 14) return '#3b82f6';
    if (nota >= 11) return '#f59e0b';
    return '#ef4444';
  };

  const esDocxArchivo = (nombre) => nombre?.toLowerCase().endsWith('.docx');

  // ── Agrupación de entregas ────────────────────────────────────────────────
  const entregasFiltradas = entregas.filter(e => {
    const matchAlumno = !filtroAlumno || e.alumnoNombre?.toLowerCase().includes(filtroAlumno.toLowerCase());
    const matchTipo = !filtroTipo || e.tipoEvaluacion === filtroTipo;
    return matchAlumno && matchTipo;
  });

  const gruposMap = {};
  entregasFiltradas.forEach(e => {
    const key = e.actividadTitulo?.trim() || e.titulo?.trim() || 'Sin tema';
    if (!gruposMap[key]) gruposMap[key] = [];
    gruposMap[key].push(e);
  });
  Object.keys(gruposMap).forEach(key => {
    gruposMap[key].sort((a, b) => {
      if (a.estado === 'evaluado' && b.estado !== 'evaluado') return -1;
      if (a.estado !== 'evaluado' && b.estado === 'evaluado') return 1;
      return (b.notaFinal ?? -1) - (a.notaFinal ?? -1);
    });
  });
  const grupos = Object.entries(gruposMap).sort((a, b) => b[1].length - a[1].length);
  const toggleGrupo = (key) => setGruposExpandidos(prev => ({ ...prev, [key]: !prev[key] }));
  const tiposUnicos = [...new Set(entregas.map(e => e.tipoEvaluacion).filter(Boolean))];

  const grupoStats = (items) => {
    const ev = items.filter(e => e.estado === 'evaluado');
    const prom = ev.length ? (ev.reduce((s, e) => s + (e.notaFinal || 0), 0) / ev.length).toFixed(1) : null;
    return { total: items.length, evaluados: ev.length, promedio: prom };
  };

  // Color de perfil en reporte
  const perfilColor = (p) => p === 'Excelente' ? '#22c55e' : p === 'Bueno' ? '#3b82f6' : p === 'Regular' ? '#f59e0b' : '#ef4444';
  const prioridadColor = (p) => p === 'Alta' ? '#ef4444' : p === 'Media' ? '#f59e0b' : '#22c55e';

  return (
    <div style={s.container}>
      <header style={s.header}>
        <button onClick={() => navigate('/dashboard')} style={s.backBtn}>← Dashboard</button>
        <h1 style={s.title}>Mis Cursos</h1>
        <button style={s.primaryBtn} onClick={() => setShowForm(true)}>+ Nuevo Curso</button>
      </header>

      {msg && <div style={{ color: msg.includes('✅') ? '#22c55e' : '#ef4444', marginBottom: '16px', fontSize: '14px', background: msg.includes('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '12px 16px', borderRadius: '10px' }}>{msg}</div>}

      <div style={s.grid}>
        {cursos.map((c, i) => (
          <div key={i} style={s.cursoCard}>
            <div style={s.cursoTop}>
              <span style={s.cursoIcon}>📚</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {c.seccion && <span style={s.seccionBadge}>Sección {c.seccion}</span>}
                <button style={s.deleteCursoBtn} onClick={() => handleEliminarCurso(c)}>🗑</button>
              </div>
            </div>
            <h3 style={s.cursoNombre}>{c.nombre}</h3>
            <p style={s.cursoCiclo}>{c.ciclo && `${c.ciclo} · `}{c.descripcion}</p>
            <div style={s.tiposList}>{c.tiposEvaluacion?.map((t, j) => <span key={j} style={s.tipoTag}>{t.nombre} {t.peso}%</span>)}</div>
            {c.silaboNombre && <p style={s.silaboTag}>📄 {c.silaboNombre}</p>}
            <div style={s.infoBox}>
              <p style={s.infoLabel}>Los alumnos ingresan con:</p>
              <p style={s.infoValue}>Código: <strong style={{ color: '#a78bfa' }}>{c.codigo}</strong> + nombre del profesor</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <button style={s.entregasBtn} onClick={() => abrirEntregas(c)}>📋 Ver entregas de alumnos</button>
              <button style={s.actividadesBtn} onClick={() => abrirActividades(c)}>📝 Actividades y enunciados</button>
              <button style={s.solicitudesBtn} onClick={() => abrirSolicitudes(c)}>👥 Ver alumnos y solicitudes</button>
            </div>
          </div>
        ))}
        {cursos.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', gridColumn: '1/-1', textAlign: 'center', padding: '48px' }}>No tienes cursos. Crea el primero.</p>}
      </div>

      {/* ── Modal confirmación ── */}
      {confirm && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '420px', textAlign: 'center' }}>
            <p style={{ fontSize: '40px', margin: '0 0 12px' }}>⚠️</p>
            <h3 style={{ color: '#fff', fontSize: '18px', margin: '0 0 8px' }}>
              {confirm.tipo === 'alumno' ? 'Eliminar alumno' : confirm.tipo === 'actividad' ? 'Eliminar actividad' : confirm.tipo === 'entrega' ? 'Eliminar entrega' : 'Eliminar curso'}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 24px', lineHeight: '1.5' }}>
              ¿Eliminar <strong style={{ color: '#fff' }}>"{confirm.nombre}"</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button style={s.secondaryBtn} onClick={() => setConfirm(null)}>Cancelar</button>
              <button style={s.dangerBtn} onClick={ejecutarConfirm}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal reporte estadístico ── */}
      {showReporte && reporte && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '960px' }}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>📊 Reporte Estadístico — {cursoEntregas?.nombre}</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>Generado por IA · {entregas.filter(e => e.estado === 'evaluado').length} entregas evaluadas</p>
              </div>
              <button style={s.closeBtn} onClick={() => setShowReporte(false)}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[
                { id: 'resumen', label: '📋 Resumen' },
                { id: 'temas', label: '📚 Temas' },
                { id: 'alumnos', label: '👥 Alumnos' },
                { id: 'plan', label: '🎯 Plan de acción' },
              ].map(tab => (
                <button key={tab.id} style={{ ...s.tabBtn, ...(tabReporte === tab.id ? s.tabBtnActive : {}) }}
                  onClick={() => setTabReporte(tab.id)}>{tab.label}</button>
              ))}
            </div>

            <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '4px' }}>

              {/* ── Tab Resumen ── */}
              {tabReporte === 'resumen' && (
                <div>
                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
                    {[
                      { label: 'Promedio', val: `${reporte.estadisticas?.promedioGeneral}/20`, color: nivelColor(reporte.estadisticas?.promedioGeneral) },
                      { label: 'Aprobación', val: `${reporte.estadisticas?.tasaAprobacion}%`, color: reporte.estadisticas?.tasaAprobacion >= 70 ? '#22c55e' : '#f59e0b' },
                      { label: 'Excelentes', val: reporte.estadisticas?.distribucion?.Excelente || 0, color: '#22c55e' },
                      { label: 'En riesgo', val: reporte.estadisticas?.distribucion?.Insuficiente || 0, color: '#ef4444' },
                    ].map((st, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: st.color }}>{st.val}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{st.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Resumen ejecutivo */}
                  <div style={{ background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                    <p style={{ color: '#a78bfa', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Diagnóstico general</p>
                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>{reporte.resumenEjecutivo}</p>
                  </div>
                  {/* Distribución */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Distribución de niveles</p>
                    {Object.entries(reporte.estadisticas?.distribucion || {}).map(([nivel, cant]) => {
                      const total = Object.values(reporte.estadisticas?.distribucion || {}).reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? Math.round((cant / total) * 100) : 0;
                      const col = nivel === 'Excelente' ? '#22c55e' : nivel === 'Bueno' ? '#3b82f6' : nivel === 'Regular' ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={nivel} style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#fff', fontSize: '13px' }}>{nivel}</span>
                            <span style={{ color: col, fontWeight: '600', fontSize: '13px' }}>{cant} ({pct}%)</span>
                          </div>
                          <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Tab Temas ── */}
              {tabReporte === 'temas' && (
                <div>
                  {reporte.temasCriticos?.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={s.subTitle}>🔴 Temas críticos (requieren refuerzo urgente)</h3>
                      {reporte.temasCriticos.map((t, i) => (
                        <div key={i} style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '12px', padding: '16px', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>{t.tema}</span>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <span style={{ color: nivelColor(t.promedio), fontWeight: '700', fontSize: '14px' }}>{t.promedio}/20</span>
                              <span style={{ color: '#f59e0b', fontSize: '12px' }}>{t.tasaAprobacion}% aprob.</span>
                            </div>
                          </div>
                          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 8px' }}>{t.diagnostico}</p>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {t.estrategiasDocente?.map((est, j) => (
                              <span key={j} style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', padding: '3px 10px', borderRadius: '6px', fontSize: '11px' }}>💡 {est}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {reporte.temasDestacados?.length > 0 && (
                    <div>
                      <h3 style={s.subTitle}>🟢 Temas destacados</h3>
                      {reporte.temasDestacados.map((t, i) => (
                        <div key={i} style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ color: '#fff', fontWeight: '600', fontSize: '13px' }}>{t.tema}</span>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '4px 0 0' }}>{t.observacion}</p>
                          </div>
                          <span style={{ color: '#22c55e', fontWeight: '800', fontSize: '16px', flexShrink: 0, marginLeft: '12px' }}>{t.promedio}/20</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab Alumnos ── */}
              {tabReporte === 'alumnos' && (
                <div>
                  <h3 style={s.subTitle}>Reporte individual por alumno</h3>
                  {reporte.reporteAlumnos?.sort((a, b) => a.promedio - b.promedio).map((al, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${perfilColor(al.perfil)}33`, borderRadius: '12px', padding: '16px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <span style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>{al.alumno}</span>
                          <span style={{ marginLeft: '10px', background: `${perfilColor(al.perfil)}22`, color: perfilColor(al.perfil), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{al.perfil}</span>
                        </div>
                        <span style={{ color: nivelColor(al.promedio), fontWeight: '800', fontSize: '16px' }}>{al.promedio}/20</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        {al.fortalezas?.length > 0 && (
                          <div>
                            <p style={{ color: '#22c55e', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fortalezas</p>
                            {al.fortalezas.map((f, j) => <p key={j} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '0 0 2px' }}>• {f}</p>)}
                          </div>
                        )}
                        {al.debilidades?.length > 0 && (
                          <div>
                            <p style={{ color: '#f59e0b', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Áreas a mejorar</p>
                            {al.debilidades.map((d, j) => <p key={j} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '0 0 2px' }}>• {d}</p>)}
                          </div>
                        )}
                      </div>
                      {al.recomendacionPersonalizada && (
                        <div style={{ background: 'rgba(102,126,234,0.08)', borderRadius: '8px', padding: '10px 12px' }}>
                          <p style={{ color: '#a78bfa', fontSize: '11px', margin: '0 0 4px' }}>💬 Recomendación</p>
                          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: 0, fontStyle: 'italic' }}>{al.recomendacionPersonalizada}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Tab Plan ── */}
              {tabReporte === 'plan' && (
                <div>
                  {reporte.recomendacionesDocente?.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={s.subTitle}>Acciones recomendadas para el docente</h3>
                      {reporte.recomendacionesDocente.map((r, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${prioridadColor(r.prioridad)}33`, borderRadius: '12px', padding: '14px 16px', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            <span style={{ background: `${prioridadColor(r.prioridad)}22`, color: prioridadColor(r.prioridad), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>{r.prioridad}</span>
                            <span style={{ color: '#fff', fontWeight: '600', fontSize: '13px' }}>{r.accion}</span>
                          </div>
                          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0 }}>{r.justificacion}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {reporte.planRefuerzo && (
                    <div style={{ background: 'rgba(102,126,234,0.06)', border: '1px solid rgba(102,126,234,0.15)', borderRadius: '12px', padding: '16px' }}>
                      <h3 style={{ ...s.subTitle, marginTop: 0 }}>🎯 Plan de refuerzo</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <p style={{ color: '#a78bfa', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Temas a reforzar</p>
                          {reporte.planRefuerzo.temasReforzar?.map((t, i) => <p key={i} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '0 0 4px' }}>📌 {t}</p>)}
                        </div>
                        <div>
                          <p style={{ color: '#a78bfa', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Metodologías sugeridas</p>
                          {reporte.planRefuerzo.metodologiasSugeridas?.map((m, i) => <p key={i} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '0 0 4px' }}>💡 {m}</p>)}
                        </div>
                      </div>
                      {reporte.planRefuerzo.alumnosEnRiesgo?.length > 0 && (
                        <div style={{ marginTop: '16px', background: 'rgba(239,68,68,0.08)', borderRadius: '10px', padding: '12px' }}>
                          <p style={{ color: '#ef4444', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>⚠️ Alumnos en riesgo</p>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {reporte.planRefuerzo.alumnosEnRiesgo.map((a, i) => (
                              <span key={i} style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '3px 10px', borderRadius: '6px', fontSize: '12px' }}>{a}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button style={{ ...s.primaryBtn, width: '100%', marginTop: '20px' }} onClick={() => setShowReporte(false)}>Cerrar reporte</button>
          </div>
        </div>
      )}

      {/* ── Modal entregas agrupadas ── */}
      {cursoEntregas && !entregaDetalle && !showReporte && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '940px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>📋 Entregas — {cursoEntregas.nombre}</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
                  Sección {cursoEntregas.seccion} · {cursoEntregas.ciclo} · {entregas.length} entregas · {grupos.length} temas
                </p>
              </div>
              <button style={s.closeBtn} onClick={() => setCursoEntregas(null)}>✕</button>
            </div>

            {/* Filtros + acciones */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={{ ...s.input, flex: 1, minWidth: '160px' }}
                placeholder="🔍 Buscar alumno..."
                value={filtroAlumno} onChange={e => setFiltroAlumno(e.target.value)} />
              <select style={{ ...s.select, width: '180px' }} value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value)}>
                <option value="">Todos los tipos</option>
                {tiposUnicos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {grupos.length > 1 && (
                <button style={s.secondaryBtn} onClick={() => {
                  const allExp = grupos.every(([k]) => gruposExpandidos[k] !== false);
                  const next = {}; grupos.forEach(([k]) => { next[k] = !allExp; });
                  setGruposExpandidos(next);
                }}>
                  {grupos.every(([k]) => gruposExpandidos[k] !== false) ? '⊖ Colapsar' : '⊕ Expandir'}
                </button>
              )}
              <button
                style={{ ...s.primaryBtn, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', opacity: generandoReporte ? 0.7 : 1 }}
                onClick={handleGenerarReporte}
                disabled={generandoReporte}>
                {generandoReporte ? '⏳ Generando...' : '📊 Reporte IA'}
              </button>
            </div>
            {msgReporte && <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 12px' }}>{msgReporte}</p>}

            {grupos.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px' }}>
                No hay entregas{filtroAlumno || filtroTipo ? ' con ese filtro' : ' aún'}
              </p>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '10px',
                flex: 1,
                minHeight: 0,
                height: '100%',
                overflowY: 'auto',
                paddingRight: '8px',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(167,139,250,0.5) rgba(255,255,255,0.06)',
              }}>
                {grupos.map(([tema, items]) => {
                  const expandido = gruposExpandidos[tema] !== false;
                  const stats = grupoStats(items);
                  const promColor = stats.promedio ? nivelColor(parseFloat(stats.promedio)) : 'rgba(255,255,255,0.3)';

                  return (
                    <div key={tema} style={s.grupoCard}>
                      <button style={s.grupoHeader} onClick={() => toggleGrupo(tema)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{expandido ? '▾' : '▸'}</span>
                          <span style={{ color: '#fff', fontWeight: '700', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tema}</span>
                          <span style={s.tipoBadge}>{items[0]?.tipoEvaluacion || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0 }}>
                          {stats.promedio && (
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ color: promColor, fontWeight: '700', fontSize: '14px' }}>{stats.promedio}/20</div>
                              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>promedio</div>
                            </div>
                          )}
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#a78bfa', fontWeight: '700', fontSize: '14px' }}>{stats.evaluados}/{stats.total}</div>
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>evaluados</div>
                          </div>
                        </div>
                      </button>

                      {expandido && (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ ...s.table, marginTop: '2px' }}>
                            <thead>
                              <tr>
                                {['#', 'Alumno', 'Nota', 'Nivel', 'IA', 'Archivo', 'Fecha', ''].map(h => (
                                  <th key={h} style={s.th}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((e, i) => {
                                const bs = e.porcentajeIA != null ? iaBadgeStyle(e.porcentajeIA) : null;
                                return (
                                  <tr key={e.id || i} style={{ ...s.tr, cursor: 'pointer' }}
                                    onClick={() => { setEntregaDetalle(e); setEditandoNota(false); setMsgNota(''); }}>
                                    <td style={{ ...s.td, width: '28px', color: 'rgba(255,255,255,0.3)', fontWeight: '600' }}>{i + 1}</td>
                                    <td style={s.td}>
                                      <span style={{ color: '#fff', fontWeight: '600', fontSize: '13px' }}>{e.alumnoNombre || '—'}</span>
                                    </td>
                                    <td style={s.td}>
                                      {e.estado === 'evaluado' ? (
                                        <span style={{ ...s.badge, background: e.notaFinal >= 14 ? '#22c55e22' : e.notaFinal >= 11 ? '#f59e0b22' : '#ef444422', color: e.notaFinal >= 14 ? '#22c55e' : e.notaFinal >= 11 ? '#f59e0b' : '#ef4444' }}>
                                          {e.notaFinal}/20{e.notaEditadaManualmente ? ' ✏️' : ''}
                                        </span>
                                      ) : <span style={{ color: '#f59e0b', fontSize: '12px' }}>⏳ Pendiente</span>}
                                    </td>
                                    <td style={s.td}><span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px' }}>{e.nivelGlobal || '—'}</span></td>
                                    <td style={s.td}>
                                      {bs ? <span style={bs}>{iaLabel(e.porcentajeIA)}</span> : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>—</span>}
                                    </td>
                                    <td style={s.td}>
                                      {e.archivoUrl ? (
                                        <a href={e.archivoUrl} target="_blank" rel="noreferrer"
                                          onClick={ev => ev.stopPropagation()}
                                          style={{ color: '#a78bfa', fontSize: '11px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {e.archivoNombre?.toLowerCase().endsWith('.docx') ? '📝' : '📄'} {e.archivoNombre || 'Ver'}
                                        </a>
                                      ) : e.archivoNombre ? (
                                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>📄 {e.archivoNombre}</span>
                                      ) : '—'}
                                    </td>
                                    <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                                        {e.creadoEn?.toDate?.()?.toLocaleDateString('es-PE') || '—'}
                                      </span>
                                    </td>
                                    <td style={s.td} onClick={ev => ev.stopPropagation()}>
                                      <button style={s.expulsarBtn} onClick={() => handleEliminarEntregaDocente(e)}>🗑</button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button style={{ ...s.primaryBtn, width: '100%', marginTop: '16px' }} onClick={() => setCursoEntregas(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Modal detalle entrega ── */}
      {entregaDetalle && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '800px' }}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>{entregaDetalle.titulo}</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
                  👤 {entregaDetalle.alumnoNombre} · {entregaDetalle.tipoEvaluacion}
                  {entregaDetalle.actividadTitulo && ` · ${entregaDetalle.actividadTitulo}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={s.expulsarBtn} onClick={() => handleEliminarEntregaDocente(entregaDetalle)}>🗑</button>
                <button style={s.closeBtn} onClick={() => setEntregaDetalle(null)}>✕</button>
              </div>
            </div>

            {/* Badge IA si existe */}
            {entregaDetalle.porcentajeIA != null && (
              <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px 16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>🤖 Análisis de contenido generado por IA</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ ...iaBadgeStyle(entregaDetalle.porcentajeIA), fontSize: '16px', padding: '4px 12px' }}>
                      {iaLabel(entregaDetalle.porcentajeIA)} — {entregaDetalle.iaVeredicto || ''}
                    </span>
                  </div>
                  {entregaDetalle.iaObservacion && (
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0, flex: 1 }}>{entregaDetalle.iaObservacion}</p>
                  )}
                </div>
                {entregaDetalle.iaIndicadores?.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {entregaDetalle.iaIndicadores.map((ind, i) => (
                      <span key={i} style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', padding: '2px 8px', borderRadius: '6px', fontSize: '11px' }}>{ind}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Nota */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
              {!editandoNota ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ textAlign: 'center' }}>
                    {entregaDetalle.estado === 'evaluado' ? (
                      <>
                        <div style={{ fontSize: '48px', fontWeight: '800', color: nivelColor(entregaDetalle.notaFinal) }}>
                          {entregaDetalle.notaFinal}<span style={{ fontSize: '20px', opacity: 0.5 }}>/20</span>
                        </div>
                        <div style={{ color: nivelColor(entregaDetalle.notaFinal), fontWeight: '600', fontSize: '16px' }}>
                          {entregaDetalle.nivelGlobal}
                          {entregaDetalle.notaEditadaManualmente && <span style={{ color: '#60a5fa', fontSize: '12px', marginLeft: '8px' }}>✏️ Editada</span>}
                        </div>
                        {entregaDetalle.comentarioDocente && <p style={{ color: '#93c5fd', fontSize: '13px', margin: '6px 0 0', fontStyle: 'italic' }}>"{entregaDetalle.comentarioDocente}"</p>}
                      </>
                    ) : <span style={{ color: '#f59e0b', fontSize: '16px' }}>⏳ Sin evaluar</span>}
                  </div>
                  <button style={s.editarNotaBtn} onClick={abrirEditarNota}>✏️ {entregaDetalle.estado === 'evaluado' ? 'Modificar nota' : 'Asignar nota'}</button>
                </div>
              ) : (
                <div>
                  <p style={{ color: '#a78bfa', fontSize: '13px', fontWeight: '600', margin: '0 0 12px' }}>✏️ Editar nota del alumno</p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <div>
                      <label style={s.labelSmall}>Nueva nota (0–20)</label>
                      <input style={{ ...s.input, width: '100px', fontSize: '18px', fontWeight: '700', textAlign: 'center' }}
                        type="number" min="0" max="20" step="0.5" value={notaEditada} onChange={e => setNotaEditada(e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={s.labelSmall}>Comentario (opcional)</label>
                      <input style={s.input} placeholder="Ej: Revisión manual..." value={comentarioDocente} onChange={e => setComentarioDocente(e.target.value)} />
                    </div>
                  </div>
                  {msgNota && <p style={{ color: msgNota.includes('✅') ? '#22c55e' : '#ef4444', fontSize: '13px', margin: '0 0 10px' }}>{msgNota}</p>}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button style={s.secondaryBtn} onClick={() => { setEditandoNota(false); setMsgNota(''); }}>Cancelar</button>
                    <button style={s.primaryBtn} onClick={handleGuardarNota} disabled={guardandoNota}>{guardandoNota ? 'Guardando...' : '💾 Guardar nota'}</button>
                  </div>
                </div>
              )}
            </div>

            {/* Criterios */}
            {entregaDetalle.criterios?.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Detalle por criterios</h3>
                {entregaDetalle.criterios.map((c, i) => (
                  <div key={i} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{c.nombre}</span>
                      <span style={{ color: nivelColor(c.puntajeObtenido / c.puntajeMaximo * 20), fontWeight: '600', fontSize: '13px' }}>{c.puntajeObtenido}/{c.puntajeMaximo} — {c.nivel}</span>
                    </div>
                    <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(c.puntajeObtenido / c.puntajeMaximo) * 100}%`, background: nivelColor(c.puntajeObtenido / c.puntajeMaximo * 20), borderRadius: '3px' }} />
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '3px 0 0' }}>{c.comentario}</p>
                  </div>
                ))}
              </div>
            )}

            {entregaDetalle.retroalimentacionGeneral && (
              <div style={{ background: 'rgba(102,126,234,0.08)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                <p style={{ color: '#a78bfa', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Retroalimentación IA</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>{entregaDetalle.retroalimentacionGeneral}</p>
              </div>
            )}

            {/* Visor archivo */}
            <div style={s.trabajoBox}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>📄 Trabajo entregado</p>
              {entregaDetalle.archivoUrl ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '10px' }}>
                    <a href={entregaDetalle.archivoUrl} target="_blank" rel="noreferrer"
                      style={{ color: '#a78bfa', fontSize: '13px', fontWeight: '600', textDecoration: 'none', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', padding: '6px 14px', borderRadius: '8px' }}>
                      🔗 Abrir en pestaña
                    </a>
                    <a href={entregaDetalle.archivoUrl} download={entregaDetalle.archivoNombre}
                      style={{ color: '#22c55e', fontSize: '13px', fontWeight: '600', textDecoration: 'none', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', padding: '6px 14px', borderRadius: '8px' }}>
                      ⬇ Descargar
                    </a>
                  </div>
                  {esDocxArchivo(entregaDetalle.archivoNombre) ? (
                    <iframe key={entregaDetalle.id} title="Trabajo alumno"
                      src={`https://docs.google.com/gview?url=${encodeURIComponent(entregaDetalle.archivoUrl)}&embedded=true`}
                      style={{ width: '100%', height: '560px', border: 'none', borderRadius: '10px', background: '#fff' }} allowFullScreen />
                  ) : (
                    <object key={entregaDetalle.id} data={`${entregaDetalle.archivoUrl}#toolbar=1&navpanes=0`} type="application/pdf"
                      style={{ width: '100%', height: '560px', borderRadius: '10px', border: 'none' }}>
                      <div style={{ padding: '32px', textAlign: 'center' }}>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '12px' }}>El navegador no puede mostrar el PDF aquí.</p>
                        <a href={entregaDetalle.archivoUrl} target="_blank" rel="noreferrer" style={{ color: '#a78bfa', fontWeight: '600' }}>📄 Abrir PDF →</a>
                      </div>
                    </object>
                  )}
                </div>
              ) : entregaDetalle.texto ? (
                <div style={s.textoTrabajo}>{entregaDetalle.texto}</div>
              ) : (
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Sin contenido disponible</p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button style={s.secondaryBtn} onClick={() => { setEntregaDetalle(null); setEditandoNota(false); }}>← Volver a lista</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal solicitudes ── */}
      {cursoPendientes && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>{cursoPendientes.nombre}</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>Sección {cursoPendientes.seccion} · {cursoPendientes.ciclo}</p>
              </div>
              <button style={s.closeBtn} onClick={() => setCursoPendientes(null)}>✕</button>
            </div>
            <div style={s.seccion}>
              <h3 style={s.seccionTitle}>⏳ Solicitudes pendientes {pendientes.length > 0 && <span style={s.badgeRed}>{pendientes.length}</span>}</h3>
              {pendientes.length === 0 ? <p style={s.emptyText}>Sin solicitudes pendientes</p>
                : pendientes.map((m, i) => (
                  <div key={i} style={s.alumnoRow}>
                    <div style={s.alumnoInfo}>
                      <span style={s.alumnoAvatar}>👤</span>
                      <div><p style={s.alumnoNombre}>{m.alumnoNombre}</p><p style={s.alumnoEmail}>{m.alumnoEmail}</p></div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={s.aprobarBtn} onClick={() => handleAprobar(m.id)}>✓ Aprobar</button>
                      <button style={s.rechazarBtn} onClick={() => handleRechazar(m.id)}>✕ Rechazar</button>
                    </div>
                  </div>
                ))}
            </div>
            <div style={s.seccion}>
              <h3 style={s.seccionTitle}>✅ Alumnos aprobados {aprobados.length > 0 && <span style={s.badgeGreen}>{aprobados.length}</span>}</h3>
              {aprobados.length === 0 ? <p style={s.emptyText}>Sin alumnos aprobados aún</p>
                : aprobados.map((m, i) => (
                  <div key={i} style={s.alumnoRowAprobado}>
                    <span style={s.alumnoAvatar}>👤</span>
                    <div style={{ flex: 1 }}><p style={s.alumnoNombre}>{m.alumnoNombre}</p><p style={s.alumnoEmail}>{m.alumnoEmail}</p></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: '#22c55e', fontSize: '13px' }}>✓ Aprobado</span>
                      <button style={s.expulsarBtn} onClick={() => handleExpulsarAlumno(m)}>🗑</button>
                    </div>
                  </div>
                ))}
            </div>
            <button style={{ ...s.primaryBtn, width: '100%' }} onClick={() => setCursoPendientes(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Modal actividades ── */}
      {cursoActividades && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '720px' }}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>📝 Actividades — {cursoActividades.nombre}</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>Sección {cursoActividades.seccion} · {cursoActividades.ciclo}</p>
              </div>
              <button style={s.closeBtn} onClick={() => { setCursoActividades(null); setShowActForm(false); }}>✕</button>
            </div>
            {msgAct && <div style={{ color: msgAct.includes('✅') ? '#22c55e' : '#ef4444', marginBottom: '16px', fontSize: '13px', background: msgAct.includes('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '8px' }}>{msgAct}</div>}
            {actividades.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Actividades publicadas ({actividades.length})</h3>
                {actividades.map((a, i) => {
                  const fl = fechaLimiteDisplay(a.fechaLimite);
                  return (
                    <div key={i} style={s.actividadRow}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>{a.titulo}</span>
                          <span style={s.tipoBadge}>{a.tipoEvaluacion}</span>
                          {a.enunciadoNombre && <span style={s.archivoBadge}>📄 {a.enunciadoNombre}</span>}
                          {a.rubricaId && <span style={s.rubricaBadge}>📋 Rúbrica</span>}
                          {fl && (
                            <span style={{ background: fl.vencida ? 'rgba(239,68,68,0.15)' : fl.diff <= 2 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.1)', color: fl.vencida ? '#ef4444' : fl.diff <= 2 ? '#f59e0b' : '#22c55e', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                              📅 {fl.vencida ? 'Vencida' : `${fl.diff}d restantes`} · {new Date(a.fechaLimite).toLocaleDateString('es-PE')}
                            </span>
                          )}
                        </div>
                        {a.descripcion && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0, lineHeight: '1.4' }}>{a.descripcion.substring(0, 120)}{a.descripcion.length > 120 ? '…' : ''}</p>}
                      </div>
                      {editingActividadId === a.id ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input type="datetime-local" style={{ ...s.input, padding: '6px 8px', height: '36px' }} value={editFecha} onChange={e => setEditFecha(e.target.value)} />
                          <button style={s.primaryBtn} disabled={guardandoAct} onClick={handleGuardarFecha}>Guardar</button>
                          <button style={s.secondaryBtn} onClick={handleCancelarEditar}>Cancelar</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button style={s.secondaryBtn} onClick={() => handleEditarActividad(a)}>✏️</button>
                          <button style={s.expulsarBtn} onClick={() => handleEliminarActividad(a)}>🗑</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {actividades.length === 0 && !showActForm && <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>No hay actividades publicadas aún</div>}
            {showActForm ? (
              <div style={s.actForm}>
                <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: '600', margin: '0 0 16px' }}>Nueva actividad</h3>
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Título *</label>
                    <input style={s.input} placeholder="Ej: Práctica Calificada 1" value={formAct.titulo} onChange={e => setFormAct(f => ({ ...f, titulo: e.target.value }))} />
                  </div>
                  <div>
                    <label style={s.label}>Tipo de evaluación *</label>
                    <select style={s.select} value={formAct.tipoEvaluacion} onChange={e => setFormAct(f => ({ ...f, tipoEvaluacion: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {cursoActividades.tiposEvaluacion?.map((t, i) => <option key={i} value={t.nombre}>{t.nombre} ({t.peso}%)</option>)}
                    </select>
                  </div>
                </div>
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Descripción breve</label>
                    <input style={s.input} placeholder="Ej: Resolver ejercicios de los temas 3 y 4" value={formAct.descripcion} onChange={e => setFormAct(f => ({ ...f, descripcion: e.target.value }))} />
                  </div>
                  <div>
                    <label style={s.label}>📅 Fecha límite</label>
                    <input style={s.input} type="datetime-local" value={formAct.fechaLimite} onChange={e => setFormAct(f => ({ ...f, fechaLimite: e.target.value }))} />
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '4px' }}>Los alumnos verán cuánto tiempo les queda</p>
                  </div>
                </div>
                <div style={s.enunciadoBox}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={s.label}>📄 Enunciado / Guía</label>
                    <label style={s.uploadBtn}>
                      {leyendoAct ? '⏳ Leyendo...' : formAct.enunciadoNombre ? `✅ ${formAct.enunciadoNombre}` : '📎 Subir PDF'}
                      <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleEnunciadoPDF} />
                    </label>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0 }}>La IA usará este enunciado para evaluar si el alumno respondió lo que se pidió</p>
                  {!formAct.enunciadoNombre && (
                    <textarea style={{ ...s.textarea, marginTop: '10px', minHeight: '80px' }}
                      placeholder="O escribe el enunciado directamente aquí..."
                      value={formAct.enunciadoTexto} onChange={e => setFormAct(f => ({ ...f, enunciadoTexto: e.target.value }))} />
                  )}
                </div>
                {rubricas.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={s.label}>Rúbrica de evaluación</label>
                    <select style={s.select} value={formAct.rubricaId} onChange={e => setFormAct(f => ({ ...f, rubricaId: e.target.value }))}>
                      <option value="">Sin rúbrica específica</option>
                      {rubricas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button style={s.secondaryBtn} onClick={() => { setShowActForm(false); setMsgAct(''); }}>Cancelar</button>
                  <button style={s.primaryBtn} onClick={handleGuardarActividad} disabled={guardandoAct}>{guardandoAct ? 'Publicando...' : '📢 Publicar actividad'}</button>
                </div>
              </div>
            ) : (
              <button style={{ ...s.primaryBtn, width: '100%' }} onClick={() => setShowActForm(true)}>+ Nueva actividad</button>
            )}
          </div>
        </div>
      )}

      {/* ── Modal nuevo curso ── */}
      {showForm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Nuevo Curso</h2>
              <button style={s.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div style={s.grid3}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={s.label}>Nombre del curso *</label>
                <input style={s.input} placeholder="Ej: Contabilidad General" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Sección *</label>
                <input style={s.input} placeholder="Ej: A" value={form.seccion} onChange={e => setForm(f => ({ ...f, seccion: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Código del curso *</label>
                <input style={s.input} placeholder="Ej: CONT-2024-A" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} />
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '6px' }}>Comparte este código con tus alumnos</p>
              </div>
              <div>
                <label style={s.label}>Ciclo / Semestre</label>
                <input style={s.input} placeholder="Ej: 2024-II" value={form.ciclo} onChange={e => setForm(f => ({ ...f, ciclo: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={s.label}>Descripción</label>
              <input style={s.input} placeholder="Descripción breve" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div style={s.silaboBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={s.label}>📄 Sílabo del curso</label>
                <label style={s.uploadBtn}>
                  {leyendoPDF ? '⏳ Leyendo...' : form.silaboNombre ? `✅ ${form.silaboNombre}` : '📎 Subir PDF'}
                  <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleSilaboPDF} />
                </label>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: 0 }}>La IA usará el sílabo como referencia al evaluar trabajos</p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label style={s.label}>Tipos de Evaluación y Pesos</label>
                <span style={{ color: totalPeso === 100 ? '#22c55e' : '#ef4444', fontSize: '13px', fontWeight: '600' }}>Total: {totalPeso}% {totalPeso === 100 ? '✓' : '← debe ser 100%'}</span>
              </div>
              {form.tiposEvaluacion.map((t, i) => (
                <div key={i} style={s.tipoRow}>
                  <input style={{ ...s.input, flex: 2 }} placeholder="Nombre (ej: Tareas)" value={t.nombre} onChange={e => updateTipo(i, 'nombre', e.target.value)} />
                  <input style={{ ...s.input, width: '70px', textAlign: 'center' }} type="number" min="0" max="100" value={t.peso} onChange={e => updateTipo(i, 'peso', e.target.value)} />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>%</span>
                  <button onClick={() => setForm(f => ({ ...f, tiposEvaluacion: f.tiposEvaluacion.filter((_, idx) => idx !== i) }))} style={s.removeBtn}>✕</button>
                </div>
              ))}
              <button onClick={() => setForm(f => ({ ...f, tiposEvaluacion: [...f.tiposEvaluacion, { nombre: '', peso: 0 }] }))} style={s.addTipoBtn}>+ Agregar tipo</button>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={s.secondaryBtn} onClick={() => setShowForm(false)}>Cancelar</button>
              <button style={s.primaryBtn} onClick={handleGuardar} disabled={guardando}>{guardando ? 'Creando...' : '🚀 Crear Curso'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#0f0c29', fontFamily: "'Segoe UI', sans-serif", padding: '32px', color: '#fff' },
  header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' },
  backBtn: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px' },
  title: { color: '#fff', fontSize: '24px', fontWeight: '700', flex: 1, margin: 0 },
  primaryBtn: { padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  secondaryBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontSize: '14px' },
  dangerBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  editarNotaBtn: { padding: '10px 20px', borderRadius: '10px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  tabBtn: { padding: '8px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  tabBtnActive: { background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', border: 'none', fontWeight: '700' },
  subTitle: { color: 'rgba(255,255,255,0.5)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px', marginTop: '20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' },
  cursoCard: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '10px' },
  cursoTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cursoIcon: { fontSize: '28px' },
  seccionBadge: { background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700' },
  deleteCursoBtn: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', padding: '4px 8px', fontSize: '14px' },
  cursoNombre: { color: '#fff', fontSize: '18px', fontWeight: '600', margin: 0 },
  cursoCiclo: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 },
  tiposList: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  tipoTag: { background: 'rgba(102,126,234,0.15)', color: '#a78bfa', padding: '3px 10px', borderRadius: '6px', fontSize: '12px' },
  silaboTag: { color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 },
  infoBox: { background: 'rgba(102,126,234,0.06)', border: '1px solid rgba(102,126,234,0.15)', borderRadius: '10px', padding: '10px 14px' },
  infoLabel: { color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  infoValue: { color: '#a78bfa', fontSize: '12px', margin: 0 },
  entregasBtn: { width: '100%', padding: '10px', borderRadius: '10px', background: 'linear-gradient(135deg,rgba(34,197,94,0.2),rgba(16,185,129,0.2))', border: '1px solid rgba(34,197,94,0.3)', color: '#34d399', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  actividadesBtn: { width: '100%', padding: '10px', borderRadius: '10px', background: 'linear-gradient(135deg,rgba(102,126,234,0.25),rgba(118,75,162,0.25))', border: '1px solid rgba(102,126,234,0.35)', color: '#a78bfa', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  solicitudesBtn: { width: '100%', padding: '10px', borderRadius: '10px', background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.15)', color: 'rgba(167,139,250,0.7)', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '32px' },
  modal: { background: '#1a1535', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '680px', border: '1px solid rgba(255,255,255,0.1)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  modalTitle: { color: '#fff', fontSize: '20px', fontWeight: '700', margin: '0 0 4px' },
  closeBtn: { background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '16px', width: '32px', height: '32px', borderRadius: '8px' },
  seccion: { marginBottom: '24px' },
  seccionTitle: { color: '#fff', fontSize: '15px', fontWeight: '600', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' },
  badgeRed: { background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '700' },
  badgeGreen: { background: 'rgba(34,197,94,0.2)', color: '#22c55e', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '700' },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: '13px' },
  alumnoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px', border: '1px solid rgba(239,68,68,0.15)' },
  alumnoRowAprobado: { display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '12px 16px', marginBottom: '8px', border: '1px solid rgba(34,197,94,0.1)' },
  alumnoInfo: { display: 'flex', alignItems: 'center', gap: '12px' },
  alumnoAvatar: { fontSize: '24px' },
  alumnoNombre: { color: '#fff', fontSize: '14px', fontWeight: '500', margin: '0 0 2px' },
  alumnoEmail: { color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 },
  aprobarBtn: { padding: '8px 16px', borderRadius: '8px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  rechazarBtn: { padding: '8px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  expulsarBtn: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', padding: '6px 10px', fontSize: '14px', flexShrink: 0 },
  actividadRow: { display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'rgba(102,126,234,0.06)', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px', border: '1px solid rgba(102,126,234,0.15)' },
  tipoBadge: { background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' },
  archivoBadge: { background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '2px 8px', borderRadius: '6px', fontSize: '11px' },
  rubricaBadge: { background: 'rgba(59,130,246,0.1)', color: '#60a5fa', padding: '2px 8px', borderRadius: '6px', fontSize: '11px' },
  actForm: { background: 'rgba(255,255,255,0.03)', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' },
  enunciadoBox: { background: 'rgba(102,126,234,0.06)', border: '1px solid rgba(102,126,234,0.15)', borderRadius: '12px', padding: '16px', marginBottom: '16px' },
  textarea: { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: '1.5' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: '600', textAlign: 'left', padding: '6px 10px', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { color: 'rgba(255,255,255,0.8)', fontSize: '13px', padding: '9px 10px' },
  badge: { padding: '3px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' },
  trabajoBox: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' },
  textoTrabajo: { color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: '1.7', whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto', padding: '4px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '16px', marginBottom: '16px' },
  label: { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' },
  labelSmall: { display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: '500', marginBottom: '6px' },
  input: { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(20,16,50,0.95)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  silaboBox: { background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '12px', padding: '16px', marginBottom: '20px' },
  uploadBtn: { display: 'inline-block', padding: '8px 16px', borderRadius: '8px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontSize: '13px', cursor: 'pointer' },
  tipoRow: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' },
  removeBtn: { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', padding: '8px 10px', fontSize: '13px' },
  addTipoBtn: { width: '100%', padding: '10px', borderRadius: '10px', border: '2px dashed rgba(102,126,234,0.3)', background: 'transparent', color: '#a78bfa', cursor: 'pointer', fontSize: '13px' },
  grupoCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(102,126,234,0.15)', borderRadius: '14px', overflow: 'hidden' },
  grupoHeader: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(102,126,234,0.08)', border: 'none', cursor: 'pointer', gap: '12px', textAlign: 'left' },
};