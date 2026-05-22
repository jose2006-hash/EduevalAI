// src/pages/VisualizarEntrega.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { editarNotaEntrega, checkIAWithTurnitin } from '../firebase/services.js';
import { useAuth } from '../components/AuthContext.jsx';

export default function VisualizarEntrega() {
  const { entregas, entregaId } = useParams();
  const navigate = useNavigate();
  const { userData } = useAuth();

  const [entrega, setEntrega] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [notaEditada, setNotaEditada] = useState('');
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [iaChecking, setIaChecking] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    try {
      // buscar la entrega por ID (se pasa como parámetro en la URL)
      // Por ahora, asumimos que se pasa directamente
      setLoading(false);
    } catch (err) {
      console.error('Error cargando entrega:', err);
      setLoading(false);
    }
  };

  const handleGuardarNota = async () => {
    if (notaEditada === '' || isNaN(notaEditada) || notaEditada < 0 || notaEditada > 20) {
      setMensaje('❌ La nota debe estar entre 0 y 20');
      return;
    }
    setEnviando(true);
    try {
      await editarNotaEntrega(entrega.id, parseFloat(notaEditada), comentario);
      setMensaje('✅ Nota actualizada correctamente');
      setEditando(false);
      // Actualizar local
      setEntrega(prev => ({
        ...prev,
        notaFinal: parseFloat(notaEditada),
        notaEditadaManualmente: true,
        comentarioDocente: comentario,
      }));
    } catch (err) {
      setMensaje('❌ Error al guardar la nota: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const nivelColor = (nota) => {
    if (!nota && nota !== 0) return '#667eea';
    if (nota >= 18) return '#22c55e';
    if (nota >= 14) return '#3b82f6';
    if (nota >= 11) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) return (
    <div style={{ ...s.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#fff' }}>Cargando entrega...</p>
    </div>
  );

  if (!entrega) return (
    <div style={s.container}>
      <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: '40px' }}>
        Entrega no encontrada
      </p>
      <button onClick={() => navigate('/dashboard')} style={s.backBtn}>← Volver al dashboard</button>
    </div>
  );

  return (
    <div style={s.container}>
      <header style={s.header}>
        <button onClick={() => navigate('/dashboard')} style={s.backBtn}>← Dashboard</button>
        <h1 style={s.title}>{entrega.titulo}</h1>
      </header>

      <main style={s.main}>
        <div style={s.grid2}>
          {/* Info y nota */}
          <div style={s.card}>
            <div style={{ borderBottom: `3px solid ${nivelColor(entrega.notaFinal)}`, paddingBottom: '20px', marginBottom: '20px' }}>
              <div style={{ fontSize: '56px', fontWeight: '800', color: nivelColor(entrega.notaFinal) }}>
                {entrega.notaFinal}<span style={{ fontSize: '22px', opacity: 0.5 }}>/20</span>
              </div>
              <div style={{ color: nivelColor(entrega.notaFinal), fontWeight: '600', fontSize: '18px', marginTop: '8px' }}>
                {entrega.nivelGlobal}
              </div>
            </div>

            <div style={s.infoRow}>
              <span style={s.infoLabel}>Alumno:</span>
              <span style={s.infoValue}>{entrega.alumnoNombre}</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Curso:</span>
              <span style={s.infoValue}>{entrega.cursoNombre}</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Tipo:</span>
              <span style={s.infoValue}>{entrega.tipoEvaluacion}</span>
            </div>
            {entrega.actividadTitulo && (
              <div style={s.infoRow}>
                <span style={s.infoLabel}>Actividad:</span>
                <span style={s.infoValue}>{entrega.actividadTitulo}</span>
              </div>
            )}
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Fecha:</span>
              <span style={s.infoValue}>{entrega.creadoEn?.toDate?.()?.toLocaleDateString('es-PE')}</span>
            </div>

            {entrega.notaEditadaManualmente && (
              <div style={{ ...s.infoBox, background: 'rgba(96,165,250,0.1)', borderLeft: '4px solid #60a5fa', marginTop: '16px' }}>
                <p style={{ color: '#93c5fd', fontSize: '13px', margin: '0 0 4px' }}>✏️ Nota editada manualmente</p>
                {entrega.comentarioDocente && (
                  <p style={{ color: '#93c5fd', fontSize: '12px', margin: 0, fontStyle: 'italic' }}>
                    "{entrega.comentarioDocente}"
                  </p>
                )}
              </div>
            )}

            {!editando ? (
              <button style={s.editarBtn} onClick={() => {
                setEditando(true);
                setNotaEditada(entrega.notaFinal);
                setComentario(entrega.comentarioDocente || '');
              }}>
                ✏️ Editar nota manualmente
              </button>
            ) : (
              <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(102,126,234,0.1)', borderRadius: '12px' }}>
                <label style={s.label}>Nueva nota (0-20) *</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.1"
                  style={s.input}
                  value={notaEditada}
                  onChange={e => setNotaEditada(e.target.value)}
                />
                <label style={{ ...s.label, marginTop: '12px' }}>Comentario (opcional)</label>
                <textarea
                  style={{ ...s.textarea, height: '80px' }}
                  value={comentario}
                  onChange={e => setComentario(e.target.value)}
                  placeholder="Explica por qué cambias la nota..."
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button style={s.secondaryBtn} onClick={() => setEditando(false)}>Cancelar</button>
                  <button style={s.primaryBtn} onClick={handleGuardarNota} disabled={enviando}>
                    {enviando ? '⏳ Guardando...' : '💾 Guardar cambios'}
                  </button>
                </div>
              </div>
            )}

            {/* IA Check */}
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              {entrega.iaScore !== undefined && (
                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', color: '#fff', fontWeight: '600' }}>
                  🔍 IA: {entrega.iaScore}%
                </div>
              )}
              <button
                style={s.secondaryBtn}
                onClick={async () => {
                  if (!entrega.archivoUrl) { setMensaje('❌ No hay archivo para comprobar'); return; }
                  setIaChecking(true);
                  try {
                    const res = await checkIAWithTurnitin(entrega.id, entrega.archivoUrl);
                    setEntrega(prev => ({ ...prev, iaScore: res.iaScore, iaObservacion: res.iaObservacion, iaCheckedAt: new Date() }));
                    setMensaje('✅ Comprobación IA realizada');
                  } catch (err) {
                    setMensaje('❌ Error comprobando IA: ' + err.message);
                  } finally {
                    setIaChecking(false);
                  }
                }}
                disabled={iaChecking}
              >
                {iaChecking ? '⏳ Comprobando...' : 'Comprobar con Turnitin'}
              </button>
            </div>

            {entrega.iaObservacion && (
              <div style={{ marginTop: '12px', ...s.infoBox }}>
                <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: '13px' }}>{entrega.iaObservacion}</p>
              </div>
            )}

            {mensaje && (
              <div style={{ ...s.mensaje, marginTop: '12px', color: mensaje.includes('✅') ? '#22c55e' : '#ef4444' }}>
                {mensaje}
              </div>
            )}
          </div>

          {/* PDF */}
          <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
            <h3 style={s.cardTitle}>📄 Documento PDF</h3>
            {entrega.archivoUrl ? (
              <>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '12px' }}>
                  {entrega.archivoNombre}
                </p>
                <div style={{ height: '600px', overflow: 'auto', borderRadius: '8px', background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <object
                    data={entrega.archivoUrl}
                    type="application/pdf"
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      borderRadius: '8px',
                      background: '#fff',
                    }}
                  >
                    <p style={{ color: 'rgba(0,0,0,0.75)', padding: '18px', textAlign: 'center' }}>
                      Tu navegador no puede mostrar este PDF.{' '}
                      <a href={entrega.archivoUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
                        Abrir en nueva pestaña
                      </a>
                    </p>
                  </object>
                </div>
                <a
                  href={entrega.archivoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.descargarBtn}
                  download={entrega.archivoNombre}
                >
                  📥 Descargar PDF original
                </a>
              </>
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '40px 20px' }}>
                No hay PDF disponible. El trabajo se envió como texto.
              </p>
            )}
          </div>
        </div>

        {/* Criterios */}
        {entrega.criterios?.length > 0 && (
          <div style={s.card}>
            <h3 style={s.cardTitle}>📊 Detalle por Criterios</h3>
            {entrega.criterios.map((c, i) => (
              <div key={i} style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#fff', fontWeight: '500' }}>{c.nombre}</span>
                  <span style={{ color: nivelColor(c.puntajeObtenido / c.puntajeMaximo * 20), fontWeight: '600' }}>
                    {c.puntajeObtenido}/{c.puntajeMaximo} — {c.nivel}
                  </span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(c.puntajeObtenido / c.puntajeMaximo) * 100}%`,
                    background: nivelColor(c.puntajeObtenido / c.puntajeMaximo * 20),
                    borderRadius: '3px',
                  }} />
                </div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '6px 0 0' }}>
                  {c.comentario}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Retroalimentación */}
        {entrega.retroalimentacionGeneral && (
          <div style={{ ...s.card, background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.2)' }}>
            <h3 style={s.cardTitle}>💬 Retroalimentación General</h3>
            <p style={{ color: 'rgba(255,255,255,0.75)', lineHeight: '1.7', margin: 0 }}>
              {entrega.retroalimentacionGeneral}
            </p>
          </div>
        )}

        {/* Recomendaciones */}
        {entrega.recomendaciones?.length > 0 && (
          <div style={s.card}>
            <h3 style={s.cardTitle}>📝 Recomendaciones</h3>
            <ul style={{ color: 'rgba(255,255,255,0.7)', lineHeight: '1.8', paddingLeft: '20px', margin: 0 }}>
              {entrega.recomendaciones.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

const s = {
  container: { height: '100vh', overflowY: 'auto', background: '#0f0c29', fontFamily: "'Segoe UI', sans-serif", padding: '32px' },
  header: { display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' },
  backBtn: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px' },
  title: { color: '#fff', fontSize: '28px', fontWeight: '700', margin: 0, flex: 1 },
  main: { maxWidth: '1200px', margin: '0 auto' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' },
  card: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' },
  cardTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', margin: '0 0 16px' },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  infoLabel: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontWeight: '500' },
  infoValue: { color: 'rgba(255,255,255,0.9)', fontSize: '14px' },
  infoBox: { padding: '12px', borderRadius: '8px' },
  editarBtn: { width: '100%', padding: '12px', marginTop: '16px', background: 'rgba(102,126,234,0.2)', color: '#a78bfa', border: '1px solid rgba(102,126,234,0.4)', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  label: { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '6px' },
  input: { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' },
  primaryBtn: { flex: 1, padding: '10px 16px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  secondaryBtn: { flex: 1, padding: '10px 16px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  descargarBtn: { display: 'inline-block', marginTop: '12px', padding: '8px 12px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600' },
  mensaje: { padding: '12px', borderRadius: '8px', fontSize: '13px', textAlign: 'center' },
};
