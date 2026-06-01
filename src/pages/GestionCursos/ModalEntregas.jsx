// src/pages/GestionCursos/ModalEntregas.jsx
import { useState } from 'react';
import { s } from './styles.js';
import ModalDetalleEntrega from './ModalDetalleEntrega.jsx';
import ModalReporte from './ModalReporte.jsx';
import { generarReporteEstadistico } from '../../openai/evaluador.js';

const iaBadgeStyle = (pct) => {
  if (pct == null) return null;
  const bg = pct >= 81 ? 'rgba(239,68,68,0.18)' : pct >= 56 ? 'rgba(245,158,11,0.18)' : pct >= 26 ? 'rgba(99,102,241,0.18)' : 'rgba(34,197,94,0.15)';
  const color = pct >= 81 ? '#ef4444' : pct >= 56 ? '#f59e0b' : pct >= 26 ? '#818cf8' : '#22c55e';
  return { background: bg, color, border: `1px solid ${color}44`, padding: '2px 7px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' };
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

export default function ModalEntregas({ cursoEntregas, entregas, docenteNombre, onEliminar, onNotaGuardada, onClose }) {
  const [filtroAlumno, setFiltroAlumno] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [gruposExpandidos, setGruposExpandidos] = useState({});
  const [entregaDetalle, setEntregaDetalle] = useState(null);
  const [reporte, setReporte] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [msgReporte, setMsgReporte] = useState('');

  const tiposUnicos = [...new Set(entregas.map(e => e.tipoEvaluacion).filter(Boolean))];

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

  const grupoStats = (items) => {
    const ev = items.filter(e => e.estado === 'evaluado');
    const prom = ev.length ? (ev.reduce((s, e) => s + (e.notaFinal || 0), 0) / ev.length).toFixed(1) : null;
    return { total: items.length, evaluados: ev.length, promedio: prom };
  };

  const handleGenerarReporte = async () => {
    setGenerando(true); setMsgReporte('');
    try {
      const resultado = await generarReporteEstadistico(entregas, cursoEntregas.nombre, docenteNombre);
      setReporte(resultado);
    } catch (err) { setMsgReporte('❌ ' + err.message); }
    finally { setGenerando(false); }
  };

  if (!cursoEntregas) return null;

  return (
    <>
      <div style={s.overlayEntregas}>
        <div style={s.modalEntregas}>
          <div style={s.modalHeader}>
            <div>
              <h2 style={s.modalTitle}>📋 Entregas — {cursoEntregas.nombre}</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
                Sección {cursoEntregas.seccion} · {cursoEntregas.ciclo} · {entregas.length} entregas · {grupos.length} temas
              </p>
            </div>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
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
              style={{ ...s.primaryBtn, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', opacity: generando ? 0.7 : 1 }}
              onClick={handleGenerarReporte} disabled={generando}>
              {generando ? '⏳ Generando...' : '📊 Reporte IA'}
            </button>
          </div>

          {msgReporte && <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 12px', flexShrink: 0 }}>{msgReporte}</p>}

          {grupos.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px' }}>
              No hay entregas{filtroAlumno || filtroTipo ? ' con ese filtro' : ' aún'}
            </p>
          ) : (
            <div style={s.entregasScrollContainer}>
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
                                  onClick={() => setEntregaDetalle(e)}>
                                  <td style={{ ...s.td, width: '28px', color: 'rgba(255,255,255,0.3)', fontWeight: '600' }}>{i + 1}</td>
                                  <td style={s.td}><span style={{ color: '#fff', fontWeight: '600', fontSize: '13px' }}>{e.alumnoNombre || '—'}</span></td>
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
                                        style={{ color: '#a78bfa', fontSize: '11px', textDecoration: 'none', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                        {e.archivoNombre?.toLowerCase().endsWith('.docx') ? '📝' : '📄'} {e.archivoNombre || 'Ver'}
                                      </a>
                                    ) : '—'}
                                  </td>
                                  <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                                    {(() => {
                                      const d = e.creadoEn?.toDate?.();
                                      if (!d) return <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>—</span>;
                                      return (
                                        <div>
                                          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                                            {d.toLocaleDateString('es-PE')}
                                          </div>
                                          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
                                            {d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td style={s.td} onClick={ev => ev.stopPropagation()}>
                                    <button style={s.expulsarBtn} onClick={() => onEliminar(e)}>🗑</button>
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

          <button style={{ ...s.primaryBtn, width: '100%', marginTop: '16px', flexShrink: 0 }} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>

      {entregaDetalle && (
        <ModalDetalleEntrega
          entrega={entregaDetalle}
          onNotaGuardada={(actualizada) => {
            setEntregaDetalle(actualizada);
            onNotaGuardada(actualizada);
          }}
          onEliminar={(e) => { setEntregaDetalle(null); onEliminar(e); }}
          onClose={() => setEntregaDetalle(null)}
        />
      )}

      {reporte && (
        <ModalReporte
          reporte={reporte}
          cursoNombre={cursoEntregas.nombre}
          totalEvaluadas={entregas.filter(e => e.estado === 'evaluado').length}
          onClose={() => setReporte(null)}
        />
      )}
    </>
  );
}