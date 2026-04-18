// src/pages/VistaAlumno.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEvaluacionesByAlumno, logoutUser } from '../firebase/services.js';
import { useAuth } from '../components/AuthContext.jsx';

export default function VistaAlumno() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getEvaluacionesByAlumno(user.uid).then(evs => {
      setEvaluaciones(evs);
      setLoading(false);
    });
  }, [user]);

  const nivelColor = (nivel) => {
    const map = { Excelente: '#22c55e', Bueno: '#3b82f6', Regular: '#f59e0b', Insuficiente: '#ef4444' };
    return map[nivel] || '#667eea';
  };

  const promedio = evaluaciones.length
    ? (evaluaciones.reduce((s, e) => s + (e.notaFinal || 0), 0) / evaluaciones.length).toFixed(1)
    : '—';

  if (loading) return <div style={styles.loading}>Cargando tus evaluaciones...</div>;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>👤 {userData?.nombre || 'Alumno'}</h1>
          <p style={styles.subtitle}>Mi portal de evaluaciones</p>
        </div>
        <button onClick={async () => { await logoutUser(); navigate('/login'); }} style={styles.logoutBtn}>
          Cerrar sesión
        </button>
      </header>

      {/* Summary */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>📝</div>
          <div style={styles.summaryValue}>{evaluaciones.length}</div>
          <div style={styles.summaryLabel}>Trabajos evaluados</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>⭐</div>
          <div style={{ ...styles.summaryValue, color: '#22c55e' }}>{promedio}{evaluaciones.length ? '/20' : ''}</div>
          <div style={styles.summaryLabel}>Promedio general</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>✅</div>
          <div style={{ ...styles.summaryValue, color: '#3b82f6' }}>
            {evaluaciones.filter(e => e.notaFinal >= 11).length}
          </div>
          <div style={styles.summaryLabel}>Trabajos aprobados</div>
        </div>
      </div>

      <div style={styles.layout}>
        {/* Evaluations list */}
        <div style={styles.listPanel}>
          <h2 style={styles.panelTitle}>Mis Evaluaciones</h2>
          {evaluaciones.length === 0 ? (
            <p style={styles.empty}>Aún no tienes evaluaciones registradas</p>
          ) : (
            evaluaciones.map((ev, i) => (
              <div
                key={i}
                style={{ ...styles.evalItem, ...(seleccionada?.id === ev.id ? styles.evalItemActive : {}) }}
                onClick={() => setSeleccionada(ev)}
              >
                <div style={styles.evalHeader}>
                  <span style={styles.evalTema}>{ev.tema}</span>
                  <span style={{ ...styles.evalNota, color: nivelColor(ev.nivelGlobal) }}>
                    {ev.notaFinal}/20
                  </span>
                </div>
                <div style={styles.evalMeta}>
                  <span>{ev.cursoNombre}</span>
                  <span>{ev.creadoEn?.toDate?.()?.toLocaleDateString('es-PE')}</span>
                </div>
                <span style={{ ...styles.nivelBadge, background: `${nivelColor(ev.nivelGlobal)}22`, color: nivelColor(ev.nivelGlobal) }}>
                  {ev.nivelGlobal}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Detail panel */}
        <div style={styles.detailPanel}>
          {!seleccionada ? (
            <div style={styles.selectPrompt}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <p>Selecciona una evaluación para ver el detalle</p>
            </div>
          ) : (
            <>
              <div style={styles.detailHeader}>
                <h2 style={styles.detailTema}>{seleccionada.tema}</h2>
                <p style={styles.detailCurso}>{seleccionada.cursoNombre}</p>
                <div style={{ textAlign: 'center', margin: '20px 0' }}>
                  <div style={{ color: nivelColor(seleccionada.nivelGlobal), fontSize: '56px', fontWeight: '800' }}>
                    {seleccionada.notaFinal}
                    <span style={{ fontSize: '24px', opacity: 0.5 }}>/20</span>
                  </div>
                  <div style={{ color: nivelColor(seleccionada.nivelGlobal), fontWeight: '600', fontSize: '18px' }}>
                    {seleccionada.nivelGlobal}
                  </div>
                </div>
              </div>

              {/* Criteria */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>📊 Detalle por Criterios</h3>
                {seleccionada.criterios?.map((c, i) => (
                  <div key={i} style={styles.criterioDetail}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: '#fff', fontSize: '14px' }}>{c.nombre}</span>
                      <span style={{ color: nivelColor(c.nivel), fontWeight: '600', fontSize: '14px' }}>
                        {c.puntajeObtenido}/{c.puntajeMaximo}
                      </span>
                    </div>
                    <div style={styles.progressBar}>
                      <div style={{ ...styles.progressFill, width: `${(c.puntajeObtenido / c.puntajeMaximo) * 100}%`, background: nivelColor(c.nivel) }} />
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: '4px 0 0' }}>{c.comentario}</p>
                  </div>
                ))}
              </div>

              {/* Retroalimentación */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>💬 Retroalimentación del Docente IA</h3>
                <p style={styles.retroText}>{seleccionada.retroalimentacionGeneral}</p>
              </div>

              {/* Strengths & improvements */}
              <div style={styles.twoCol}>
                <div style={styles.section}>
                  <h4 style={{ ...styles.sectionTitle, color: '#22c55e' }}>💪 Fortalezas</h4>
                  <ul style={styles.feedList}>
                    {seleccionada.fortalezas?.map((f, i) => (
                      <li key={i} style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '6px', fontSize: '13px' }}>✓ {f}</li>
                    ))}
                  </ul>
                </div>
                <div style={styles.section}>
                  <h4 style={{ ...styles.sectionTitle, color: '#f59e0b' }}>📈 Mejorar</h4>
                  <ul style={styles.feedList}>
                    {seleccionada.areasDesMejora?.map((a, i) => (
                      <li key={i} style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '6px', fontSize: '13px' }}>⚠ {a}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommendations */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>🎯 Recomendaciones</h3>
                <ul style={styles.feedList}>
                  {seleccionada.recomendaciones?.map((r, i) => (
                    <li key={i} style={{ color: '#a78bfa', marginBottom: '8px', fontSize: '14px' }}>→ {r}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0f0c29', fontFamily: "'Segoe UI', sans-serif", padding: '32px', color: '#fff' },
  loading: { color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' },
  title: { fontSize: '28px', fontWeight: '700', margin: '0 0 4px' },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 },
  logoutBtn: { padding: '10px 20px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' },
  summaryCard: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '24px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' },
  summaryIcon: { fontSize: '28px', marginBottom: '8px' },
  summaryValue: { fontSize: '32px', fontWeight: '700', marginBottom: '4px' },
  summaryLabel: { color: 'rgba(255,255,255,0.4)', fontSize: '13px' },
  layout: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' },
  listPanel: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)', height: 'fit-content' },
  panelTitle: { fontSize: '16px', fontWeight: '600', margin: '0 0 16px', color: '#fff' },
  empty: { color: 'rgba(255,255,255,0.3)', fontSize: '14px', textAlign: 'center', padding: '24px 0' },
  evalItem: { padding: '16px', borderRadius: '12px', marginBottom: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', transition: 'all 0.15s' },
  evalItemActive: { background: 'rgba(102,126,234,0.15)', border: '1px solid rgba(102,126,234,0.3)' },
  evalHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  evalTema: { color: '#fff', fontSize: '14px', fontWeight: '500' },
  evalNota: { fontWeight: '700', fontSize: '14px' },
  evalMeta: { display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '8px' },
  nivelBadge: { padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' },
  detailPanel: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '28px', border: '1px solid rgba(255,255,255,0.08)' },
  selectPrompt: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'rgba(255,255,255,0.3)', fontSize: '15px' },
  detailHeader: { textAlign: 'center', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '20px' },
  detailTema: { fontSize: '22px', fontWeight: '700', margin: '0 0 4px' },
  detailCurso: { color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '14px' },
  section: { marginBottom: '24px' },
  sectionTitle: { color: 'rgba(255,255,255,0.7)', fontSize: '14px', fontWeight: '600', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  criterioDetail: { marginBottom: '16px' },
  progressBar: { height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' },
  progressFill: { height: '100%', borderRadius: '3px' },
  retroText: { color: 'rgba(255,255,255,0.65)', lineHeight: '1.7', fontSize: '14px' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  feedList: { listStyle: 'none', padding: 0, margin: 0 },
};
