// src/pages/GestionCursos.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCursosByDocente, crearCurso, eliminarCurso,
  getMatriculasByCurso, getPendientesByCurso,
  aprobarMatricula, rechazarMatricula, eliminarMatricula,
  crearActividad, getActividadesByCurso, eliminarActividad,
  getRubricas,
} from '../firebase/services.js';
import { useAuth } from '../components/AuthContext.jsx';

const TIPOS_DEFAULT = [
  { nombre: 'Tareas', peso: 30 },
  { nombre: 'Exámenes', peso: 40 },
  { nombre: 'Participación', peso: 20 },
  { nombre: 'Otros', peso: 10 },
];

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

  const [cursoActividades, setCursoActividades] = useState(null);
  const [actividades, setActividades] = useState([]);
  const [rubricas, setRubricas] = useState([]);
  const [showActForm, setShowActForm] = useState(false);
  const [guardandoAct, setGuardandoAct] = useState(false);
  const [msgAct, setMsgAct] = useState('');
  const [formAct, setFormAct] = useState({
    titulo: '', tipoEvaluacion: '', descripcion: '',
    enunciadoTexto: '', enunciadoNombre: '', rubricaId: '',
    fechaLimite: '',
  });
  const [leyendoAct, setLeyendoAct] = useState(false);

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
      getPendientesByCurso(curso.id),
      getMatriculasByCurso(curso.id),
    ]);
    setPendientes(pends);
    setAprobados(todos.filter(m => m.estado === 'aprobado'));
  };

  const handleAprobar = async (id) => { await aprobarMatricula(id); await abrirSolicitudes(cursoPendientes); };
  const handleRechazar = async (id) => { await rechazarMatricula(id); await abrirSolicitudes(cursoPendientes); };

  const handleExpulsarAlumno = (m) => setConfirm({ tipo: 'alumno', id: m.id, nombre: m.alumnoNombre });
  const handleEliminarActividad = (a) => setConfirm({ tipo: 'actividad', id: a.id, nombre: a.titulo });
  const handleEliminarCurso = (c) => setConfirm({ tipo: 'curso', id: c.id, nombre: c.nombre });

  const ejecutarConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.tipo === 'alumno') {
        await eliminarMatricula(confirm.id);
        await abrirSolicitudes(cursoPendientes);
        setMsg('✅ Alumno eliminado del curso');
      } else if (confirm.tipo === 'actividad') {
        await eliminarActividad(confirm.id);
        const acts = await getActividadesByCurso(cursoActividades.id);
        setActividades(acts);
        setMsgAct('✅ Actividad eliminada');
      } else if (confirm.tipo === 'curso') {
        await eliminarCurso(confirm.id);
        await cargarCursos();
        setMsg('✅ Curso eliminado');
      }
    } catch (err) { setMsg('❌ Error: ' + err.message); }
    setConfirm(null);
  };

  const abrirActividades = async (curso) => {
    setCursoActividades(curso);
    setShowActForm(false); setMsgAct('');
    const [acts, rubs] = await Promise.all([
      getActividadesByCurso(curso.id), getRubricas(curso.id),
    ]);
    setActividades(acts); setRubricas(rubs);
    setFormAct(f => ({ ...f, tipoEvaluacion: curso.tiposEvaluacion?.[0]?.nombre || '', fechaLimite: '' }));
  };

  const leerPDFActividad = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result
        .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
        .replace(/\s{3,}/g, '\n').substring(0, 8000);
      resolve(text);
    };
    reader.readAsText(file, 'latin1');
  });

  const handleEnunciadoPDF = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLeyendoAct(true);
    const texto = await leerPDFActividad(file);
    setFormAct(f => ({ ...f, enunciadoTexto: texto, enunciadoNombre: file.name }));
    setLeyendoAct(false);
  };

  const handleGuardarActividad = async () => {
    if (!formAct.titulo.trim()) return setMsgAct('❌ El título es obligatorio');
    if (!formAct.tipoEvaluacion) return setMsgAct('❌ Selecciona el tipo de evaluación');
    if (!formAct.enunciadoTexto.trim() && !formAct.descripcion.trim())
      return setMsgAct('❌ Agrega una descripción o sube el enunciado en PDF');
    setGuardandoAct(true); setMsgAct('');
    try {
      await crearActividad({
        ...formAct,
        cursoId: cursoActividades.id,
        cursoNombre: cursoActividades.nombre,
        docenteUid: userData.uid,
        docenteNombre: userData.nombre,
      });
      setMsgAct(`✅ Actividad "${formAct.titulo}" publicada`);
      setShowActForm(false);
      setFormAct({ titulo: '', tipoEvaluacion: cursoActividades.tiposEvaluacion?.[0]?.nombre || '', descripcion: '', enunciadoTexto: '', enunciadoNombre: '', rubricaId: '', fechaLimite: '' });
      const acts = await getActividadesByCurso(cursoActividades.id);
      setActividades(acts);
    } catch (err) { setMsgAct('❌ Error: ' + err.message); }
    finally { setGuardandoAct(false); }
  };

  const handleSilaboPDF = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLeyendoPDF(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result
        .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
        .replace(/\s{3,}/g, '\n').substring(0, 8000);
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
    if (!form.nombre.trim()) return setMsg('❌ El nombre del curso es obligatorio');
    if (!form.seccion.trim()) return setMsg('❌ La sección es obligatoria');
    if (!form.codigo.trim()) return setMsg('❌ El código del curso es obligatorio');
    if (totalPeso !== 100) return setMsg(`❌ Los pesos deben sumar 100% (actualmente: ${totalPeso}%)`);
    setGuardando(true); setMsg('');
    try {
      await crearCurso({ ...form, docenteUid: userData.uid, docenteNombre: userData.nombre });
      setMsg(`✅ Curso "${form.nombre} - Sección ${form.seccion}" creado`);
      await cargarCursos();
      setShowForm(false);
      setForm({ nombre: '', seccion: '', codigo: '', descripcion: '', ciclo: '', silaboTexto: '', silaboNombre: '', tiposEvaluacion: TIPOS_DEFAULT });
    } catch (err) { setMsg('❌ Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  // Helper para mostrar fecha límite con color si está vencida
  const fechaLimiteDisplay = (fechaStr) => {
    if (!fechaStr) return null;
    const fecha = new Date(fechaStr);
    const hoy = new Date();
    const vencida = fecha < hoy;
    const diff = Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
    return { fecha, vencida, diff };
  };

  return (
    <div style={s.container}>
      <header style={s.header}>
        <button onClick={() => navigate('/dashboard')} style={s.backBtn}>← Dashboard</button>
        <h1 style={s.title}>Mis Cursos</h1>
        <button style={s.primaryBtn} onClick={() => setShowForm(true)}>+ Nuevo Curso</button>
      </header>

      {msg && (
        <div style={{ color: msg.includes('✅') ? '#22c55e' : '#ef4444', marginBottom: '16px', fontSize: '14px', background: msg.includes('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '12px 16px', borderRadius: '10px' }}>
          {msg}
        </div>
      )}

      <div style={s.grid}>
        {cursos.map((c, i) => (
          <div key={i} style={s.cursoCard}>
            <div style={s.cursoTop}>
              <span style={s.cursoIcon}>📚</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {c.seccion && <span style={s.seccionBadge}>Sección {c.seccion}</span>}
                <button style={s.deleteCursoBtn} title="Eliminar curso" onClick={() => handleEliminarCurso(c)}>🗑</button>
              </div>
            </div>
            <h3 style={s.cursoNombre}>{c.nombre}</h3>
            <p style={s.cursoCiclo}>{c.ciclo && `${c.ciclo} · `}{c.descripcion}</p>
            <div style={s.tiposList}>
              {c.tiposEvaluacion?.map((t, j) => (
                <span key={j} style={s.tipoTag}>{t.nombre} {t.peso}%</span>
              ))}
            </div>
            {c.silaboNombre && <p style={s.silaboTag}>📄 {c.silaboNombre}</p>}
            <div style={s.infoBox}>
              <p style={s.infoLabel}>Los alumnos ingresan con:</p>
              <p style={s.infoValue}>Código: <strong style={{ color: '#a78bfa' }}>{c.codigo}</strong> + nombre del profesor</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <button style={s.actividadesBtn} onClick={() => abrirActividades(c)}>📝 Actividades y enunciados</button>
              <button style={s.solicitudesBtn} onClick={() => abrirSolicitudes(c)}>👥 Ver alumnos y solicitudes</button>
            </div>
          </div>
        ))}
        {cursos.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.3)', gridColumn: '1/-1', textAlign: 'center', padding: '48px' }}>
            No tienes cursos. Crea el primero.
          </p>
        )}
      </div>

      {/* ── Modal confirmación ── */}
      {confirm && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '420px', textAlign: 'center' }}>
            <p style={{ fontSize: '40px', margin: '0 0 12px' }}>⚠️</p>
            <h3 style={{ color: '#fff', fontSize: '18px', margin: '0 0 8px' }}>
              {confirm.tipo === 'alumno' ? 'Eliminar alumno' :
               confirm.tipo === 'actividad' ? 'Eliminar actividad' : 'Eliminar curso'}
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

      {/* ── Modal solicitudes ── */}
      {cursoPendientes && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>{cursoPendientes.nombre}</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
                  Sección {cursoPendientes.seccion} · {cursoPendientes.ciclo}
                </p>
              </div>
              <button style={s.closeBtn} onClick={() => setCursoPendientes(null)}>✕</button>
            </div>
            <div style={s.seccion}>
              <h3 style={s.seccionTitle}>
                ⏳ Solicitudes pendientes
                {pendientes.length > 0 && <span style={s.badgeRed}>{pendientes.length}</span>}
              </h3>
              {pendientes.length === 0 ? <p style={s.emptyText}>Sin solicitudes pendientes</p>
                : pendientes.map((m, i) => (
                  <div key={i} style={s.alumnoRow}>
                    <div style={s.alumnoInfo}>
                      <span style={s.alumnoAvatar}>👤</span>
                      <div>
                        <p style={s.alumnoNombre}>{m.alumnoNombre}</p>
                        <p style={s.alumnoEmail}>{m.alumnoEmail}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={s.aprobarBtn} onClick={() => handleAprobar(m.id)}>✓ Aprobar</button>
                      <button style={s.rechazarBtn} onClick={() => handleRechazar(m.id)}>✕ Rechazar</button>
                    </div>
                  </div>
                ))}
            </div>
            <div style={s.seccion}>
              <h3 style={s.seccionTitle}>
                ✅ Alumnos aprobados
                {aprobados.length > 0 && <span style={s.badgeGreen}>{aprobados.length}</span>}
              </h3>
              {aprobados.length === 0 ? <p style={s.emptyText}>Sin alumnos aprobados aún</p>
                : aprobados.map((m, i) => (
                  <div key={i} style={s.alumnoRowAprobado}>
                    <span style={s.alumnoAvatar}>👤</span>
                    <div style={{ flex: 1 }}>
                      <p style={s.alumnoNombre}>{m.alumnoNombre}</p>
                      <p style={s.alumnoEmail}>{m.alumnoEmail}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: '#22c55e', fontSize: '13px' }}>✓ Aprobado</span>
                      <button style={s.expulsarBtn} onClick={() => handleExpulsarAlumno(m)} title="Expulsar">🗑</button>
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
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
                  Sección {cursoActividades.seccion} · {cursoActividades.ciclo}
                </p>
              </div>
              <button style={s.closeBtn} onClick={() => { setCursoActividades(null); setShowActForm(false); }}>✕</button>
            </div>

            {msgAct && (
              <div style={{ color: msgAct.includes('✅') ? '#22c55e' : '#ef4444', marginBottom: '16px', fontSize: '13px', background: msgAct.includes('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '8px' }}>
                {msgAct}
              </div>
            )}

            {actividades.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>
                  Actividades publicadas ({actividades.length})
                </h3>
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
                            <span style={{
                              background: fl.vencida ? 'rgba(239,68,68,0.15)' : fl.diff <= 2 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.1)',
                              color: fl.vencida ? '#ef4444' : fl.diff <= 2 ? '#f59e0b' : '#22c55e',
                              padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                            }}>
                              📅 {fl.vencida ? 'Vencida' : `${fl.diff}d restantes`} · {new Date(a.fechaLimite).toLocaleDateString('es-PE')}
                            </span>
                          )}
                        </div>
                        {a.descripcion && (
                          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0, lineHeight: '1.4' }}>
                            {a.descripcion.substring(0, 120)}{a.descripcion.length > 120 ? '…' : ''}
                          </p>
                        )}
                      </div>
                      <button style={s.expulsarBtn} title="Eliminar actividad" onClick={() => handleEliminarActividad(a)}>🗑</button>
                    </div>
                  );
                })}
              </div>
            )}

            {actividades.length === 0 && !showActForm && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>
                No hay actividades publicadas aún
              </div>
            )}

            {showActForm ? (
              <div style={s.actForm}>
                <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: '600', margin: '0 0 16px' }}>Nueva actividad</h3>
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Título *</label>
                    <input style={s.input} placeholder="Ej: Práctica Calificada 1"
                      value={formAct.titulo} onChange={e => setFormAct(f => ({ ...f, titulo: e.target.value }))} />
                  </div>
                  <div>
                    <label style={s.label}>Tipo de evaluación *</label>
                    <select style={s.select} value={formAct.tipoEvaluacion}
                      onChange={e => setFormAct(f => ({ ...f, tipoEvaluacion: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {cursoActividades.tiposEvaluacion?.map((t, i) => (
                        <option key={i} value={t.nombre}>{t.nombre} ({t.peso}%)</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Descripción breve</label>
                    <input style={s.input} placeholder="Ej: Resolver los ejercicios de los temas 3 y 4"
                      value={formAct.descripcion} onChange={e => setFormAct(f => ({ ...f, descripcion: e.target.value }))} />
                  </div>
                  {/* ✅ FECHA LÍMITE */}
                  <div>
                    <label style={s.label}>📅 Fecha límite de entrega</label>
                    <input style={s.input} type="datetime-local"
                      value={formAct.fechaLimite}
                      onChange={e => setFormAct(f => ({ ...f, fechaLimite: e.target.value }))} />
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '4px' }}>
                      Los alumnos verán cuánto tiempo les queda
                    </p>
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
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0 }}>
                    La IA usará este enunciado para evaluar si el alumno respondió lo que se pidió
                  </p>
                  {!formAct.enunciadoNombre && (
                    <textarea style={{ ...s.textarea, marginTop: '10px', minHeight: '80px' }}
                      placeholder="O escribe el enunciado directamente aquí..."
                      value={formAct.enunciadoTexto}
                      onChange={e => setFormAct(f => ({ ...f, enunciadoTexto: e.target.value }))} />
                  )}
                </div>
                {rubricas.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={s.label}>Rúbrica de evaluación</label>
                    <select style={s.select} value={formAct.rubricaId}
                      onChange={e => setFormAct(f => ({ ...f, rubricaId: e.target.value }))}>
                      <option value="">Sin rúbrica específica</option>
                      {rubricas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button style={s.secondaryBtn} onClick={() => { setShowActForm(false); setMsgAct(''); }}>Cancelar</button>
                  <button style={s.primaryBtn} onClick={handleGuardarActividad} disabled={guardandoAct}>
                    {guardandoAct ? 'Publicando...' : '📢 Publicar actividad'}
                  </button>
                </div>
              </div>
            ) : (
              <button style={{ ...s.primaryBtn, width: '100%' }} onClick={() => setShowActForm(true)}>
                + Nueva actividad
              </button>
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
                <input style={s.input} placeholder="Ej: Contabilidad General"
                  value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Sección *</label>
                <input style={s.input} placeholder="Ej: A"
                  value={form.seccion} onChange={e => setForm(f => ({ ...f, seccion: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Código del curso *</label>
                <input style={s.input} placeholder="Ej: CONT-2024-A"
                  value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} />
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '6px' }}>Comparte este código con tus alumnos</p>
              </div>
              <div>
                <label style={s.label}>Ciclo / Semestre</label>
                <input style={s.input} placeholder="Ej: 2024-II"
                  value={form.ciclo} onChange={e => setForm(f => ({ ...f, ciclo: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={s.label}>Descripción</label>
              <input style={s.input} placeholder="Descripción breve"
                value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
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
                <span style={{ color: totalPeso === 100 ? '#22c55e' : '#ef4444', fontSize: '13px', fontWeight: '600' }}>
                  Total: {totalPeso}% {totalPeso === 100 ? '✓' : '← debe ser 100%'}
                </span>
              </div>
              {form.tiposEvaluacion.map((t, i) => (
                <div key={i} style={s.tipoRow}>
                  <input style={{ ...s.input, flex: 2 }} placeholder="Nombre (ej: Tareas)"
                    value={t.nombre} onChange={e => updateTipo(i, 'nombre', e.target.value)} />
                  <input style={{ ...s.input, width: '70px', textAlign: 'center' }}
                    type="number" min="0" max="100" value={t.peso}
                    onChange={e => updateTipo(i, 'peso', e.target.value)} />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>%</span>
                  <button onClick={() => setForm(f => ({ ...f, tiposEvaluacion: f.tiposEvaluacion.filter((_, idx) => idx !== i) }))}
                    style={s.removeBtn}>✕</button>
                </div>
              ))}
              <button onClick={() => setForm(f => ({ ...f, tiposEvaluacion: [...f.tiposEvaluacion, { nombre: '', peso: 0 }] }))}
                style={s.addTipoBtn}>+ Agregar tipo</button>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={s.secondaryBtn} onClick={() => setShowForm(false)}>Cancelar</button>
              <button style={s.primaryBtn} onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Creando...' : '🚀 Crear Curso'}
              </button>
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
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '16px', marginBottom: '16px' },
  label: { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' },
  input: { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(20,16,50,0.95)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  silaboBox: { background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '12px', padding: '16px', marginBottom: '20px' },
  uploadBtn: { display: 'inline-block', padding: '8px 16px', borderRadius: '8px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontSize: '13px', cursor: 'pointer' },
  tipoRow: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' },
  removeBtn: { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', padding: '8px 10px', fontSize: '13px' },
  addTipoBtn: { width: '100%', padding: '10px', borderRadius: '10px', border: '2px dashed rgba(102,126,234,0.3)', background: 'transparent', color: '#a78bfa', cursor: 'pointer', fontSize: '13px' },
};