// src/pages/DashboardDocente.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, PointElement, LineElement, Title, Tooltip, Legend
} from 'chart.js';
import {
  getTodasEntregas, getTodasEvaluaciones,
  getCursos, getAllAlumnos, logoutUser,
  eliminarEntrega, eliminarEvaluacion, actualizarEntrega,
} from '../firebase/services.js';
import { useAuth } from '../components/AuthContext.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend);

export default function DashboardDocente() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [entregas, setEntregas] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [confirm, setConfirm] = useState(null); // { id, nombre }
  const [detalle, setDetalle] = useState(null);
  const [notaManual, setNotaManual] = useState('');
  const [guardandoManual, setGuardandoManual] = useState(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    const [ents, crs, alms] = await Promise.all([
      getTodasEntregas(), getCursos(), getAllAlumnos()
    ]);
    setEntregas(ents);
    setCursos(crs);
    setAlumnos(alms);
    setLoading(false);
  };

  // Stats basadas en entregas evaluadas
  const evaluadas = entregas.filter(e => e.estado === 'evaluado');
  const stats = {
    total: entregas.length,
    promedio: evaluadas.length
      ? (evaluadas.reduce((s, e) => s + (e.notaFinal || 0), 0) / evaluadas.length).toFixed(1)
      : 0,
    aprobados: evaluadas.filter(e => (e.notaFinal || 0) >= 11).length,
    desaprobados: evaluadas.filter(e => (e.notaFinal || 0) < 11).length,
  };

  const distribucion = {
    Excelente: evaluadas.filter(e => e.notaFinal >= 18).length,
    Bueno: evaluadas.filter(e => e.notaFinal >= 14 && e.notaFinal < 18).length,
    Regular: evaluadas.filter(e => e.notaFinal >= 11 && e.notaFinal < 14).length,
    Insuficiente: evaluadas.filter(e => e.notaFinal < 11).length,
  };

  const doughnutData = {
    labels: Object.keys(distribucion),
    datasets: [{
      data: Object.values(distribucion),
      backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'],
      borderWidth: 0,
    }]
  };

  const barData = {
    labels: alumnos.slice(0, 10).map(a => a.nombre?.split(' ')[0] || 'Alumno'),
    datasets: [{
      label: 'Nota Final',
      data: alumnos.slice(0, 10).map(a => {
        const ev = evaluadas.find(e => e.alumnoUid === a.uid);
        return ev?.notaFinal || 0;
      }),
      backgroundColor: 'rgba(102, 126, 234, 0.8)',
      borderRadius: 8,
    }]
  };

  const chartOpts = {
    responsive: true,
    plugins: { legend: { labels: { color: 'rgba(255,255,255,0.7)', font: { size: 12 } } } },
    scales: {
      x: { ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { color: 'rgba(255,255,255,0.05)' }, max: 20 }
    }
  };

  const handleEliminar = async () => {
    if (!confirm) return;
    await eliminarEntrega(confirm.id);
    setEntregas(prev => prev.filter(e => e.id !== confirm.id));
    setConfirm(null);
  };

  const nivelPorNota = (nota) => {
    if (nota === null || nota === undefined) return '—';
    if (nota >= 18) return 'Excelente';
    if (nota >= 14) return 'Bueno';
    if (nota >= 11) return 'Regular';
    return 'Insuficiente';
  };

  const guardarNotaManual = async () => {
    if (!detalle) return;
    const n = Number(String(notaManual).replace(',', '.'));
    if (Number.isNaN(n) || n < 0 || n > 20) return;
    setGuardandoManual(true);
    try {
      const nivel = nivelPorNota(n);
      await actualizarEntrega(detalle.id, {
        estado: 'evaluado',
        notaFinal: Math.round(n * 10) / 10,
        notaManual: Math.round(n * 10) / 10,
        nivelGlobal: nivel,
      });
      setEntregas(prev => prev.map(e => e.id === detalle.id ? { ...e, estado: 'evaluado', notaFinal: Math.round(n * 10) / 10, notaManual: Math.round(n * 10) / 10, nivelGlobal: nivel } : e));
      setDetalle(d => d ? ({ ...d, estado: 'evaluado', notaFinal: Math.round(n * 10) / 10, notaManual: Math.round(n * 10) / 10, nivelGlobal: nivel }) : d);
    } finally {
      setGuardandoManual(false);
    }
  };

  const handleLogout = async () => { await logoutUser(); navigate('/login'); };

  if (loading) return <div style={styles.loading}>Cargando dashboard...</div>;

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarLogo}>🎓 AcademIA</div>
        <nav style={styles.nav}>
          {[
            { id: 'dashboard', icon: '📊', label: 'Dashboard' },
            { id: 'rubricas',  icon: '📋', label: 'Rúbricas' },
            { id: 'cursos',    icon: '📚', label: 'Cursos' },
            { id: 'alumnos',   icon: '👥', label: 'Alumnos' },
            { id: 'reportes',  icon: '📈', label: 'Reportes' },
          ].map(item => (
            <button key={item.id}
              style={{ ...styles.navItem, ...(activeTab === item.id ? styles.navItemActive : {}) }}
              onClick={() => activeTab === item.id ? null : navigate(`/${item.id}`)}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <button onClick={handleLogout} style={styles.logoutBtn}>🚪 Cerrar sesión</button>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Dashboard</h1>
            <p style={styles.pageSubtitle}>Bienvenido, {userData?.nombre || 'Docente'}</p>
          </div>
          <button style={styles.ctaBtn} onClick={() => navigate('/cursos')}>
            📚 Ir a mis cursos
          </button>
        </header>

        <div style={styles.statsGrid}>
          {[
            { label: 'Total Entregas',    value: stats.total,            icon: '📝', color: '#667eea' },
            { label: 'Promedio Clase',    value: `${stats.promedio}/20`, icon: '⭐', color: '#22c55e' },
            { label: 'Aprobados',         value: stats.aprobados,        icon: '✅', color: '#3b82f6' },
            { label: 'Desaprobados',      value: stats.desaprobados,     icon: '❌', color: '#ef4444' },
          ].map((s, i) => (
            <div key={i} style={{ ...styles.statCard, borderTop: `3px solid ${s.color}` }}>
              <div style={styles.statIcon}>{s.icon}</div>
              <div style={{ ...styles.statValue, color: s.color }}>{s.value}</div>
              <div style={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={styles.chartsGrid}>
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>Distribución de Notas</h3>
            <Doughnut data={doughnutData} options={{ responsive: true, plugins: { legend: { labels: { color: 'rgba(255,255,255,0.7)' } } } }} />
          </div>
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>Notas por Alumno</h3>
            <Bar data={barData} options={chartOpts} />
          </div>
        </div>

        {/* Tabla entregas recientes con botón eliminar */}
        <div style={styles.tableCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ ...styles.chartTitle, margin: 0 }}>Evaluaciones Recientes</h3>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
              {entregas.length} entrega{entregas.length !== 1 ? 's' : ''} en total
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Alumno', 'Trabajo', 'Curso', 'Tipo', 'Nota', 'Nivel', 'Fecha', ''].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entregas.slice(0, 12).map((ev, i) => (
                  <tr key={i} style={{ ...styles.tr, cursor: 'pointer' }} onClick={() => { setDetalle(ev); setNotaManual(ev?.notaManual ?? ''); }}>
                    <td style={styles.td}>{ev.alumnoNombre || '—'}</td>
                    <td style={styles.td}>
                      <span style={{ maxWidth: '140px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.titulo || '—'}
                      </span>
                    </td>
                    <td style={styles.td}>{ev.cursoNombre || '—'}</td>
                    <td style={styles.td}>
                      <span style={styles.tipoBadge}>{ev.tipoEvaluacion || '—'}</span>
                    </td>
                    <td style={styles.td}>
                      {ev.estado === 'evaluado' ? (
                        <span style={{
                          ...styles.badge,
                          background: ev.notaFinal >= 14 ? '#22c55e33' : ev.notaFinal >= 11 ? '#f59e0b33' : '#ef444433',
                          color:      ev.notaFinal >= 14 ? '#22c55e'   : ev.notaFinal >= 11 ? '#f59e0b'   : '#ef4444',
                        }}>
                          {ev.notaFinal}/20
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>⏳ Pendiente</span>
                      )}
                    </td>
                    <td style={styles.td}>{ev.nivelGlobal || '—'}</td>
                    <td style={styles.td}>
                      {ev.creadoEn?.toDate?.()?.toLocaleDateString('es-PE') || '—'}
                    </td>
                    <td style={styles.td}>
                      <button style={styles.deleteBtn} title="Eliminar entrega"
                        onClick={(e) => { e.stopPropagation(); setConfirm({ id: ev.id, nombre: ev.titulo || ev.alumnoNombre }); }}>
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entregas.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '40px' }}>
                Aún no hay entregas registradas
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Modal confirmación */}
      {confirm && (
        <div style={styles.overlay}>
          <div style={styles.confirmModal}>
            <p style={{ fontSize: '40px', margin: '0 0 12px' }}>🗑️</p>
            <h3 style={{ color: '#fff', fontSize: '18px', margin: '0 0 8px' }}>Eliminar entrega</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 24px', lineHeight: '1.5' }}>
              ¿Eliminar <strong style={{ color: '#fff' }}>"{confirm.nombre}"</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button style={styles.cancelBtn} onClick={() => setConfirm(null)}>Cancelar</button>
              <button style={styles.dangerBtn} onClick={handleEliminar}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle entrega + nota manual */}
      {detalle && (
        <div style={styles.overlay}>
          <div style={{ ...styles.confirmModal, maxWidth: '760px', textAlign: 'left', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
              <div>
                <h3 style={{ color: '#fff', fontSize: '18px', margin: 0 }}>{detalle.titulo || 'Entrega'}</h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '6px 0 0' }}>
                  {detalle.alumnoNombre || '—'} · {detalle.cursoNombre || '—'} · {detalle.tipoEvaluacion || '—'}
                </p>
              </div>
              <button onClick={() => setDetalle(null)} style={{ ...styles.cancelBtn, padding: '8px 12px' }}>✕</button>
            </div>

            {detalle.archivoUrl && (
              <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px' }}>📄 {detalle.archivoNombre || 'PDF'}</span>
                  <a href={detalle.archivoUrl} target="_blank" rel="noreferrer" style={{ color: '#a78bfa', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>
                    Abrir →
                  </a>
                </div>
                <iframe title="PDF entrega" src={detalle.archivoUrl} style={{ width: '100%', height: '420px', border: 'none', background: '#0f0c29' }} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px' }}>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nota actual</p>
                <div style={{ color: '#fff', fontSize: '34px', fontWeight: '800' }}>
                  {detalle.estado === 'evaluado' ? `${detalle.notaFinal ?? '—'}/20` : '⏳ Pendiente'}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '6px 0 0' }}>
                  Nivel: {detalle.nivelGlobal || '—'}
                </p>
              </div>

              <div style={{ background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.2)', borderRadius: '12px', padding: '14px' }}>
                <p style={{ color: '#a78bfa', fontSize: '11px', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nota manual</p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    value={notaManual}
                    onChange={(e) => setNotaManual(e.target.value)}
                    placeholder="0 - 20"
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(20,16,50,0.9)',
                      color: '#fff',
                      outline: 'none',
                      fontSize: '14px',
                    }}
                  />
                  <button
                    onClick={guardarNotaManual}
                    disabled={guardandoManual}
                    style={{ ...styles.ctaBtn, padding: '10px 14px', fontSize: '13px' }}
                  >
                    {guardandoManual ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: '10px 0 0' }}>
                  Al guardar, se reemplaza la nota final y el nivel global.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button style={styles.cancelBtn} onClick={() => setDetalle(null)}>Cerrar</button>
              <button
                style={styles.dangerBtn}
                onClick={() => { setDetalle(null); setConfirm({ id: detalle.id, nombre: detalle.titulo || detalle.alumnoNombre }); }}
              >
                Eliminar entrega
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', minHeight: '100vh', background: '#0f0c29', fontFamily: "'Segoe UI', sans-serif" },
  loading: { color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '18px' },
  sidebar: { width: '240px', background: 'rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 },
  sidebarLogo: { color: '#fff', fontSize: '20px', fontWeight: '700', padding: '0 12px 24px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 },
  navItem: { display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.5)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500', textAlign: 'left' },
  navItemActive: { background: 'rgba(102,126,234,0.2)', color: '#a78bfa' },
  logoutBtn: { display: 'flex', gap: '8px', alignItems: 'center', padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.4)', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: '14px', marginTop: 'auto' },
  main: { flex: 1, padding: '40px', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px' },
  pageTitle: { color: '#fff', fontSize: '28px', fontWeight: '700', margin: '0 0 4px' },
  pageSubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 },
  ctaBtn: { padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' },
  statCard: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' },
  statIcon: { fontSize: '24px', marginBottom: '12px' },
  statValue: { fontSize: '32px', fontWeight: '700', marginBottom: '4px' },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: '13px' },
  chartsGrid: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '24px' },
  chartCard: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' },
  chartTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', margin: '0 0 20px' },
  tableCard: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '600', textAlign: 'left', padding: '8px 12px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.05)' },
  td: { color: 'rgba(255,255,255,0.8)', fontSize: '13px', padding: '12px' },
  badge: { padding: '4px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' },
  tipoBadge: { background: 'rgba(102,126,234,0.15)', color: '#a78bfa', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', whiteSpace: 'nowrap' },
  deleteBtn: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', padding: '5px 9px', fontSize: '14px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  confirmModal: { background: '#1a1535', borderRadius: '20px', padding: '36px', width: '100%', maxWidth: '420px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' },
  cancelBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontSize: '14px' },
  dangerBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
};