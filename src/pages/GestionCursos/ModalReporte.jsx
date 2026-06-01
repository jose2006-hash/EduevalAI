// src/pages/GestionCursos/ModalReporte.jsx
import { useState } from 'react';
import { s } from './styles.js';

const nivelColor = (nota) => {
  if (!nota && nota !== 0) return '#667eea';
  if (nota >= 17) return '#22c55e';
  if (nota >= 14) return '#3b82f6';
  if (nota >= 11) return '#f59e0b';
  return '#ef4444';
};
const perfilColor = (p) => p === 'Excelente' ? '#22c55e' : p === 'Bueno' ? '#3b82f6' : p === 'Regular' ? '#f59e0b' : '#ef4444';
const prioridadColor = (p) => p === 'Alta' ? '#ef4444' : p === 'Media' ? '#f59e0b' : '#22c55e';

export default function ModalReporte({ reporte, cursoNombre, totalEvaluadas, onClose }) {
  const [tab, setTab] = useState('resumen');

  return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, maxWidth: '960px' }}>
        <div style={s.modalHeader}>
          <div>
            <h2 style={s.modalTitle}>📊 Reporte Estadístico — {cursoNombre}</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
              Generado por IA · {totalEvaluadas} entregas evaluadas
            </p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[
            { id: 'resumen', label: '📋 Resumen' },
            { id: 'temas',   label: '📚 Temas' },
            { id: 'alumnos', label: '👥 Alumnos' },
            { id: 'plan',    label: '🎯 Plan de acción' },
          ].map(t => (
            <button key={t.id}
              style={{ ...s.tabBtn, ...(tab === t.id ? s.tabBtnActive : {}) }}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '4px' }}>

          {/* ── Resumen ── */}
          {tab === 'resumen' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Promedio',   val: `${reporte.estadisticas?.promedioGeneral}/20`, color: nivelColor(reporte.estadisticas?.promedioGeneral) },
                  { label: 'Aprobación', val: `${reporte.estadisticas?.tasaAprobacion}%`,    color: reporte.estadisticas?.tasaAprobacion >= 70 ? '#22c55e' : '#f59e0b' },
                  { label: 'Excelentes', val: reporte.estadisticas?.distribucion?.Excelente || 0, color: '#22c55e' },
                  { label: 'En riesgo',  val: reporte.estadisticas?.distribucion?.Insuficiente || 0, color: '#ef4444' },
                ].map((st, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: st.color }}>{st.val}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{st.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                <p style={{ color: '#a78bfa', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Diagnóstico general</p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>{reporte.resumenEjecutivo}</p>
              </div>
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
                        <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: '3px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Temas ── */}
          {tab === 'temas' && (
            <div>
              {reporte.temasCriticos?.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={s.subTitle}>🔴 Temas críticos (requieren refuerzo urgente)</h3>
                  {reporte.temasCriticos.map((t, i) => (
                    <div key={i} style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '12px', padding: '16px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>{t.tema}</span>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <span style={{ color: nivelColor(t.promedio), fontWeight: '700' }}>{t.promedio}/20</span>
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

          {/* ── Alumnos ── */}
          {tab === 'alumnos' && (
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
                        <p style={{ color: '#22c55e', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase' }}>Fortalezas</p>
                        {al.fortalezas.map((f, j) => <p key={j} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '0 0 2px' }}>• {f}</p>)}
                      </div>
                    )}
                    {al.debilidades?.length > 0 && (
                      <div>
                        <p style={{ color: '#f59e0b', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase' }}>Áreas a mejorar</p>
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

          {/* ── Plan ── */}
          {tab === 'plan' && (
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

        <button style={{ ...s.primaryBtn, width: '100%', marginTop: '20px' }} onClick={onClose}>
          Cerrar reporte
        </button>
      </div>
    </div>
  );
}
