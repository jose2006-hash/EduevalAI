// src/pages/GestionCursos/ModalDetalleEntrega.jsx
import { useState } from 'react';
import { actualizarEntregaAlumno } from '../../firebase/services.js';
import { s } from './styles.js';

const iaBadgeStyle = (pct) => {
  if (pct == null) return null;
  const bg = pct >= 81 ? 'rgba(239,68,68,0.18)' : pct >= 56 ? 'rgba(245,158,11,0.18)' : pct >= 26 ? 'rgba(99,102,241,0.18)' : 'rgba(34,197,94,0.15)';
  const color = pct >= 81 ? '#ef4444' : pct >= 56 ? '#f59e0b' : pct >= 26 ? '#818cf8' : '#22c55e';
  return { background: bg, color, border: `1px solid ${color}44`, padding: '2px 7px', borderRadius: '6px', fontSize: '10px', fontWeight: '700' };
};
const iaLabel = (pct) => {
  if (pct == null) return null;
  if (pct >= 81) return `🤖 ${pct}% IA`;
  if (pct >= 56) return `⚠️ ${pct}% IA`;
  if (pct >= 26) return `🔍 ${pct}% IA`;
  return `✅ ${pct}% IA`;
};
const nivelColor = (nota) => {
  if (!nota && nota !== 0) return '#667eea';
  if (nota >= 17) return '#22c55e';
  if (nota >= 14) return '#3b82f6';
  if (nota >= 11) return '#f59e0b';
  return '#ef4444';
};

export default function ModalDetalleEntrega({ entrega: entregaInicial, onNotaGuardada, onEliminar, onClose }) {
  const [entrega, setEntrega] = useState(entregaInicial);
  const [editando, setEditando] = useState(false);
  const [notaEditada, setNotaEditada] = useState('');
  const [comentario, setComentario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [msgNota, setMsgNota] = useState('');

  const abrirEditar = () => {
    setNotaEditada(String(entrega.notaFinal ?? ''));
    setComentario(entrega.comentarioDocente || '');
    setMsgNota('');
    setEditando(true);
  };

  const handleGuardarNota = async () => {
    const nota = parseFloat(notaEditada);
    if (isNaN(nota) || nota < 0 || nota > 20) return setMsgNota('❌ La nota debe ser entre 0 y 20');
    setGuardando(true); setMsgNota('');
    try {
      const porcentaje = Math.round((nota / 20) * 100);
      const nivelGlobal = nota >= 17 ? 'Excelente' : nota >= 14 ? 'Bueno' : nota >= 11 ? 'Regular' : 'Insuficiente';
      await actualizarEntregaAlumno(entrega.id, {
        notaFinal: nota, porcentaje, nivelGlobal,
        notaEditadaManualmente: true,
        comentarioDocente: comentario.trim(),
        estado: 'evaluado',
      });
      const actualizada = { ...entrega, notaFinal: nota, porcentaje, nivelGlobal, notaEditadaManualmente: true, comentarioDocente: comentario.trim(), estado: 'evaluado' };
      setEntrega(actualizada);
      onNotaGuardada(actualizada);
      setMsgNota('✅ Nota guardada');
      setEditando(false);
    } catch (err) { setMsgNota('❌ Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  const esDocx = (nombre) => nombre?.toLowerCase().endsWith('.docx');

  return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, maxWidth: '800px' }}>
        <div style={s.modalHeader}>
          <div>
            <h2 style={s.modalTitle}>{entrega.titulo}</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
              👤 {entrega.alumnoNombre} · {entrega.tipoEvaluacion}
              {entrega.actividadTitulo && ` · ${entrega.actividadTitulo}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={s.expulsarBtn} onClick={() => onEliminar(entrega)}>🗑</button>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Badge IA */}
        {entrega.porcentajeIA != null && (
          <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px 16px' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>🤖 Análisis de contenido generado por IA</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ ...iaBadgeStyle(entrega.porcentajeIA), fontSize: '16px', padding: '4px 12px' }}>
                {iaLabel(entrega.porcentajeIA)} — {entrega.iaVeredicto || ''}
              </span>
              {entrega.iaObservacion && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0, flex: 1 }}>{entrega.iaObservacion}</p>}
            </div>
            {entrega.iaIndicadores?.length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {entrega.iaIndicadores.map((ind, i) => (
                  <span key={i} style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', padding: '2px 8px', borderRadius: '6px', fontSize: '11px' }}>{ind}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nota */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
          {!editando ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                {entrega.estado === 'evaluado' ? (
                  <>
                    <div style={{ fontSize: '48px', fontWeight: '800', color: nivelColor(entrega.notaFinal) }}>
                      {entrega.notaFinal}<span style={{ fontSize: '20px', opacity: 0.5 }}>/20</span>
                    </div>
                    <div style={{ color: nivelColor(entrega.notaFinal), fontWeight: '600', fontSize: '16px' }}>
                      {entrega.nivelGlobal}
                      {entrega.notaEditadaManualmente && <span style={{ color: '#60a5fa', fontSize: '12px', marginLeft: '8px' }}>✏️ Editada</span>}
                    </div>
                    {entrega.comentarioDocente && <p style={{ color: '#93c5fd', fontSize: '13px', margin: '6px 0 0', fontStyle: 'italic' }}>"{entrega.comentarioDocente}"</p>}
                  </>
                ) : <span style={{ color: '#f59e0b', fontSize: '16px' }}>⏳ Sin evaluar</span>}
              </div>
              <button style={s.editarNotaBtn} onClick={abrirEditar}>
                ✏️ {entrega.estado === 'evaluado' ? 'Modificar nota' : 'Asignar nota'}
              </button>
            </div>
          ) : (
            <div>
              <p style={{ color: '#a78bfa', fontSize: '13px', fontWeight: '600', margin: '0 0 12px' }}>✏️ Editar nota del alumno</p>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <label style={s.labelSmall}>Nueva nota (0–20)</label>
                  <input style={{ ...s.input, width: '100px', fontSize: '18px', fontWeight: '700', textAlign: 'center' }}
                    type="number" min="0" max="20" step="0.5"
                    value={notaEditada} onChange={e => setNotaEditada(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={s.labelSmall}>Comentario (opcional)</label>
                  <input style={s.input} placeholder="Ej: Revisión manual..."
                    value={comentario} onChange={e => setComentario(e.target.value)} />
                </div>
              </div>
              {msgNota && <p style={{ color: msgNota.includes('✅') ? '#22c55e' : '#ef4444', fontSize: '13px', margin: '0 0 10px' }}>{msgNota}</p>}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button style={s.secondaryBtn} onClick={() => { setEditando(false); setMsgNota(''); }}>Cancelar</button>
                <button style={s.primaryBtn} onClick={handleGuardarNota} disabled={guardando}>
                  {guardando ? 'Guardando...' : '💾 Guardar nota'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Criterios */}
        {entrega.criterios?.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Detalle por criterios</h3>
            {entrega.criterios.map((c, i) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{c.nombre}</span>
                  <span style={{ color: nivelColor(c.puntajeObtenido / c.puntajeMaximo * 20), fontWeight: '600', fontSize: '13px' }}>
                    {c.puntajeObtenido}/{c.puntajeMaximo} — {c.nivel}
                  </span>
                </div>
                <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(c.puntajeObtenido / c.puntajeMaximo) * 100}%`, background: nivelColor(c.puntajeObtenido / c.puntajeMaximo * 20), borderRadius: '3px' }} />
                </div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '3px 0 0' }}>{c.comentario}</p>
              </div>
            ))}
          </div>
        )}

        {entrega.retroalimentacionGeneral && (
          <div style={{ background: 'rgba(102,126,234,0.08)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
            <p style={{ color: '#a78bfa', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Retroalimentación IA</p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>{entrega.retroalimentacionGeneral}</p>
          </div>
        )}

        {/* Visor archivo */}
        <div style={s.trabajoBox}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>📄 Trabajo entregado</p>
          {entrega.archivoUrl ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '10px' }}>
                <a href={entrega.archivoUrl} target="_blank" rel="noreferrer"
                  style={{ color: '#a78bfa', fontSize: '13px', fontWeight: '600', textDecoration: 'none', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', padding: '6px 14px', borderRadius: '8px' }}>
                  🔗 Abrir en pestaña
                </a>
                <a href={entrega.archivoUrl} download={entrega.archivoNombre}
                  style={{ color: '#22c55e', fontSize: '13px', fontWeight: '600', textDecoration: 'none', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', padding: '6px 14px', borderRadius: '8px' }}>
                  ⬇ Descargar
                </a>
              </div>
              {esDocx(entrega.archivoNombre) ? (
                <iframe key={entrega.id} title="Trabajo alumno"
                  src={`https://docs.google.com/gview?url=${encodeURIComponent(entrega.archivoUrl)}&embedded=true`}
                  style={{ width: '100%', height: '560px', border: 'none', borderRadius: '10px', background: '#fff' }} allowFullScreen />
              ) : (
                <object key={entrega.id} data={`${entrega.archivoUrl}#toolbar=1&navpanes=0`} type="application/pdf"
                  style={{ width: '100%', height: '560px', borderRadius: '10px', border: 'none' }}>
                  <div style={{ padding: '32px', textAlign: 'center' }}>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '12px' }}>El navegador no puede mostrar el PDF aquí.</p>
                    <a href={entrega.archivoUrl} target="_blank" rel="noreferrer" style={{ color: '#a78bfa', fontWeight: '600' }}>📄 Abrir PDF →</a>
                  </div>
                </object>
              )}
            </div>
          ) : entrega.texto ? (
            <div style={s.textoTrabajo}>{entrega.texto}</div>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Sin contenido disponible</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button style={s.secondaryBtn} onClick={onClose}>← Volver a lista</button>
        </div>
      </div>
    </div>
  );
}
