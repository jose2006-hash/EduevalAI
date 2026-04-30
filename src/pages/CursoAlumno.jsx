// src/pages/CursoAlumno.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getCurso, getEntregasByAlumnoYCurso, crearEntrega, eliminarEntrega,
  subirPdfEntrega, actualizarEntregaAlumno, eliminarArchivoEntrega,
  calcularNotaFinal, getRubricas, getActividadesByCurso,
  getMatriculasByAlumno, eliminarMatricula,
} from '../firebase/services.js';
import { evaluarTrabajo } from '../openai/evaluador.js';
import { useAuth } from '../components/AuthContext.jsx';

export default function CursoAlumno() {
  const { cursoId } = useParams();
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const dropRef = useRef(null);

  const [curso, setCurso] = useState(null);
  const [entregas, setEntregas] = useState([]);
  const [rubricas, setRubricas] = useState([]);
  const [actividades, setActividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [entregaSeleccionada, setEntregaSeleccionada] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [confirm, setConfirm] = useState(null); // { tipo: 'entrega'|'desmatricular', id, nombre }
  const [editEntrega, setEditEntrega] = useState(null); // entrega en edición

  const [form, setForm] = useState({
    tipoEvaluacion: '', actividadId: '', titulo: '', texto: '', rubricaId: '',
  });
  const [actividadSeleccionada, setActividadSeleccionada] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [archivoTexto, setArchivoTexto] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [tabActivo, setTabActivo] = useState('pdf');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');

  useEffect(() => { cargar(); }, [cursoId, user]);

  const cargar = async () => {
    const [c, ents, rubs, acts] = await Promise.all([
      getCurso(cursoId),
      getEntregasByAlumnoYCurso(user.uid, cursoId),
      getRubricas(cursoId),
      getActividadesByCurso(cursoId),
    ]);
    setCurso(c);
    setEntregas(ents);
    setRubricas(rubs);
    setActividades(acts);
    setLoading(false);
  };

  const actividadesFiltradas = form.tipoEvaluacion
    ? actividades.filter(a => a.tipoEvaluacion === form.tipoEvaluacion)
    : actividades;

  const handleTipoChange = (tipo) => {
    setForm(f => ({ ...f, tipoEvaluacion: tipo, actividadId: '', titulo: '' }));
    setActividadSeleccionada(null);
  };

  const handleActividadChange = (id) => {
    const act = actividades.find(a => a.id === id);
    setActividadSeleccionada(act || null);
    setForm(f => ({ ...f, actividadId: id, titulo: act ? act.titulo : '', rubricaId: act?.rubricaId || f.rubricaId }));
  };

  const leerPDF = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result
        .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
        .replace(/\s{3,}/g, '\n').substring(0, 8000);
      resolve(text);
    };
    reader.readAsText(file, 'latin1');
  });

  const procesarArchivo = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('Solo se aceptan archivos PDF'); return; }
    setLeyendo(true); setError('');
    const texto = await leerPDF(file);
    setArchivo(file); setArchivoTexto(texto); setTabActivo('pdf');
    try {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(URL.createObjectURL(file));
    } catch { /* ignore */ }
    setLeyendo(false);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = async (e) => { e.preventDefault(); setDragging(false); await procesarArchivo(e.dataTransfer.files[0]); };
  const handleFileInput = async (e) => { await procesarArchivo(e.target.files[0]); };

  const handleEnviar = async () => {
    const textoFinal = tabActivo === 'pdf' ? archivoTexto : form.texto;
    if (!textoFinal?.trim()) return setError('Sube un PDF o escribe el contenido de tu trabajo');
    if (!form.tipoEvaluacion) return setError('Selecciona el tipo de evaluación');
    if (!form.titulo.trim()) return setError('Ingresa un título para tu trabajo');
    if (actividadSeleccionada?.fechaLimite) {
      const limite = new Date(actividadSeleccionada.fechaLimite);
      if (!Number.isNaN(limite.getTime()) && new Date() > limite) {
        return setError('La fecha límite de esta actividad ya venció');
      }
    }
    setError(''); setEnviando(true); setMsg('');
    try {
      const rubrica = rubricas.find(r => r.id === form.rubricaId) || rubricas[0];
      const enunciadoTexto = actividadSeleccionada?.enunciadoTexto || '';
      let resultado = null;
      if (rubrica) {
        resultado = await evaluarTrabajo(
          textoFinal, rubrica, curso.nombre, form.titulo,
          curso.silaboTexto || '', enunciadoTexto
        );
      }
      if (editEntrega) {
        // Si existía PDF y se reemplaza o se cambia a texto, limpiar storage anterior
        const cambiarATexto = tabActivo === 'texto';
        const reemplazaPdf = tabActivo === 'pdf' && !!archivo;
        if ((cambiarATexto || reemplazaPdf) && editEntrega.archivoPath) {
          await eliminarArchivoEntrega(editEntrega.archivoPath);
        }

        const baseUpdate = {
          tipoEvaluacion: form.tipoEvaluacion,
          actividadId: form.actividadId || null,
          actividadTitulo: actividadSeleccionada?.titulo || null,
          titulo: form.titulo,
          texto: textoFinal,
          rubricaId: rubrica?.id || null,
          rubricaNombre: rubrica?.nombre || null,
          estado: resultado ? 'evaluado' : 'pendiente',
          // reset campos de archivo (se vuelven a setear si subimos PDF)
          ...(tabActivo === 'texto' ? { archivoNombre: null, archivoUrl: null, archivoPath: null, archivoMime: null, archivoSize: null } : {}),
          ...(resultado || {}),
        };

        await actualizarEntregaAlumno(editEntrega.id, baseUpdate);
        if (tabActivo === 'pdf' && archivo) {
          const pdfData = await subirPdfEntrega({ file: archivo, entregaId: editEntrega.id, alumnoUid: user.uid, cursoId });
          await actualizarEntregaAlumno(editEntrega.id, pdfData);
        }

        setMsg('✅ Entrega actualizada');
        setEditEntrega(null);
        setShowForm(false); resetForm(); await cargar();
        return;
      }

      const nueva = await crearEntrega({
        alumnoUid: user.uid, alumnoNombre: userData.nombre,
        cursoId, cursoNombre: curso.nombre,
        tipoEvaluacion: form.tipoEvaluacion,
        actividadId: form.actividadId || null,
        actividadTitulo: actividadSeleccionada?.titulo || null,
        titulo: form.titulo, texto: textoFinal,
        archivoNombre: archivo?.name || null,
        rubricaId: rubrica?.id || null, rubricaNombre: rubrica?.nombre || null,
        estado: resultado ? 'evaluado' : 'pendiente',
        ...(resultado || {}),
      });

      if (tabActivo === 'pdf' && archivo) {
        const pdfData = await subirPdfEntrega({ file: archivo, entregaId: nueva.id, alumnoUid: user.uid, cursoId });
        await actualizarEntregaAlumno(nueva.id, pdfData);
      }
      setMsg('✅ Trabajo enviado y evaluado correctamente');
      setShowForm(false); resetForm(); await cargar();
    } catch (err) {
      setError('Error al evaluar: ' + err.message);
    } finally { setEnviando(false); }
  };

  const resetForm = () => {
    setForm({ tipoEvaluacion: '', actividadId: '', titulo: '', texto: '', rubricaId: '' });
    setActividadSeleccionada(null);
    setArchivo(null); setArchivoTexto(''); setError(''); setTabActivo('pdf');
    try { if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl); } catch { /* ignore */ }
    setPdfPreviewUrl('');
  };

  // ── Eliminar entrega ───────────────────────────────────────────────────────
  const handleEliminarEntrega = (e) => {
    setEntregaSeleccionada(null);
    setConfirm({ tipo: 'entrega', id: e.id, nombre: e.titulo });
  };

  const handleEditarEntrega = (e) => {
    setEntregaSeleccionada(null);
    setEditEntrega(e);
    setShowForm(true);
    setMsg('');
    setError('');
    setForm({
      tipoEvaluacion: e.tipoEvaluacion || '',
      actividadId: e.actividadId || '',
      titulo: e.titulo || '',
      texto: e.texto || '',
      rubricaId: e.rubricaId || '',
    });
    const act = e.actividadId ? actividades.find(a => a.id === e.actividadId) : null;
    setActividadSeleccionada(act || null);
    setArchivo(null);
    setArchivoTexto(e.texto || '');
    setTabActivo(e.archivoUrl ? 'pdf' : 'texto');
    setPdfPreviewUrl(e.archivoUrl || '');
  };

  // ── Desmatricularse ────────────────────────────────────────────────────────
  const handleDesmatricularse = async () => {
    setConfirm({ tipo: 'desmatricular', id: null, nombre: curso?.nombre });
  };

  const ejecutarConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.tipo === 'entrega') {
        await eliminarEntrega(confirm.id);
        setMsg('✅ Entrega eliminada');
        await cargar();
      } else if (confirm.tipo === 'desmatricular') {
        const mats = await getMatriculasByAlumno(user.uid);
        const mat = mats.find(m => m.cursoId === cursoId);
        if (mat) await eliminarMatricula(mat.id);
        navigate('/mis-cursos');
      }
    } catch (err) {
      setMsg('❌ Error: ' + err.message);
    }
    setConfirm(null);
  };

  const nivelColor = (nota) => {
    if (!nota && nota !== 0) return '#667eea';
    if (nota >= 17) return '#22c55e';
    if (nota >= 14) return '#3b82f6';
    if (nota >= 11) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) return (
    <div style={{ ...s.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)' }}>Cargando curso...</p>
    </div>
  );

  const notaFinal = calcularNotaFinal(entregas, curso?.tiposEvaluacion || []);
  const entregasPorTipo = {};
  curso?.tiposEvaluacion?.forEach(t => {
    entregasPorTipo[t.nombre] = entregas.filter(e => e.tipoEvaluacion === t.nombre);
  });

  return (
    <div style={s.container}>
      <header style={s.header}>
        <button onClick={() => navigate('/mis-cursos')} style={s.backBtn}>← Mis Cursos</button>
        <div style={{ flex: 1 }}>
          <h1 style={s.title}>{curso?.nombre}</h1>
          <p style={s.subtitle}>{curso?.docenteNombre} · Sección {curso?.seccion} · {curso?.ciclo}</p>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <div>
            <p style={s.notaLabel}>Nota final ponderada</p>
            <p style={{ ...s.notaValue, color: nivelColor(notaFinal) }}>
              {notaFinal !== null ? `${notaFinal}/20` : '—'}
            </p>
          </div>
          <button style={s.desmatricularBtn} onClick={handleDesmatricularse}>
            🚪 Salir del curso
          </button>
        </div>
      </header>

      {msg && <div style={s.successMsg}>{msg}</div>}

      {/* Pesos por tipo */}
      <div style={s.pesosRow}>
        {curso?.tiposEvaluacion?.map((t, i) => {
          const ents = (entregasPorTipo[t.nombre] || []).filter(e => e.estado === 'evaluado');
          const prom = ents.length
            ? (ents.reduce((sum, e) => sum + (e.notaFinal || 0), 0) / ents.length).toFixed(1)
            : null;
          const actsDelTipo = actividades.filter(a => a.tipoEvaluacion === t.nombre);
          return (
            <div key={i} style={s.pesoCard}>
              <p style={s.pesoNombre}>{t.nombre}</p>
              <p style={s.pesoPct}>{t.peso}%</p>
              <p style={{ ...s.pesoNota, color: nivelColor(prom) }}>{prom ? `${prom}/20` : '—'}</p>
              <p style={s.pesoCount}>{ents.length} entrega{ents.length !== 1 ? 's' : ''}</p>
              {actsDelTipo.length > 0 && (
                <p style={s.pesoActs}>{actsDelTipo.length} actividad{actsDelTipo.length !== 1 ? 'es' : ''}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Actividades disponibles */}
      {actividades.length > 0 && (
        <div style={s.actividadesSection}>
          <h3 style={s.actividadesTitle}>📋 Actividades del docente</h3>
          <div style={s.actividadesGrid}>
            {actividades.map((a, i) => (
              <div key={i} style={s.actividadCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={s.actTitulo}>{a.titulo}</span>
                  <span style={s.actTipoBadge}>{a.tipoEvaluacion}</span>
                </div>
                {a.descripcion && <p style={s.actDesc}>{a.descripcion}</p>}
                {a.enunciadoNombre && <p style={s.actArchivo}>📄 Enunciado: {a.enunciadoNombre}</p>}
                {a.fechaLimite && (
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '2px 0 0' }}>
                    📅 Límite: {new Date(a.fechaLimite).toLocaleString('es-PE')}
                  </p>
                )}
                <button style={s.responderBtn} onClick={() => {
                  setShowForm(true);
                  setForm(f => ({ ...f, tipoEvaluacion: a.tipoEvaluacion, actividadId: a.id, titulo: a.titulo, rubricaId: a.rubricaId || '' }));
                  setActividadSeleccionada(a);
                }}>
                  📤 Subir mi trabajo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button style={s.primaryBtn} onClick={() => setShowForm(true)}>+ Subir trabajo libre</button>
      </div>

      {/* Entregas por tipo */}
      {curso?.tiposEvaluacion?.map((tipo, ti) => {
        const ents = entregasPorTipo[tipo.nombre] || [];
        return (
          <div key={ti} style={s.tipoSection}>
            <h3 style={s.tipoTitle}>
              {tipo.nombre}
              <span style={s.tipoPeso}>{tipo.peso}%</span>
              <span style={s.tipoCount}>{ents.length} entrega{ents.length !== 1 ? 's' : ''}</span>
            </h3>
            {ents.length === 0 ? (
              <p style={s.emptyTipo}>Sin entregas en esta categoría aún</p>
            ) : (
              <div style={s.entregasGrid}>
                {ents.map((e, i) => (
                  <div key={i} style={s.entregaCard} onClick={() => setEntregaSeleccionada(e)}>
                    <div style={s.entregaTop}>
                      <span style={s.entregaTitulo}>{e.titulo}</span>
                      <span style={{
                        ...s.estadoBadge,
                        color: e.estado === 'evaluado' ? nivelColor(e.notaFinal) : '#f59e0b',
                        background: e.estado === 'evaluado' ? `${nivelColor(e.notaFinal)}22` : '#f59e0b22',
                      }}>
                        {e.estado === 'evaluado' ? `${e.notaFinal}/20` : '⏳ Pendiente'}
                      </span>
                    </div>
                    {e.actividadTitulo && <p style={s.actividadTag}>📋 {e.actividadTitulo}</p>}
                    {e.archivoNombre && <p style={s.archivoTag}>📄 {e.archivoNombre}</p>}
                    {e.nivelGlobal && <p style={s.entregaNivel}>{e.nivelGlobal}</p>}
                    <p style={s.entregaFecha}>{e.creadoEn?.toDate?.()?.toLocaleDateString('es-PE') || '—'}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      {e.estado === 'evaluado' && <p style={{ ...s.verDetalle, margin: 0 }}>Ver retroalimentación →</p>}
                      <button style={s.deleteEntregaBtn}
                        onClick={ev => { ev.stopPropagation(); handleEliminarEntrega(e); }}
                        title="Eliminar entrega">🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Modal confirmación ── */}
      {confirm && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '420px', textAlign: 'center' }}>
            <p style={{ fontSize: '40px', margin: '0 0 12px' }}>⚠️</p>
            <h3 style={{ color: '#fff', fontSize: '18px', margin: '0 0 8px' }}>
              {confirm.tipo === 'entrega' ? 'Eliminar entrega' : 'Salir del curso'}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 24px', lineHeight: '1.5' }}>
              {confirm.tipo === 'entrega'
                ? <>¿Eliminar la entrega <strong style={{ color: '#fff' }}>"{confirm.nombre}"</strong>? No se puede deshacer.</>
                : <>¿Deseas desmatricularte de <strong style={{ color: '#fff' }}>"{confirm.nombre}"</strong>? Perderás el acceso al curso.</>
              }
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button style={s.secondaryBtn} onClick={() => setConfirm(null)}>Cancelar</button>
              <button style={s.dangerBtn} onClick={ejecutarConfirm}>
                {confirm.tipo === 'entrega' ? 'Sí, eliminar' : 'Sí, salir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal subir trabajo */}
      {showForm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editEntrega ? '✏️ Editar entrega' : '📝 Subir Trabajo'}</h2>
              <button style={s.closeBtn} onClick={() => { setShowForm(false); setEditEntrega(null); resetForm(); }}>✕</button>
            </div>
            {actividadSeleccionada && (
              <div style={s.actividadInfoBox}>
                <p style={s.actividadInfoLabel}>📋 Actividad seleccionada</p>
                <p style={s.actividadInfoTitulo}>{actividadSeleccionada.titulo}</p>
                {actividadSeleccionada.descripcion && <p style={s.actividadInfoDesc}>{actividadSeleccionada.descripcion}</p>}
                {actividadSeleccionada.enunciadoNombre && (
                  <p style={{ color: '#22c55e', fontSize: '12px', margin: '4px 0 0' }}>
                    📄 Enunciado cargado: {actividadSeleccionada.enunciadoNombre}
                  </p>
                )}
                {actividadSeleccionada.fechaLimite && (
                  <p style={{ color: '#f59e0b', fontSize: '12px', margin: '6px 0 0' }}>
                    📅 Fecha límite: {new Date(actividadSeleccionada.fechaLimite).toLocaleString('es-PE')}
                  </p>
                )}
              </div>
            )}
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Tipo de evaluación *</label>
                <select style={s.select} value={form.tipoEvaluacion} onChange={e => handleTipoChange(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {curso?.tiposEvaluacion?.map((t, i) => (
                    <option key={i} value={t.nombre}>{t.nombre} ({t.peso}%)</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={s.label}>Actividad (opcional)</label>
                <select style={s.select} value={form.actividadId}
                  onChange={e => handleActividadChange(e.target.value)} disabled={!form.tipoEvaluacion}>
                  <option value="">Sin actividad específica</option>
                  {actividadesFiltradas.map(a => <option key={a.id} value={a.id}>{a.titulo}</option>)}
                </select>
              </div>
            </div>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Título del trabajo *</label>
                <input style={s.input} placeholder="Ej: Tarea 1 - Introducción"
                  value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Rúbrica de evaluación</label>
                <select style={s.select} value={form.rubricaId}
                  onChange={e => setForm(f => ({ ...f, rubricaId: e.target.value }))}>
                  <option value="">{rubricas.length === 0 ? 'Sin rúbricas asignadas' : 'Seleccionar rúbrica...'}</option>
                  {rubricas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
            </div>
            <div style={s.tabs}>
              <button style={{ ...s.tab, ...(tabActivo === 'pdf' ? s.tabActivo : {}) }} onClick={() => setTabActivo('pdf')}>📄 Subir PDF</button>
              <button style={{ ...s.tab, ...(tabActivo === 'texto' ? s.tabActivo : {}) }} onClick={() => setTabActivo('texto')}>✏️ Escribir texto</button>
            </div>
            {tabActivo === 'pdf' && (
              <div ref={dropRef}
                style={{ ...s.dropZone, ...(dragging ? s.dropZoneActive : {}), ...(archivo ? s.dropZoneDone : {}) }}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                {leyendo ? (
                  <div style={s.dropContent}><div style={s.spinner} /><p style={s.dropText}>Leyendo archivo...</p></div>
                ) : archivo ? (
                  <div style={s.dropContent}>
                    <span style={{ fontSize: '40px' }}>✅</span>
                    <p style={{ ...s.dropText, color: '#22c55e' }}>{archivo.name}</p>
                    <p style={s.dropHint}>Archivo listo para evaluar</p>
                    <button style={s.clearBtn} onClick={() => { setArchivo(null); setArchivoTexto(''); }}>Quitar archivo</button>
                  </div>
                ) : (
                  <div style={s.dropContent}>
                    <span style={{ fontSize: '48px' }}>{dragging ? '📂' : '📄'}</span>
                    <p style={s.dropText}>{dragging ? 'Suelta el archivo aquí' : 'Arrastra tu PDF aquí'}</p>
                    <p style={s.dropHint}>o haz clic para seleccionar</p>
                    <label style={s.selectFileBtn}>
                      Seleccionar PDF
                      <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileInput} />
                    </label>
                  </div>
                )}
              </div>
            )}
            {tabActivo === 'pdf' && (pdfPreviewUrl || archivo) && (
              <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                  Vista previa del PDF
                </div>
                <iframe
                  title="Vista previa PDF"
                  src={pdfPreviewUrl}
                  style={{ width: '100%', height: '360px', border: 'none', background: '#0f0c29' }}
                />
              </div>
            )}
            {tabActivo === 'texto' && (
              <textarea style={s.textarea}
                placeholder="Escribe o pega el contenido de tu trabajo aquí..."
                value={form.texto} onChange={e => setForm(f => ({ ...f, texto: e.target.value }))} rows={12} />
            )}
            {error && <p style={s.error}>{error}</p>}
            {enviando && (
              <div style={s.evaluandoMsg}>
                <div style={s.spinner} />
                Evaluando con IA{actividadSeleccionada?.enunciadoTexto ? ' (usando enunciado del docente)' : ''}...
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button style={s.secondaryBtn} onClick={() => { setShowForm(false); setEditEntrega(null); resetForm(); }}>Cancelar</button>
              <button style={s.primaryBtn} onClick={handleEnviar} disabled={enviando}>
                {enviando ? 'Evaluando...' : (editEntrega ? '💾 Guardar cambios' : '🚀 Enviar y evaluar con IA')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle entrega */}
      {entregaSeleccionada && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '700px' }}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>{entregaSeleccionada.titulo}</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
                  {entregaSeleccionada.tipoEvaluacion} · {entregaSeleccionada.rubricaNombre}
                  {entregaSeleccionada.actividadTitulo && ` · ${entregaSeleccionada.actividadTitulo}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button style={{ ...s.secondaryBtn, padding: '6px 10px', fontSize: '13px' }}
                  onClick={() => handleEditarEntrega(entregaSeleccionada)}>✏️ Editar</button>
                <button style={s.deleteEntregaBtn} title="Eliminar esta entrega"
                  onClick={() => handleEliminarEntrega(entregaSeleccionada)}>🗑</button>
                <button style={s.closeBtn} onClick={() => setEntregaSeleccionada(null)}>✕</button>
              </div>
            </div>

            {entregaSeleccionada.archivoUrl && (
              <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden', marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px' }}>
                    📄 {entregaSeleccionada.archivoNombre || 'PDF'}
                  </span>
                  <a href={entregaSeleccionada.archivoUrl} target="_blank" rel="noreferrer"
                    style={{ color: '#a78bfa', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>
                    Abrir en nueva pestaña →
                  </a>
                </div>
                <iframe
                  title="PDF entrega"
                  src={entregaSeleccionada.archivoUrl}
                  style={{ width: '100%', height: '420px', border: 'none', background: '#0f0c29' }}
                />
              </div>
            )}

            <div style={{ textAlign: 'center', padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '20px' }}>
              <div style={{ fontSize: '56px', fontWeight: '800', color: nivelColor(entregaSeleccionada.notaFinal) }}>
                {entregaSeleccionada.notaFinal}<span style={{ fontSize: '22px', opacity: 0.5 }}>/20</span>
              </div>
              <div style={{ color: nivelColor(entregaSeleccionada.notaFinal), fontWeight: '600', fontSize: '18px' }}>
                {entregaSeleccionada.nivelGlobal}
              </div>
            </div>

            {entregaSeleccionada.criterios?.map((c, i) => (
              <div key={i} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>{c.nombre}</span>
                  <span style={{ color: nivelColor(c.puntajeObtenido / c.puntajeMaximo * 20), fontWeight: '600', fontSize: '14px' }}>
                    {c.puntajeObtenido}/{c.puntajeMaximo} — {c.nivel}
                  </span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(c.puntajeObtenido / c.puntajeMaximo) * 100}%`, background: nivelColor(c.puntajeObtenido / c.puntajeMaximo * 20), borderRadius: '3px' }} />
                </div>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: '4px 0 0', lineHeight: '1.4' }}>{c.comentario}</p>
              </div>
            ))}

            {entregaSeleccionada.retroalimentacionGeneral && (
              <div style={{ background: 'rgba(102,126,234,0.08)', borderRadius: '12px', padding: '16px', margin: '16px 0' }}>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Retroalimentación</p>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>
                  {entregaSeleccionada.retroalimentacionGeneral}
                </p>
              </div>
            )}

            <div style={s.grid2}>
              {entregaSeleccionada.fortalezas?.length > 0 && (
                <div style={{ background: 'rgba(34,197,94,0.06)', borderRadius: '10px', padding: '14px' }}>
                  <p style={{ color: '#22c55e', fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>💪 FORTALEZAS</p>
                  {entregaSeleccionada.fortalezas.map((f, i) => (
                    <p key={i} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 4px' }}>✓ {f}</p>
                  ))}
                </div>
              )}
              {entregaSeleccionada.areasDesMejora?.length > 0 && (
                <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: '10px', padding: '14px' }}>
                  <p style={{ color: '#f59e0b', fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>📈 MEJORAR</p>
                  {entregaSeleccionada.areasDesMejora.map((a, i) => (
                    <p key={i} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 4px' }}>⚠ {a}</p>
                  ))}
                </div>
              )}
            </div>

            {entregaSeleccionada.recomendaciones?.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Recomendaciones</p>
                {entregaSeleccionada.recomendaciones.map((r, i) => (
                  <p key={i} style={{ color: '#a78bfa', fontSize: '14px', margin: '0 0 6px' }}>→ {r}</p>
                ))}
              </div>
            )}

            <button style={{ ...s.primaryBtn, width: '100%', marginTop: '20px' }} onClick={() => setEntregaSeleccionada(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#0f0c29', fontFamily: "'Segoe UI', sans-serif", padding: '32px', color: '#fff' },
  header: { display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' },
  backBtn: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', flexShrink: 0 },
  title: { color: '#fff', fontSize: '22px', fontWeight: '700', margin: '0 0 4px' },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 },
  notaLabel: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 2px', textAlign: 'right' },
  notaValue: { fontSize: '32px', fontWeight: '800', margin: 0 },
  desmatricularBtn: { padding: '7px 14px', borderRadius: '9px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
  successMsg: { color: '#22c55e', fontSize: '14px', marginBottom: '16px', background: 'rgba(34,197,94,0.1)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.2)' },
  pesosRow: { display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' },
  pesoCard: { flex: 1, minWidth: '110px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' },
  pesoNombre: { color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '0 0 4px', fontWeight: '500' },
  pesoPct: { color: '#a78bfa', fontSize: '18px', fontWeight: '700', margin: '0 0 6px' },
  pesoNota: { fontSize: '20px', fontWeight: '700', margin: '0 0 4px' },
  pesoCount: { color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0 },
  pesoActs: { color: '#667eea', fontSize: '11px', margin: '4px 0 0' },
  actividadesSection: { marginBottom: '24px' },
  actividadesTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', margin: '0 0 12px' },
  actividadesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' },
  actividadCard: { background: 'rgba(102,126,234,0.08)', borderRadius: '14px', padding: '18px', border: '1px solid rgba(102,126,234,0.2)', display: 'flex', flexDirection: 'column', gap: '6px' },
  actTitulo: { color: '#fff', fontSize: '14px', fontWeight: '600', flex: 1 },
  actTipoBadge: { background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', flexShrink: 0 },
  actDesc: { color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0, lineHeight: '1.4' },
  actArchivo: { color: '#22c55e', fontSize: '11px', margin: 0 },
  responderBtn: { marginTop: '8px', padding: '9px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
  primaryBtn: { padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  secondaryBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontSize: '14px' },
  dangerBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  tipoSection: { marginBottom: '28px' },
  tipoTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '10px' },
  tipoPeso: { background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '2px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '500' },
  tipoCount: { color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontWeight: '400' },
  emptyTipo: { color: 'rgba(255,255,255,0.25)', fontSize: '13px', padding: '16px 0' },
  entregasGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' },
  entregaCard: { background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' },
  entregaTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' },
  entregaTitulo: { color: '#fff', fontSize: '14px', fontWeight: '500', flex: 1 },
  estadoBadge: { padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', flexShrink: 0 },
  actividadTag: { color: '#a78bfa', fontSize: '11px', margin: '0 0 2px' },
  archivoTag: { color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '0 0 4px' },
  entregaNivel: { color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: '0 0 4px' },
  entregaFecha: { color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0 },
  verDetalle: { color: '#a78bfa', fontSize: '12px', margin: '8px 0 0', fontWeight: '500' },
  deleteEntregaBtn: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', padding: '4px 8px', fontSize: '13px', flexShrink: 0 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '32px' },
  modal: { background: '#1a1535', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '680px', border: '1px solid rgba(255,255,255,0.1)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  modalTitle: { color: '#fff', fontSize: '18px', fontWeight: '700', margin: '0 0 4px' },
  closeBtn: { background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '16px', width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0 },
  actividadInfoBox: { background: 'rgba(102,126,234,0.1)', border: '1px solid rgba(102,126,234,0.25)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' },
  actividadInfoLabel: { color: '#a78bfa', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' },
  actividadInfoTitulo: { color: '#fff', fontSize: '15px', fontWeight: '600', margin: '0 0 4px' },
  actividadInfoDesc: { color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0, lineHeight: '1.4' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  label: { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' },
  input: { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(20,16,50,0.95)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  tabs: { display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '4px', marginBottom: '16px', gap: '4px' },
  tab: { flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  tabActivo: { background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: '600' },
  dropZone: { border: '2px dashed rgba(102,126,234,0.35)', borderRadius: '16px', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: 'rgba(102,126,234,0.04)', marginBottom: '16px', transition: 'all 0.2s' },
  dropZoneActive: { border: '2px dashed #667eea', background: 'rgba(102,126,234,0.12)' },
  dropZoneDone: { border: '2px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.06)' },
  dropContent: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
  dropText: { color: '#fff', fontSize: '16px', fontWeight: '500', margin: 0 },
  dropHint: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 },
  selectFileBtn: { display: 'inline-block', padding: '10px 20px', borderRadius: '10px', background: 'rgba(102,126,234,0.2)', border: '1px solid rgba(102,126,234,0.35)', color: '#a78bfa', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
  clearBtn: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px' },
  textarea: { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.6', fontFamily: 'inherit', boxSizing: 'border-box' },
  error: { color: '#ef4444', fontSize: '13px', marginTop: '10px' },
  evaluandoMsg: { display: 'flex', alignItems: 'center', gap: '12px', color: '#a78bfa', fontSize: '14px', marginTop: '14px', padding: '14px', background: 'rgba(102,126,234,0.1)', borderRadius: '10px' },
  spinner: { width: '18px', height: '18px', border: '2px solid rgba(167,139,250,0.3)', borderTop: '2px solid #a78bfa', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 },
};