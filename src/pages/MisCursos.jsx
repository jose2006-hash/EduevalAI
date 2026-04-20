// src/pages/MisCursos.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getMatriculasByAlumno, getCurso, getEntregasByAlumnoYCurso, calcularNotaFinal, logoutUser
} from '../firebase/services.js';
import { useAuth } from '../components/AuthContext.jsx';

export default function MisCursos() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) cargar();
  }, [user]);

  const cargar = async () => {
    const matriculas = await getMatriculasByAlumno(user.uid);
    const cursosData = await Promise.all(
      matriculas.map(async (m) => {
        const curso = await getCurso(m.cursoId);
        if (!curso) return null;
        const entregas = await getEntregasByAlumnoYCurso(user.uid, m.cursoId);
        const notaFinal = calcularNotaFinal(entregas, curso.tiposEvaluacion || []);
        const totalEntregas = entregas.filter(e => e.estado === 'evaluado').length;
        return { ...curso, matriculaId: m.id, entregas, notaFinal, totalEntregas };
      })
    );
    setCursos(cursosData.filter(Boolean));
    setLoading(false);
  };

  const handleLogout = async () => { await logoutUser(); navigate('/login'); };

  const nivelColor = (nota) => {
    if (nota === null || nota === undefined) return '#667eea';
    if (nota >= 17) return '#22c55e';
    if (nota >= 14) return '#3b82f6';
    if (nota >= 11) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) return (
    <div style={{ ...s.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)' }}>Cargando tus cursos...</p>
    </div>
  );

  return (
    <div style={s.container}>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>👨‍🎓 {userData?.nombre}</h1>
          <p style={s.subtitle}>Portal del Estudiante</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={s.joinBtn} onClick={() => navigate('/unirse')}>+ Unirse a curso</button>
          <button style={s.logoutBtn} onClick={handleLogout}>Salir</button>
        </div>
      </header>

      {/* Stats */}
      <div style={s.statsRow}>
        {[
          { icon: '📚', label: 'Cursos', value: cursos.length },
          { icon: '📝', label: 'Entregas', value: cursos.reduce((s, c) => s + c.totalEntregas, 0) },
          {
            icon: '⭐', label: 'Promedio general',
            value: cursos.filter(c => c.notaFinal !== null).length > 0
              ? (cursos.filter(c => c.notaFinal !== null)
                  .reduce((s, c) => s + c.notaFinal, 0) /
                  cursos.filter(c => c.notaFinal !== null).length).toFixed(1) + '/20'
              : '—'
          },
        ].map((st, i) => (
          <div key={i} style={s.statCard}>
            <span style={s.statIcon}>{st.icon}</span>
            <span style={s.statValue}>{st.value}</span>
            <span style={s.statLabel}>{st.label}</span>
          </div>
        ))}
      </div>

      {/* Cursos */}
      <h2 style={s.sectionTitle}>Mis Cursos</h2>
      {cursos.length === 0 ? (
        <div style={s.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
            No estás matriculado en ningún curso aún
          </p>
          <button style={s.joinBtn} onClick={() => navigate('/unirse')}>
            + Unirme a un curso
          </button>
        </div>
      ) : (
        <div style={s.cursosGrid}>
          {cursos.map((c, i) => {
            const color = nivelColor(c.notaFinal);
            const pendientes = c.entregas.filter(e => e.estado === 'pendiente').length;
            return (
              <div key={i} style={{ ...s.cursoCard, borderTop: `3px solid ${color}` }}
                onClick={() => navigate(`/curso/${c.id}`)}>
                <div style={s.cursoTop}>
                  <span style={s.cursoIcon}>📚</span>
                  <span style={{ ...s.codigoBadge, color, background: `${color}22` }}>{c.codigo}</span>
                </div>
                <h3 style={s.cursoNombre}>{c.nombre}</h3>
                <p style={s.cursometa}>{c.docenteNombre} · {c.ciclo}</p>

                <div style={s.tiposList}>
                  {c.tiposEvaluacion?.map((t, j) => (
                    <span key={j} style={s.tipoTag}>{t.nombre} {t.peso}%</span>
                  ))}
                </div>

                <div style={s.cursoFooter}>
                  <div style={s.notaBox}>
                    <span style={s.notaLabel}>Nota actual</span>
                    <span style={{ ...s.notaValue, color }}>
                      {c.notaFinal !== null ? `${c.notaFinal}/20` : '—'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={s.entregasLabel}>{c.totalEntregas} evaluados</span>
                    {pendientes > 0 && (
                      <span style={s.pendienteBadge}>{pendientes} pendiente{pendientes > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>

                <button style={s.verCursoBtn}>Ver curso →</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#0f0c29', fontFamily: "'Segoe UI', sans-serif", padding: '32px', color: '#fff' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' },
  title: { fontSize: '26px', fontWeight: '700', margin: '0 0 4px' },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 },
  joinBtn: { padding: '10px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  logoutBtn: { padding: '10px 20px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '14px' },
  statsRow: { display: 'flex', gap: '16px', marginBottom: '32px' },
  statCard: { flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  statIcon: { fontSize: '24px' },
  statValue: { fontSize: '28px', fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: '12px', color: 'rgba(255,255,255,0.4)' },
  sectionTitle: { fontSize: '18px', fontWeight: '600', margin: '0 0 16px' },
  emptyState: { textAlign: 'center', padding: '60px 0' },
  cursosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' },
  cursoCard: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'all 0.2s' },
  cursoTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  cursoIcon: { fontSize: '28px' },
  codigoBadge: { padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.1em' },
  cursoNombre: { color: '#fff', fontSize: '17px', fontWeight: '600', margin: '0 0 4px' },
  cursometa: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 14px' },
  tiposList: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' },
  tipoTag: { background: 'rgba(102,126,234,0.12)', color: '#a78bfa', padding: '3px 8px', borderRadius: '6px', fontSize: '11px' },
  cursoFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' },
  notaBox: { display: 'flex', flexDirection: 'column', gap: '2px' },
  notaLabel: { color: 'rgba(255,255,255,0.4)', fontSize: '11px' },
  notaValue: { fontSize: '24px', fontWeight: '800' },
  entregasLabel: { display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '12px', textAlign: 'right' },
  pendienteBadge: { display: 'block', color: '#f59e0b', fontSize: '11px', fontWeight: '600', marginTop: '2px' },
  verCursoBtn: { width: '100%', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },
};