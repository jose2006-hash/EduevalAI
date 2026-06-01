// src/pages/GestionCursos/ModalActividades.jsx
import { useState } from 'react';
import { s } from './styles.js';

const fechaLimiteDisplay = (fechaStr) => {
  if (!fechaStr) return null;
  const fecha = new Date(fechaStr);
  const hoy = new Date();
  return { fecha, vencida: fecha < hoy, diff: Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24)) };
};

export default function ModalActividades({
  cursoActividades, actividades, rubricas, msgAct,
  onGuardar, onEliminar, onClose,
}) {
  const [showForm, setShowForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editFecha, setEditFecha] = useState('');
  const [form, setForm] = useState({
    titulo: '', tipoEvaluacion: cursoActividades?.tiposEvaluacion?.[0]?.nombre || '',
    descripcion: '', enunciadoTexto: '', enunciadoNombre: '', rubricaId: '', fechaLimite: '',
  });

  const leerPDF = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ').replace(/\s{3,}/g, '\n').substring(0, 8000);
      resolve(text);
    };
    reader.readAsText(file, 'latin1');
  });

  const handleEnunciado = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLeyendo(true);
    const texto = await leerPDF(file);
    setForm(f => ({ ...f, enunciadoTexto: texto, enunciadoNombre: file.name }));
    setLeyendo(false);
  };

  const handleGuardar = async () => {
    setGuardando(true);
    await onGuardar(form);
    setGuardando(false);
    setShowForm(false);
    setForm({ titulo: '', tipoEvaluacion: cursoActividades?.tiposEvaluacion?.[0]?.nombre || '', descripcion: '', enunciadoTexto: '', enunciadoNombre: '', rubricaId: '', fechaLimite: '' });
  };

  if (!cursoActividades) return null;

  return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, maxWidth: '720px' }}>
        <div style={s.modalHeader}>
          <div>
            <h2 style={s.modalTitle}>📝 Actividades — {cursoActividades.nombre}</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
              Sección {cursoActividades.seccion} · {cursoActividades.ciclo}
            </p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {msgAct && (
          <div style={{ color: msgAct.includes('✅') ? '#22c55e' : '#ef4444', marginBottom: '16px', fontSize: '13px', background: msgAct.includes('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '8px' }}>
            {msgAct}
          </div>
        )}

        {/* Lista de actividades */}
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
                        <span style={{ background: fl.vencida ? 'rgba(239,68,68,0.15)' : fl.diff <= 2 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.1)', color: fl.vencida ? '#ef4444' : fl.diff <= 2 ? '#f59e0b' : '#22c55e', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                          📅 {fl.vencida ? 'Vencida' : `${fl.diff}d restantes`} · {new Date(a.fechaLimite).toLocaleDateString('es-PE')}
                        </span>
                      )}
                    </div>
                    {a.descripcion && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>{a.descripcion.substring(0, 120)}{a.descripcion.length > 120 ? '…' : ''}</p>}
                  </div>

                  {editingId === a.id ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input type="datetime-local" style={{ ...s.input, padding: '6px 8px', height: '36px' }}
                        value={editFecha} onChange={e => setEditFecha(e.target.value)} />
                      <button style={s.primaryBtn} onClick={async () => {
                        await onGuardar({ _edit: true, id: a.id, fechaLimite: editFecha });
                        setEditingId(null); setEditFecha('');
                      }}>Guardar</button>
                      <button style={s.secondaryBtn} onClick={() => { setEditingId(null); setEditFecha(''); }}>Cancelar</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={s.secondaryBtn} onClick={() => { setEditingId(a.id); setEditFecha(a.fechaLimite || ''); }}>✏️</button>
                      <button style={s.expulsarBtn} onClick={() => onEliminar(a)}>🗑</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {actividades.length === 0 && !showForm && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>
            No hay actividades publicadas aún
          </div>
        )}

        {/* Formulario nueva actividad */}
        {showForm ? (
          <div style={s.actForm}>
            <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: '600', margin: '0 0 16px' }}>Nueva actividad</h3>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Título *</label>
                <input style={s.input} placeholder="Ej: Práctica Calificada 1"
                  value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Tipo de evaluación *</label>
                <select style={s.select} value={form.tipoEvaluacion}
                  onChange={e => setForm(f => ({ ...f, tipoEvaluacion: e.target.value }))}>
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
                <input style={s.input} placeholder="Ej: Resolver ejercicios de los temas 3 y 4"
                  value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>📅 Fecha límite</label>
                <input style={s.input} type="datetime-local"
                  value={form.fechaLimite} onChange={e => setForm(f => ({ ...f, fechaLimite: e.target.value }))} />
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '4px' }}>Los alumnos verán cuánto tiempo les queda</p>
              </div>
            </div>

            <div style={s.enunciadoBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={s.label}>📄 Enunciado / Guía</label>
                <label style={s.uploadBtn}>
                  {leyendo ? '⏳ Leyendo...' : form.enunciadoNombre ? `✅ ${form.enunciadoNombre}` : '📎 Subir PDF'}
                  <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleEnunciado} />
                </label>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0 }}>
                La IA usará este enunciado para evaluar si el alumno respondió lo solicitado
              </p>
              {!form.enunciadoNombre && (
                <textarea style={{ ...s.textarea, marginTop: '10px', minHeight: '80px' }}
                  placeholder="O escribe el enunciado directamente aquí..."
                  value={form.enunciadoTexto}
                  onChange={e => setForm(f => ({ ...f, enunciadoTexto: e.target.value }))} />
              )}
            </div>

            {rubricas.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <label style={s.label}>Rúbrica de evaluación</label>
                <select style={s.select} value={form.rubricaId}
                  onChange={e => setForm(f => ({ ...f, rubricaId: e.target.value }))}>
                  <option value="">Sin rúbrica específica</option>
                  {rubricas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={s.secondaryBtn} onClick={() => setShowForm(false)}>Cancelar</button>
              <button style={s.primaryBtn} onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Publicando...' : '📢 Publicar actividad'}
              </button>
            </div>
          </div>
        ) : (
          <button style={{ ...s.primaryBtn, width: '100%' }} onClick={() => setShowForm(true)}>
            + Nueva actividad
          </button>
        )}
      </div>
    </div>
  );
}
