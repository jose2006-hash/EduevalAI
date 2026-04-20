// src/pages/UnirseACurso.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCursoByCodigo, matricularAlumno, getMatriculasByAlumno, getCurso } from '../firebase/services.js';
import { useAuth } from '../components/AuthContext.jsx';

export default function UnirseACurso() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [uniendose, setUniendose] = useState(false);
  const [cursoEncontrado, setCursoEncontrado] = useState(null);
  const [miscursos, setMisCursos] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) cargarMisCursos();
  }, [user]);

  const cargarMisCursos = async () => {
    const matriculas = await getMatriculasByAlumno(user.uid);
    const cursos = await Promise.all(matriculas.map(m => getCurso(m.cursoId)));
    setMisCursos(cursos.filter(Boolean).map((c, i) => ({ ...c, matriculaId: matriculas[i].id })));
  };

  const handleBuscar = async () => {
    if (!codigo.trim()) return setError('Ingresa un código');
    setError('');
    setCursoEncontrado(null);
    setBuscando(true);
    try {
      const curso = await getCursoByCodigo(codigo.trim());
      if (!curso) {
        setError('Código no encontrado. Verifica con tu docente.');
      } else {
        setCursoEncontrado(curso);
      }
    } catch (err) {
      setError('Error al buscar: ' + err.message);
    } finally {
      setBuscando(false);
    }
  };

  const handleUnirse = async () => {
    if (!cursoEncontrado) return;
    setUniendose(true);
    setMsg('');
    try {
      const { yaExiste } = await matricularAlumno(user.uid, userData.nombre, cursoEncontrado.id);
      if (yaExiste) {
        setMsg('⚠️ Ya estás matriculado en este curso');
      } else {
        setMsg('✅ Te uniste exitosamente al curso');
        await cargarMisCursos();
      }
      setCursoEncontrado(null);
      setCodigo('');
    } catch (err) {
      setError('Error al unirse: ' + err.message);
    } finally {
      setUniendose(false);
    }
  };

  return (
    <div style={s.container}>
      <header style={s.header}>
        <button onClick={() => navigate('/mis-cursos')} style={s.backBtn}>← Mis Cursos</button>
        <h1 style={s.title}>Unirse a un Curso</h1>
      </header>

      {/* Buscador de código */}
      <div style={s.card}>
        <div style={s.cardIcon}>🔑</div>
        <h2 style={s.cardTitle}>Ingresa el código del curso</h2>
        <p style={s.cardDesc}>Tu docente te proporcionará un código de 8 caracteres para acceder al curso</p>

        <div style={s.searchRow}>
          <input
            style={s.codeInput}
            placeholder="Ej: ABCD-1234"
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleBuscar()}
            maxLength={9}
          />
          <button style={s.searchBtn} onClick={handleBuscar} disabled={buscando}>
            {buscando ? '🔍 Buscando...' : 'Buscar'}
          </button>
        </div>

        {error && <p style={s.error}>{error}</p>}
        {msg && <p style={{ color: msg.includes('✅') ? '#22c55e' : '#f59e0b', fontSize: '14px', marginTop: '12px' }}>{msg}</p>}

        {/* Resultado de búsqueda */}
        {cursoEncontrado && (
          <div style={s.cursoPreview}>
            <div style={s.previewHeader}>
              <span style={s.previewIcon}>📚</span>
              <div>
                <h3 style={s.previewNombre}>{cursoEncontrado.nombre}</h3>
                <p style={s.previewMeta}>
                  {cursoEncontrado.docenteNombre} · {cursoEncontrado.ciclo}
                </p>
              </div>
              <span style={s.codigoBadge}>{cursoEncontrado.codigo}</span>
            </div>

            {cursoEncontrado.descripcion && (
              <p style={s.previewDesc}>{cursoEncontrado.descripcion}</p>
            )}

            <div style={s.tiposList}>
              {cursoEncontrado.tiposEvaluacion?.map((t, i) => (
                <span key={i} style={s.tipoTag}>{t.nombre} {t.peso}%</span>
              ))}
            </div>

            <button style={s.joinBtn} onClick={handleUnirse} disabled={uniendose}>
              {uniendose ? 'Uniéndose...' : '✅ Unirme a este curso'}
            </button>
          </div>
        )}
      </div>

      {/* Mis cursos actuales */}
      {miscursos.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={s.sectionTitle}>Mis cursos actuales</h2>
          <div style={s.cursosGrid}>
            {miscursos.map((c, i) => (
              <div key={i} style={s.miniCurso}
                onClick={() => navigate(`/curso/${c.id}`)}
              >
                <span style={s.miniIcon}>📚</span>
                <div>
                  <p style={s.miniNombre}>{c.nombre}</p>
                  <p style={s.miniMeta}>{c.docenteNombre} · {c.ciclo}</p>
                </div>
                <span style={s.miniArrow}>→</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#0f0c29', fontFamily: "'Segoe UI', sans-serif", padding: '32px', color: '#fff' },
  header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' },
  backBtn: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px' },
  title: { color: '#fff', fontSize: '24px', fontWeight: '700', margin: 0 },
  card: { background: 'rgba(255,255,255,0.04)', borderRadius: '20px', padding: '40px', border: '1px solid rgba(255,255,255,0.08)', maxWidth: '560px', margin: '0 auto', textAlign: 'center' },
  cardIcon: { fontSize: '48px', marginBottom: '16px' },
  cardTitle: { color: '#fff', fontSize: '20px', fontWeight: '700', margin: '0 0 8px' },
  cardDesc: { color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '0 0 28px', lineHeight: '1.6' },
  searchRow: { display: 'flex', gap: '10px', justifyContent: 'center' },
  codeInput: {
    padding: '14px 20px', borderRadius: '12px', border: '2px solid rgba(102,126,234,0.3)',
    background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '18px',
    fontWeight: '700', letterSpacing: '0.15em', outline: 'none',
    width: '180px', textAlign: 'center',
  },
  searchBtn: { padding: '14px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '15px' },
  error: { color: '#ef4444', fontSize: '13px', marginTop: '12px' },
  cursoPreview: { marginTop: '24px', background: 'rgba(102,126,234,0.08)', borderRadius: '14px', padding: '20px', border: '1px solid rgba(102,126,234,0.2)', textAlign: 'left' },
  previewHeader: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' },
  previewIcon: { fontSize: '32px', flexShrink: 0 },
  previewNombre: { color: '#fff', fontSize: '16px', fontWeight: '600', margin: '0 0 4px' },
  previewMeta: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 },
  codigoBadge: { marginLeft: 'auto', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.1em', flexShrink: 0 },
  previewDesc: { color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 14px' },
  tiposList: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '18px' },
  tipoTag: { background: 'rgba(102,126,234,0.15)', color: '#a78bfa', padding: '3px 10px', borderRadius: '6px', fontSize: '12px' },
  joinBtn: { width: '100%', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '15px' },
  sectionTitle: { color: '#fff', fontSize: '18px', fontWeight: '600', margin: '0 0 16px' },
  cursosGrid: { display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '560px', margin: '0 auto' },
  miniCurso: { display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '16px 20px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' },
  miniIcon: { fontSize: '24px', flexShrink: 0 },
  miniNombre: { color: '#fff', fontSize: '15px', fontWeight: '500', margin: '0 0 2px' },
  miniMeta: { color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 },
  miniArrow: { marginLeft: 'auto', color: 'rgba(255,255,255,0.3)', fontSize: '18px' },
};