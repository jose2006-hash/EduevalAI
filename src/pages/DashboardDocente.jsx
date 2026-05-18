// src/pages/DashboardDocente.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, PointElement, LineElement, Title, Tooltip, Legend
} from 'chart.js';
import {
  getEntregasByDocente,
  getCursosByDocente,
  getAllAlumnos,
  logoutUser,
  eliminarEntrega,
  subirAvatar,
  exportarNotasExcel,
  exportarNotasPDF,
} from '../firebase/services.js';
import { useAuth } from '../components/AuthContext.jsx';
import ModalVisualizarEntrega from '../components/ModalVisualizarEntrega.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend);

export default function DashboardDocente() {
  const { userData, setUserData } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);

  const [entregas, setEntregas] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [confirm, setConfirm] = useState(null);
  const [entregaSeleccionada, setEntregaSeleccionada] = useState(null);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [subiendoAvatar, setSubiendoAvatar] = useState(false);

  // Export
  const [exportando, setExportando] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [cursofiltro, setCursoFiltro] = useState('');

  useEffect(() => { if (userData?.uid) cargar(); }, [userData]);
  useEffect(() => {
    if (userData?.avatarUrl) setAvatarUrl(userData.avatarUrl);
  }, [userData]);

  // Cerrar menú export al hacer click fuera
  useEffect(() => {
    const close = () => setShowExportMenu(false);
    if (showExportMenu) document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showExportMenu]);

  const cargar = async () => {
    const [ents, crs, alms] = await Promise.all([
      getEntregasByDocente(userData.uid),
      getCursosByDocente(userData.uid),
      getAllAlumnos(),
    ]);
    setEntregas(ents);
    setCursos(crs);
    setAlumnos(alms);
    setLoading(false);
  };

  // ── Avatar ──────────────────────────────────────────────────────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !userData?.uid) return;
    setSubiendoAvatar(true);
    try {
      const url = await subirAvatar(file, userData.uid);
      setAvatarUrl(url);
      if (setUserData) setUserData(prev => ({ ...prev, avatarUrl: url }));
    } catch (err) {
      console.error('Error subiendo avatar:', err);
    } finally {
      setSubiendoAvatar(false);
    }
  };

  // ── Exportar ────────────────────────────────────────────────────────────────
  const entregasParaExportar = cursofiltro
    ? entregas.filter(e => e.cursoId === cursofiltro)
    : entregas;

  const cursoNombreExport = cursofiltro
    ? cursos.find(c => c.id === cursofiltro)?.nombre || ''
    : '';

  const handleExportExcel = async () => {
    setExportando(true);
    setShowExportMenu(false);
    try {
      await exportarNotasExcel(entregasParaExportar, userData?.nombre || 'Docente', cursoNombreExport);
    } catch (err) {
      console.error('Error exportando Excel:', err);
      alert('Error al exportar Excel. Verifica que tienes instalado: npm install xlsx');
    } finally {
      setExportando(false);
    }
  };

  const handleExportPDF = async () => {
    setExportando(true);
    setShowExportMenu(false);
    try {
      await exportarNotasPDF(entregasParaExportar, userData?.nombre || 'Docente', cursoNombreExport);
    } catch (err) {
      console.error('Error exportando PDF:', err);
      alert(`Error al exportar PDF. Revisa la consola para más detalles. Si el problema persiste, instala: npm install jspdf jspdf-autotable`);
    } finally {
      setExportando(false);
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────
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

  const alumnosDelDocente = alumnos.filter(a =>
    entregas.some(e => e.alumnoUid === a.uid)
  );

  const barData = {
    labels: alumnosDelDocente.slice(0, 10).map(a => a.nombre?.split(' ')[0] || 'Alumno'),
    datasets: [{
      label: 'Nota Final',
      data: alumnosDelDocente.slice(0, 10).map(a => {
        const evs = evaluadas.filter(e => e.alumnoUid === a.uid);
        if (!evs.length) return 0;
        return (evs.reduce((s, e) => s + (e.notaFinal || 0), 0) / evs.length).toFixed(1) * 1;
      }),
      backgroundColor: 'rgba(102,126,234,0.8)',
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

  const handleNotaActualizada = (entregaActualizada) => {
    setEntregas(prev => prev.map(e => e.id === entregaActualizada.id ? entregaActualizada : e));
    setEntregaSeleccionada(entregaActualizada);
  };

  const handleLogout = async () => { await logoutUser(); navigate('/login'); };

  if (loading) return <div style={styles.loading}>Cargando dashboard...</div>;

  const initiales = (userData?.nombre || 'D').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarLogo}>🎓 EduEval AI</div>

        {/* Avatar del docente */}
        <div style={styles.avatarSection}>
          <div
            style={styles.avatarWrapper}
            onClick={() => avatarInputRef.current?.click()}
            title="Cambiar foto de perfil"
          >
            {subiendoAvatar ? (
              <div style={styles.avatarLoading}>⏳</div>
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={styles.avatarImg} />
            ) : (
              <div style={styles.avatarInitials}>{initiales}</div>
            )}
            <div style={styles.avatarOverlay}>📷</div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
          <p style={styles.avatarName}>{userData?.nombre || 'Docente'}</p>
          <p style={styles.avatarRole}>Docente</p>
        </div>

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

          {/* Controles de exportación */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Filtro de curso */}
            <select
              value={cursofiltro}
              onChange={e => setCursoFiltro(e.target.value)}
              style={styles.selectFiltro}
            >
              <option value="">Todos los cursos</option>
              {cursos.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>

            {/* Botón exportar con menú desplegable */}
            <div style={{ position: 'relative' }}>
              <button
                style={{ ...styles.exportBtn, opacity: exportando ? 0.6 : 1 }}
                disabled={exportando}
                onClick={e => { e.stopPropagation(); setShowExportMenu(m => !m); }}
              >
                {exportando ? '⏳ Exportando...' : '⬇️ Exportar notas'}
              </button>
              {showExportMenu && (
                <div style={styles.exportMenu} onClick={e => e.stopPropagation()}>
                  <button style={styles.exportMenuItem} onClick={handleExportExcel}>
                    <span>📊</span>
                    <div>
                      <strong>Excel (.xlsx)</strong>
                      <p>Tabla completa con resumen</p>
                    </div>
                  </button>
                  <button style={styles.exportMenuItem} onClick={handleExportPDF}>
                    <span>📄</span>
                    <div>
                      <strong>PDF</strong>
                      <p>Reporte con gráficos y notas</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button style={styles.ctaBtn} onClick={() => navigate('/cursos')}>
              📚 Mis cursos
            </button>
          </div>
        </header>

        {/* Stats */}
        <div style={styles.statsGrid}>
          {[
            { label: 'Total Entregas',  value: stats.total,            icon: '📝', color: '#667eea' },
            { label: 'Promedio Clase',  value: `${stats.promedio}/20`, icon: '⭐', color: '#22c55e' },
            { label: 'Aprobados',       value: stats.aprobados,        icon: '✅', color: '#3b82f6' },
            { label: 'Desaprobados',    value: stats.desaprobados,     icon: '❌', color: '#ef4444' },
          ].map((s, i) => (
            <div key={i} style={{ ...styles.statCard, borderTop: `3px solid ${s.color}` }}>
              <div style={styles.statIcon}>{s.icon}</div>
              <div style={{ ...styles.statValue, color: s.color }}>{s.value}</div>
              <div style={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Cursos del docente */}
        {cursos.length > 0 && (
          <div style={styles.cursosRow}>
            {cursos.map((c, i) => {
              const entsDelCurso = evaluadas.filter(e => e.cursoId === c.id);
              const prom = entsDelCurso.length
                ? (entsDelCurso.reduce((s, e) => s + (e.notaFinal || 0), 0) / entsDelCurso.length).toFixed(1)
                : '—';
              return (
                <div key={i} style={styles.cursoMini} onClick={() => navigate('/cursos')}>
                  <p style={styles.cursoMiniNombre}>{c.nombre}</p>
                  <p style={styles.cursoMiniSub}>Sección {c.seccion} · {c.ciclo}</p>
                  <p style={styles.cursoMiniNota}>{prom !== '—' ? `${prom}/20` : '—'}</p>
                  <p style={styles.cursoMiniCount}>{entsDelCurso.length} evaluado{entsDelCurso.length !== 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Charts */}
        <div style={styles.chartsGrid}>
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>Distribución de Notas</h3>
            <Doughnut data={doughnutData} options={{ responsive: true, plugins: { legend: { labels: { color: 'rgba(255,255,255,0.7)' } } } }} />
          </div>
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>Notas por Alumno</h3>
            {alumnosDelDocente.length > 0
              ? <Bar data={barData} options={chartOpts} />
              : <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingTop: '40px' }}>Sin datos aún</p>
            }
          </div>
        </div>

        {/* Tabla entregas */}
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
                {entregas.slice(0, 15).map((ev, i) => (
                  <tr key={i} style={styles.tr}>
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
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={styles.viewBtn} title="Ver detalle"
                          onClick={() => setEntregaSeleccionada(ev)}>
                          👁️
                        </button>
                        <button style={styles.deleteBtn} title="Eliminar entrega"
                          onClick={() => setConfirm({ id: ev.id, nombre: ev.titulo || ev.alumnoNombre })}>
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entregas.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '40px' }}>
                Aún no hay entregas en tus cursos
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

      {/* Modal visualizar entrega */}
      {entregaSeleccionada && (
        <ModalVisualizarEntrega
          entrega={entregaSeleccionada}
          onClose={() => setEntregaSeleccionada(null)}
          onNotaActualizada={handleNotaActualizada}
        />
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', minHeight: '100vh', background: '#0f0c29', fontFamily: "'Segoe UI', sans-serif" },
  loading: { color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '18px' },

  // Sidebar
  sidebar: { width: '240px', background: 'rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 },
  sidebarLogo: { color: '#fff', fontSize: '18px', fontWeight: '700', padding: '0 12px 16px', letterSpacing: '0.5px' },

  // Avatar
  avatarSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '12px' },
  avatarWrapper: {
    width: '72px', height: '72px', borderRadius: '50%',
    overflow: 'hidden', cursor: 'pointer', position: 'relative',
    border: '2px solid rgba(167,139,250,0.4)',
    boxShadow: '0 0 20px rgba(102,126,234,0.2)',
    marginBottom: '10px',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitials: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', fontSize: '22px', fontWeight: '700',
  },
  avatarLoading: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', background: 'rgba(102,126,234,0.15)' },
  avatarOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '18px', opacity: 0, transition: 'opacity 0.2s',
    ':hover': { opacity: 1 },
  },
  avatarName: { color: '#fff', fontSize: '13px', fontWeight: '600', margin: '0 0 3px', textAlign: 'center' },
  avatarRole: { color: 'rgba(167,139,250,0.8)', fontSize: '11px', margin: 0, letterSpacing: '1px', textTransform: 'uppercase' },

  nav: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 },
  navItem: { display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.5)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500', textAlign: 'left' },
  navItemActive: { background: 'rgba(102,126,234,0.2)', color: '#a78bfa' },
  logoutBtn: { display: 'flex', gap: '8px', alignItems: 'center', padding: '12px 16px', borderRadius: '12px', color: 'rgba(255,255,255,0.4)', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: '14px', marginTop: 'auto' },

  // Main
  main: { flex: 1, padding: '40px', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px', flexWrap: 'wrap', gap: '16px' },
  pageTitle: { color: '#fff', fontSize: '28px', fontWeight: '700', margin: '0 0 4px' },
  pageSubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 },

  // Export
  selectFiltro: {
    padding: '10px 14px', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff', fontSize: '13px', cursor: 'pointer', outline: 'none',
  },
  exportBtn: {
    padding: '10px 20px', borderRadius: '10px',
    background: 'rgba(34,197,94,0.15)',
    border: '1px solid rgba(34,197,94,0.35)',
    color: '#22c55e', fontSize: '13px', fontWeight: '600',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  exportMenu: {
    position: 'absolute', top: '110%', right: 0, zIndex: 200,
    background: '#1a1535', borderRadius: '14px', padding: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    minWidth: '220px',
  },
  exportMenuItem: {
    display: 'flex', gap: '12px', alignItems: 'center',
    width: '100%', padding: '12px 14px', borderRadius: '10px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#fff', textAlign: 'left',
    fontSize: '13px',
    ':hover': { background: 'rgba(255,255,255,0.06)' },
  },

  ctaBtn: { padding: '10px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },

  // Stats
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' },
  statCard: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' },
  statIcon: { fontSize: '24px', marginBottom: '12px' },
  statValue: { fontSize: '32px', fontWeight: '700', marginBottom: '4px' },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: '13px' },

  // Cursos
  cursosRow: { display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' },
  cursoMini: { flex: 1, minWidth: '160px', background: 'rgba(102,126,234,0.08)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(102,126,234,0.15)', cursor: 'pointer' },
  cursoMiniNombre: { color: '#fff', fontSize: '14px', fontWeight: '600', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cursoMiniSub: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 8px' },
  cursoMiniNota: { color: '#a78bfa', fontSize: '20px', fontWeight: '700', margin: '0 0 2px' },
  cursoMiniCount: { color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0 },

  // Charts
  chartsGrid: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '24px' },
  chartCard: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' },
  chartTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', margin: '0 0 20px' },

  // Table
  tableCard: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '600', textAlign: 'left', padding: '8px 12px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.05)' },
  td: { color: 'rgba(255,255,255,0.8)', fontSize: '13px', padding: '12px' },
  badge: { padding: '4px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' },
  tipoBadge: { background: 'rgba(102,126,234,0.15)', color: '#a78bfa', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', whiteSpace: 'nowrap' },
  viewBtn: { background: 'rgba(59,182,246,0.12)', border: '1px solid rgba(59,182,246,0.2)', color: '#3b82f6', borderRadius: '8px', cursor: 'pointer', padding: '5px 9px', fontSize: '14px' },
  deleteBtn: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', padding: '5px 9px', fontSize: '14px' },

  // Modals
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  confirmModal: { background: '#1a1535', borderRadius: '20px', padding: '36px', width: '100%', maxWidth: '420px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' },
  cancelBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontSize: '14px' },
  dangerBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
};