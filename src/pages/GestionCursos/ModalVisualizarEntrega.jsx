// src/components/ModalVisualizarEntrega.jsx
import { useState } from 'react';
import { editarNotaEntrega, getRubricas } from '../firebase/services.js';
import { evaluarTrabajo } from '../openai/evaluador.js';
import { actualizarEntrega } from '../firebase/services.js';

export default function ModalVisualizarEntrega({ entrega: entregaInicial, onClose, onNotaActualizada }) {
  const [entrega, setEntrega] = useState(entregaInicial);
  const [editando, setEditando] = useState(false);
  const [notaEditada, setNotaEditada] = useState(entregaInicial?.notaFinal ?? '');
  const [comentario, setComentario] = useState(entregaInicial?.comentarioDocente || '');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  // ── Evaluación automática con IA ──────────────────────────────────────────
  const [evaluandoIA, setEvaluandoIA] = useState(false);
  const [errorIA, setErrorIA] = useState('');

  const handleEvaluarConIA = async () => {
    if (!entrega.archivoUrl) {
      setErrorIA('❌ No hay PDF para evaluar.');
      return;
    }
    if (!entrega.rubricaId) {
      setErrorIA('❌ Esta entrega no tiene rúbrica asignada. Edita la nota manualmente.');
      return;
    }

    setEvaluandoIA(true);
    setErrorIA('');
    setMensaje('');

    try {
      // 1. Cargar la rúbrica desde Firestore
      const rubricas = await getRubricas();
      const rubrica = rubricas.find(r => r.id === entrega.rubricaId);
      if (!rubrica) throw new Error('No se encontró la rúbrica asociada a esta entrega.');

      // 2. Descargar el PDF como File para pasarlo a evaluarTrabajo()
      const response = await fetch(entrega.archivoUrl);
      const blob = await response.blob();
      const file = new File([blob], entrega.archivoNombre || 'trabajo.pdf', { type: 'application/pdf' });

      // 3. Llamar al evaluador de IA
      const resultado = await evaluarTrabajo(
        file,
        rubrica,
        entrega.cursoNombre || '',
        entrega.actividadTitulo || entrega.titulo || '',
      );

      // 4. Guardar resultado en Firestore (colección 'entregas')
      const datosActualizados = {
        notaFinal: resultado.notaFinal,
        nivelGlobal: resultado.nivelGlobal,
        porcentaje: resultado.porcentaje,
        criterios: resultado.criterios,
        fortalezas: resultado.fortalezas,
        areasDesMejora: resultado.areasDesMejora,
        retroalimentacionGeneral: resultado.retroalimentacionGeneral,
        recomendaciones: resultado.recomendaciones,
        estado: 'evaluado',
        evaluadoPorIA: true,
      };

      await actualizarEntrega(entrega.id, datosActualizados);

      // 5. Actualizar estado local y notificar al padre
      const entregaActualizada = { ...entrega, ...datosActualizados };
      setEntrega(entregaActualizada);
      setNotaEditada(resultado.notaFinal);
      if (onNotaActualizada) onNotaActualizada(entregaActualizada);
      setMensaje('✅ Evaluación IA completada y nota guardada');

    } catch (err) {
      console.error('Error evaluando con IA:', err);
      setErrorIA('❌ ' + err.message);
    } finally {
      setEvaluandoIA(false);
    }
  };

  // ── Edición manual de nota ────────────────────────────────────────────────
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
      const actualizada = {
        ...entrega,
        notaFinal: parseFloat(notaEditada),
        notaEditadaManualmente: true,
        comentarioDocente: comentario,
        estado: 'evaluado',
      };
      setEntrega(actualizada);
      if (onNotaActualizada) onNotaActualizada(actualizada);
      setTimeout(() => setMensaje(''), 2000);
    } catch (err) {
      setMensaje('❌ Error: ' + err.message);
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

  if (!entrega) return null;

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <div>
            <h2 style={s.modalTitle}>{entrega.titulo}</h2>
            <p style={s.modalSub}>
              {entrega.alumnoNombre} • {entrega.cursoNombre}
            </p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.modalContent}>
          {/* Nota y acciones */}
          <div style={s.notaSection}>
            <div style={{ ...s.notaDisplay, borderTop: `4px solid ${nivelColor(entrega.notaFinal)}` }}>
              <div style={{ fontSize: '48px', fontWeight: '800', color: nivelColor(entrega.notaFinal) }}>
                {entrega.notaFinal !== null && entrega.notaFinal !== undefined ? (
                  <>{entrega.notaFinal}<span style={{ fontSize: '18px', opacity: 0.5 }}>/20</span></>
                ) : (
                  <span style={{ fontSize: '20px', opacity: 0.7, color: '#cbd5e1' }}>Pendiente</span>
                )}
              </div>
              <div style={{ color: nivelColor(entrega.notaFinal), fontWeight: '600', fontSize: '16px', marginTop: '6px' }}>
                {entrega.notaFinal !== null && entrega.notaFinal !== undefined ? entrega.nivelGlobal : '—'}
              </div>
            </div>

            {entrega.evaluadoPorIA && !entrega.notaEditadaManualmente && (
              <div style={s.iaBadge}>🤖 Evaluado automáticamente por IA</div>
            )}
            {entrega.notaEditadaManualmente && (
              <div style={s.editedNoteBox}>
                ✏️ Nota ajustada manualmente
                {entrega.comentarioDocente && ` — "${entrega.comentarioDocente}"`}
              </div>
            )}

            {/* Botón principal: Evaluar con IA */}
            {entrega.estado !== 'evaluado' && (
              <button
                style={{ ...s.iaBtn, opacity: evaluandoIA ? 0.7 : 1 }}
                onClick={handleEvaluarConIA}
                disabled={evaluandoIA}
              >
                {evaluandoIA ? '🤖 Evaluando con IA...' : '🤖 Evaluar con IA'}
              </button>
            )}
            {evaluandoIA && (
              <p style={{ color: '#a78bfa', fontSize: '12px', textAlign: 'center', margin: 0 }}>
                Analizando el PDF... puede tardar unos segundos.
              </p>
            )}
            {errorIA && (
              <div style={{ ...s.mensaje, color: '#ef4444' }}>{errorIA}</div>
            )}

            {/* Separador */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }} />

            {/* Edición manual */}
            {!editando ? (
              <button style={s.editBtn} onClick={() => setEditando(true)}>
                ✏️ Editar nota manualmente
              </button>
            ) : (
              <div style={s.editForm}>
                <div style={s.formField}>
                  <label style={s.label}>Nueva nota (0-20)</label>
                  <input
                    type="number" min="0" max="20" step="0.1"
                    style={s.input}
                    value={notaEditada}
                    onChange={e => setNotaEditada(e.target.value)}
                  />
                </div>
                <div style={s.formField}>
                  <label style={s.label}>Comentario (opcional)</label>
                  <textarea
                    style={{ ...s.textarea, height: '60px' }}
                    value={comentario}
                    onChange={e => setComentario(e.target.value)}
                    placeholder="¿Por qué cambias la nota?"
                  />
                </div>
                {mensaje && (
                  <div style={{ ...s.mensaje, color: mensaje.includes('✅') ? '#22c55e' : '#ef4444' }}>
                    {mensaje}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={s.cancelBtn} onClick={() => { setEditando(false); setMensaje(''); }}>
                    Cancelar
                  </button>
                  <button style={s.saveBtn} onClick={handleGuardarNota} disabled={enviando}>
                    {enviando ? '⏳ Guardando...' : '💾 Guardar'}
                  </button>
                </div>
              </div>
            )}

            {mensaje && !editando && (
              <div style={{ ...s.mensaje, color: mensaje.includes('✅') ? '#22c55e' : '#ef4444' }}>
                {mensaje}
              </div>
            )}
          </div>

          {/* PDF Viewer */}
          <div style={s.pdfSection}>
            <p style={s.pdfTitle}>📄 Documento PDF</p>
            {entrega.archivoUrl ? (
              <div style={s.pdfContainer}>
                <object
                  data={entrega.archivoUrl}
                  type="application/pdf"
                  style={s.pdfIframe}
                >
                  <p style={s.noPdfMsg}>
                    Tu navegador no puede mostrar este PDF.{' '}
                    <a href={entrega.archivoUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#22c55e' }}>
                      Abrir en nueva pestaña
                    </a>
                  </p>
                </object>
                <a
                  href={entrega.archivoUrl}
                  target="_blank" rel="noopener noreferrer"
                  style={s.downloadLink}
                  download={entrega.archivoNombre}
                >
                  📥 Descargar PDF original
                </a>
              </div>
            ) : (
              <p style={s.noPdfMsg}>No hay PDF disponible. El trabajo se envió como texto.</p>
            )}
          </div>

          {/* Criterios */}
          {entrega.criterios?.length > 0 && (
            <div style={s.criteriosSection}>
              <p style={s.sectionTitle}>📊 Criterios</p>
              {entrega.criterios.map((c, i) => (
                <div key={i} style={s.criterioItem}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{c.nombre}</span>
                    <span style={{ color: nivelColor(c.puntajeObtenido / c.puntajeMaximo * 20), fontSize: '12px', fontWeight: '600' }}>
                      {c.puntajeObtenido}/{c.puntajeMaximo} — {c.nivel}
                    </span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(c.puntajeObtenido / c.puntajeMaximo) * 100}%`,
                      background: nivelColor(c.puntajeObtenido / c.puntajeMaximo * 20),
                    }} />
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '4px 0 0' }}>{c.comentario}</p>
                </div>
              ))}
            </div>
          )}

          {/* Retroalimentación */}
          {entrega.retroalimentacionGeneral && (
            <div style={s.feedbackSection}>
              <p style={s.sectionTitle}>💬 Retroalimentación</p>
              <p style={s.feedbackText}>{entrega.retroalimentacionGeneral}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modal: { background: '#1a1535', borderRadius: '20px', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflow: 'auto', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#1a1535' },
  modalTitle: { color: '#fff', fontSize: '22px', fontWeight: '700', margin: '0 0 4px' },
  modalSub: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 },
  closeBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '24px', cursor: 'pointer', padding: 0, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalContent: { padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' },
  notaSection: { display: 'flex', flexDirection: 'column', gap: '12px' },
  notaDisplay: { padding: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' },
  iaBadge: { padding: '8px 12px', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '8px', color: '#a78bfa', fontSize: '12px', textAlign: 'center' },
  editedNoteBox: { padding: '10px 12px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '8px', color: '#93c5fd', fontSize: '12px' },
  iaBtn: { padding: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' },
  editBtn: { padding: '10px', background: 'rgba(102,126,234,0.15)', color: '#a78bfa', border: '1px solid rgba(102,126,234,0.3)', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
  editForm: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', background: 'rgba(102,126,234,0.08)', borderRadius: '10px', border: '1px solid rgba(102,126,234,0.2)' },
  formField: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '500' },
  input: { padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' },
  textarea: { padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' },
  mensaje: { padding: '8px', borderRadius: '6px', fontSize: '12px', textAlign: 'center' },
  cancelBtn: { padding: '8px 12px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  saveBtn: { padding: '8px 12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  pdfSection: { display: 'flex', flexDirection: 'column', gap: '10px' },
  pdfTitle: { color: '#fff', fontSize: '14px', fontWeight: '600', margin: 0 },
  pdfContainer: { display: 'flex', flexDirection: 'column', gap: '8px' },
  pdfIframe: { width: '100%', height: '400px', borderRadius: '8px', border: 'none', background: '#fff' },
  downloadLink: { display: 'inline-block', padding: '6px 10px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600', textAlign: 'center' },
  noPdfMsg: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', textAlign: 'center', padding: '30px 20px', margin: 0 },
  criteriosSection: { gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' },
  sectionTitle: { color: '#fff', fontSize: '13px', fontWeight: '600', margin: 0 },
  criterioItem: { padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  feedbackSection: { gridColumn: '1/-1', padding: '12px', background: 'rgba(102,126,234,0.08)', borderRadius: '10px', border: '1px solid rgba(102,126,234,0.2)' },
  feedbackText: { color: 'rgba(255,255,255,0.75)', fontSize: '13px', lineHeight: '1.6', margin: 0 },
};
