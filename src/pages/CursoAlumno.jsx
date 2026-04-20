// src/pages/CursoAlumno.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getCurso, getEntregasByAlumnoYCurso, crearEntrega, calcularNotaFinal
} from '../firebase/services.js';
import { evaluarTrabajo } from '../openai/evaluador.js';
import { getRubricas } from '../firebase/services.js';
import { useAuth } from '../components/AuthContext.jsx';

export default function CursoAlumno() {
  const { cursoId } = useParams();
  const { user, userData } = useAuth();
  const navigate = useNavigate();

  const [curso, setCurso] = useState(null);
  const [entregas, setEntregas] = useState([]);
  const [rubricas, setRubricas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [entregaSeleccionada, setEntregaSeleccionada] = useState(null);

  const [form, setForm] = useState({
    tipoEvaluacion: '',
    titulo: '',
    texto: '',
    rubricaId: '',
  });
  const [pdfNombre, setPdfNombre] = useState('');
  const [pdfTexto, setPdfTexto] = useState('');
  const [leyendoPDF, setLeyendoPDF] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    cargar();
  }, [cursoId, user]);

  const cargar = async () => {
    const [c, ents, rubs] = await Promise.all([
      getCurso(cursoId),
      getEntregasByAlumnoYCurso(user.uid, cursoId),
      getRubricas(cursoId),
    ]);
    setCurso(c);
    setEntregas(ents);
    setRubricas(rubs);
    setLoading(false);
  };

  const handlePDF = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfNombre(file.name);
    setLeyendoPDF(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = ev.target.result;
      const text = raw.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
        .replace(/\s{3,}/g, '\n').substring(0, 8000);
      setPdfTexto(text);
      setLeyendoPDF(false);
    };
    reader.readAsText(file, 'latin1');
  };

  const handleEnviar = async () => {
    const textoFinal = pdfTexto || form.texto;
    if (!textoFinal.trim()) return setError('Escribe o sube tu trabajo');
    if (!form.tipoEvaluacion) return setError('Selecciona el tipo de evaluación');
    if (!form.titulo.trim()) return setError('Ingresa un título');

    setError('');
    setEnviando(true);
    setMsg('');

    try {
      const rubrica = rubricas.find(r => r.id === form.rubricaId) || rubricas[0];

      let resultado = null;
      if (rubrica) {
        resultado = await evaluarTrabajo(
          textoFinal,
          rubrica,
          curso.nombre,
          form.titulo,
          curso.silaboTexto || ''
        );
      }

      await crearEntrega({
        alumnoUid: user.uid,
        alumnoNombre: userData.nombre,
        cursoId,
        cursoNombre: curso.nombre,
        tipoEvaluacion: form.tipoEvaluacion,
        titulo: form.titulo,
        texto: textoFinal,
        pdfNombre: pdfNombre || null,
        rubricaId: rubrica?.id || null,
        rubricaNombre: rubrica?.nombre || null,
        estado: resultado ? 'evaluado' : 'pendiente',
        ...(resultado || {}),
      });

      setMsg('✅ Trabajo enviado y evaluado con éxito');
      setShowForm(false);
      resetForm();
      await cargar();
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const resetForm = () => {
    setForm({ tipoEvaluacion: '', titulo: '', texto: '', rubricaId: '' });
    setPdfNombre(''); setPdfTexto(''); setError('');
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

  // Agrupar entregas por tipo
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
          <p style={s.subtitle}>{curso?.docenteNombre} · {curso?.ciclo}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={s.notaLabel}>Nota final</p>
          <p style={{ ...s.notaValue, color: nivelColor(notaFinal) }}>
            {notaFinal !== null ? `${notaFinal}/20` : '—'}
          </p>
        </div>
      </header>

      {msg && <p style={s.successMsg}>{msg}</p>}

      {/* Pesos del curso */}
      <div style={s.pesosRow}>
        {curso?.tiposEvaluacion?.map((t, i) => {
          const ents = entregasPorTipo[t.nombre] || [];
          const evaluados = ents.filter(e => e.estado === 'evaluado');
          const prom = evaluados.length
            ? (evaluados.reduce((sum, e) => sum + (e.notaFinal || 0), 0) / evaluados.length).toFixed(1)
            : null;
          return (
            <div key={i} style={s.pesoCard}>
              <p style={s.pesoNombre}>{t.nombre}</p>
              <p style={s.pesoPct}>{t.peso}%</p>
              <p style={{ ...s.pesoNota, color: nivelColor(prom) }}>
                {prom ? `${prom}/20` : '—'}
              </p>
              <p style={s.pesoCount}>{evaluados.length} entrega{evaluados.length !== 1 ? 's' : ''}</p>
            </div>
          );
        })}
      </div>

      {/* Botón nueva entrega */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button style={s.primaryBtn} onClick={() => setShowForm(true)}>
          + Subir trabajo
        </button>
      </div>

      {/* Entregas por tipo */}
      {curso?.tiposEvaluacion?.map((tipo, ti) => {
        const ents = entregasPorTipo[tipo.nombre] || [];
        return (
          <div key={ti} style={s.tipoSection}>
            <h3 style={s.tipoTitle}>
              {tipo.nombre}
              <span style={s.tipoPeso}>{tipo.peso}%</span>
            </h3>
            {ents.length === 0 ? (
              <p style={s.emptyTipo}>Sin entregas aún en esta categoría</p>
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
                    {e.nivelGlobal && (
                      <p style={s.entregaNivel}>{e.nivelGlobal}</p>
                    )}
                    <p style={s.entregaFecha}>
                      {e.creadoEn?.toDate?.()?.toLocaleDateString('es-PE') || '—'}
                    </p>
                    {e.estado === 'evaluado' && (
                      <p style={s.verDetalle}>Ver retroalimentación →</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Modal subir trabajo */}
      {showForm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>📝 Subir Trabajo</h2>
              <button style={s.closeBtn} onClick={() => { setShowForm(false); resetForm(); }}>✕</button>
            </div>

            <div style={s.grid2}>
              <div>
                <label style={s.label}>Tipo de evaluación *</label>
                <select style={s.select} value={form.tipoEvaluacion}
                  onChange={e => setForm(f => ({ ...f, tipoEvaluacion: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {curso?.tiposEvaluacion?.map((t, i) => (
                    <option key={i} value={t.nombre}>{t.nombre} ({t.peso}%)</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={s.label}>Rúbrica de evaluación</label>
                <select style={s.select} value={form.rubricaId}
                  onChange={e => setForm(f => ({ ...f, rubricaId: e.target.value }))}>
                  <option value="">
                    {rubricas.length === 0 ? 'Sin rúbricas en este curso' : 'Seleccionar rúbrica...'}
                  </option>
                  {rubricas.map(r => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={s.label}>Título del trabajo *</label>
              <input style={s.input} placeholder="Ej: Tarea 1 - Introducción a la contabilidad"
                value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>

            {/* Tabs texto/PDF */}
            <div style={s.tabs}>
              <span style={s.tabLabel}>Tu trabajo:</span>
              <label style={s.uploadPdfBtn}>
                {leyendoPDF ? '⏳ Leyendo PDF...' : pdfNombre ? `✅ ${pdfNombre}` : '📎 Subir PDF'}
                <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handlePDF} />
              </label>
              <span style={s.tabOr}>o escribe abajo</span>
            </div>

            <textarea
              style={s.textarea}
              placeholder="Pega o escribe el contenido de tu trabajo aquí..."
              value={form.texto}
              onChange={e => setForm(f => ({ ...f, texto: e.target.value }))}
              rows={10}
              disabled={!!pdfTexto}
            />
            {pdfTexto && (
              <div style={s.pdfLoaded}>
                <span>📄 PDF cargado correctamente</span>
                <button style={s.clearPdf} onClick={() => { setPdfNombre(''); setPdfTexto(''); }}>
                  Quitar PDF
                </button>
              </div>
            )}

            {error && <p style={s.error}>{error}</p>}

            {enviando && (
              <div style={s.evaluandoMsg}>
                <div style={s.spinner} />
                Evaluando con IA... esto puede tardar unos segundos
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button style={s.secondaryBtn} onClick={() => { setShowForm(false); resetForm(); }}>
                Cancelar
              </button>
              <button style={s.primaryBtn} onClick={handleEnviar} disabled={enviando}>
                {enviando ? 'Enviando...' : '🚀 Enviar y evaluar'}
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
              <h2 style={s.modalTitle}>{entregaSeleccionada.titulo}</h2>
              <button style={s.closeBtn} onClick={() => setEntregaSeleccionada(null)}>✕</button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', fontWeight: '800', color: nivelColor(entregaSeleccionada.notaFinal) }}>
                {entregaSeleccionada.notaFinal}<span style={{ fontSize: '20px', opacity: 0.5 }}>/20</span>
              </div>
              <div style={{ color: nivelColor(entregaSeleccionada.notaFinal), fontWeight: '600', fontSize: '16px' }}>
                {entregaSeleccionada.nivelGlobal}
              </div>
            </div>

            {entregaSeleccionada.criterios?.map((c, i) => (
              <div key={i} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#fff', fontSize: '14px' }}>{c.nombre}</span>
                  <span style={{ color: nivelColor(c.nivel === 'Excelente' ? 18 : c.nivel === 'Bueno' ? 15 : c.nivel === 'Regular' ? 12 : 8), fontWeight: '600' }}>
                    {c.puntajeObtenido}/{c.puntajeMaximo} — {c.nivel}
                  </span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(c.puntajeObtenido / c.puntajeMaximo) * 100}%`, background: nivelColor(c.nivel === 'Excelente' ? 18 : 12), borderRadius: '3px' }} />
                </div>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: '4px 0 0' }}>{c.comentario}</p>
              </div>
            ))}

            {entregaSeleccionada.retroalimentacionGeneral && (
              <div style={{ background: 'rgba(102,126,234,0.08)', borderRadius: '12px', padding: '16px', marginTop: '16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retroalimentación</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                  {entregaSeleccionada.retroalimentacionGeneral}
                </p>
              </div>
            )}

            {entregaSeleccionada.recomendaciones?.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recomendaciones</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {entregaSeleccionada.recomendaciones.map((r, i) => (
                    <li key={i} style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '6px' }}>→ {r}</li>
                  ))}
                </ul>
              </div>
            )}

            <button style={{ ...s.primaryBtn, width: '100%', marginTop: '20px' }}
              onClick={() => setEntregaSeleccionada(null)}>
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
  successMsg: { color: '#22c55e', fontSize: '14px', marginBottom: '16px', background: 'rgba(34,197,94,0.1)', padding: '12px 16px', borderRadius: '10px' },
  pesosRow: { display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' },
  pesoCard: { flex: 1, minWidth: '100px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' },
  pesoNombre: { color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '0 0 4px', fontWeight: '500' },
  pesoPct: { color: '#a78bfa', fontSize: '18px', fontWeight: '700', margin: '0 0 8px' },
  pesoNota: { fontSize: '20px', fontWeight: '700', margin: '0 0 4px' },
  pesoCount: { color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0 },
  primaryBtn: { padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  secondaryBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontSize: '14px' },
  tipoSection: { marginBottom: '28px' },
  tipoTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '10px' },
  tipoPeso: { background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '2px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '500' },
  emptyTipo: { color: 'rgba(255,255,255,0.25)', fontSize: '13px', padding: '16px 0' },
  entregasGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' },
  entregaCard: { background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' },
  entregaTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', gap: '8px' },
  entregaTitulo: { color: '#fff', fontSize: '14px', fontWeight: '500', flex: 1 },
  estadoBadge: { padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', flexShrink: 0 },
  entregaNivel: { color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: '0 0 4px' },
  entregaFecha: { color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0 },
  verDetalle: { color: '#a78bfa', fontSize: '12px', margin: '8px 0 0', fontWeight: '500' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '32px' },
  modal: { background: '#1a1535', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '680px', border: '1px solid rgba(255,255,255,0.1)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  modalTitle: { color: '#fff', fontSize: '18px', fontWeight: '700', margin: 0 },
  closeBtn: { background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '16px', width: '32px', height: '32px', borderRadius: '8px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  label: { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' },
  input: { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(20,16,50,0.95)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  tabs: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' },
  tabLabel: { color: 'rgba(255,255,255,0.5)', fontSize: '13px' },
  uploadPdfBtn: { display: 'inline-block', padding: '7px 14px', borderRadius: '8px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', fontSize: '13px', cursor: 'pointer' },
  tabOr: { color: 'rgba(255,255,255,0.3)', fontSize: '12px' },
  textarea: { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.6', fontFamily: 'inherit', boxSizing: 'border-box' },
  pdfLoaded: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(34,197,94,0.08)', borderRadius: '8px', padding: '10px 14px', marginTop: '8px', color: '#22c55e', fontSize: '13px' },
  clearPdf: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px' },
  error: { color: '#ef4444', fontSize: '13px', marginTop: '12px' },
  evaluandoMsg: { display: 'flex', alignItems: 'center', gap: '12px', color: '#a78bfa', fontSize: '14px', marginTop: '16px', padding: '14px', background: 'rgba(102,126,234,0.1)', borderRadius: '10px' },
  spinner: { width: '18px', height: '18px', border: '2px solid rgba(167,139,250,0.3)', borderTop: '2px solid #a78bfa', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 },
};