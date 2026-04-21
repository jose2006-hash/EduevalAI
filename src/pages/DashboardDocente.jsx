// src/pages/DashboardDocente.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, PointElement, LineElement, Title, Tooltip, Legend
} from 'chart.js';
import { getTodasEvaluaciones, getCursos, getAllAlumnos, logoutUser } from '../firebase/services.js';
import { useAuth } from '../components/AuthContext.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend);

export default function DashboardDocente() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const load = async () => {
      const [evs, crs, alms] = await Promise.all([
        getTodasEvaluaciones(), getCursos(), getAllAlumnos()
      ]);
      setEvaluaciones(evs);
      setCursos(crs);
      setAlumnos(alms);
      setLoading(false);
    };
    load();
  }, []);

  const stats = {
    total: evaluaciones.length,
    promedio: evaluaciones.length
      ? (evaluaciones.reduce((s, e) => s + (e.notaFinal || 0), 0) / evaluaciones.length).toFixed(1)
      : 0,
    aprobados: evaluaciones.filter(e => (e.notaFinal || 0) >= 11).length,
    desaprobados: evaluaciones.filter(e => (e.notaFinal || 0) < 11).length,
  };

  const distribucion = {
    Excelente: evaluaciones.filter(e => e.notaFinal >= 18).length,
    Bueno: evaluaciones.filter(e => e.notaFinal >= 14 && e.notaFinal < 18).length,
    Regular: evaluaciones.filter(e => e.notaFinal >= 11 && e.notaFinal < 14).length,
    Insuficiente: evaluaciones.filter(e => e.notaFinal < 11).length,
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
        const ev = evaluaciones.find(e => e.alumnoUid === a.uid);
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
            <button
              key={item.id}
              style={{ ...styles.navItem, ...(activeTab === item.id ? styles.navItemActive : {}) }}
              onClick={() => activeTab === item.id ? null : navigate(`/${item.id}`)}
            >
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
          {/* ✅ Botón ahora lleva a Cursos, no a Evaluar */}
          <button style={styles.ctaBtn} onClick={() => navigate('/cursos')}>
            📚 Ir a mis cursos
          </button>
        </header>

        <div style={styles.statsGrid}>
          {[
            { label: 'Total Evaluaciones', value: stats.total,            icon: '📝', color: '#667eea' },
            { label: 'Promedio Clase',     value: `${stats.promedio}/20`, icon: '⭐', color: '#22c55e' },
            { label: 'Aprobados',          value: stats.aprobados,        icon: '✅', color: '#3b82f6' },
            { label: 'Desaprobados',       value: stats.desaprobados,     icon: '❌', color: '#ef4444' },
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

        <div style={styles.tableCard}>
          <h3 style={styles.chartTitle}>Evaluaciones Recientes</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Alumno', 'Tema', 'Curso', 'Nota', 'Nivel', 'Fecha'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evaluaciones.slice(0, 8).map((ev, i) => (
                  <tr key={i} style={styles.tr}>
                    <td style={styles.td}>{ev.alumnoNombre || '—'}</td>
                    <td style={styles.td}>{ev.titulo || ev.tema || '—'}</td>
                    <td style={styles.td}>{ev.cursoNombre || '—'}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        background: ev.notaFinal >= 14 ? '#22c55e33' : ev.notaFinal >= 11 ? '#f59e0b33' : '#ef444433',
                        color:      ev.notaFinal >= 14 ? '#22c55e'   : ev.notaFinal >= 11 ? '#f59e0b'   : '#ef4444',
                      }}>
                        {ev.notaFinal}/20
                      </span>
                    </td>
                    <td style={styles.td}>{ev.nivelGlobal || '—'}</td>
                    <td style={styles.td}>
                      {ev.creadoEn?.toDate?.()?.toLocaleDateString('es-PE') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {evaluaciones.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '40px' }}>
                Aún no hay evaluaciones registradas
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const styles = {
  container: { display: 'flex', minHeight: '100vh', background: '#0f0c29', fontFamily: "'Segoe UI', sans-serif" },
  loading: { color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '18px' },
  sidebar: { width: '240px', background: 'rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 },
  sidebarLogo: { color: '#fff', fontSize: '20px', fontWeight: '700', padding: '0 12px 24px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 },
  navItem: { display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.5)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500', textAlign: 'left', transition: 'all 0.2s' },
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
  th: { color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: '600', textAlign: 'left', padding: '8px 12px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.05)' },
  td: { color: 'rgba(255,255,255,0.8)', fontSize: '14px', padding: '12px 12px' },
  badge: { padding: '4px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' },
};