// src/pages/UnirseACurso.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCursoByCodigo, solicitarMatricula,
  getMatriculasByAlumno, getCurso
} from '../firebase/services.js';
import { useAuth } from '../components/AuthContext.jsx';

export default function UnirseACurso() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [cursoEncontrado, setCursoEncontrado] = useState(null);
  const [matriculas, setMatriculas] = useState([]);
  const [cursosInfo, setCursosInfo] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (user) cargarMatriculas(); }, [user]);

  const cargarMatriculas = async () => {
    const mats = await getMatriculasByAlumno(user.uid);
    const infos = await Promise.all(mats.map(async m => {
      const c = await getCurso(m.cursoId);
      return { ...m, curso: c };
    }));
    setMatriculas(mats);
    setCursosInfo(infos.filter(i => i.curso));
  };

  const handleBuscar = async () => {
    if (!codigo.trim()) return setError('Ingresa un código');
    setError(''); setCursoEncontrado(null);
    setBuscando(true);
    try {
      const curso = await getCursoByCodigo(codigo.trim());
      if (!curso) setError('Código no encontrado. Verifica con tu docente.');
      else setCursoEncontrado(curso);
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setBuscando(false);
    }
  };

  const handleSolicitar = async () => {
    if (!cursoEncontrado) return;
    try {
      const { estado, yaExiste } = await solicitarMatricula(
        user.uid, userData.nombre, userData.email, cursoEncontrado.id
      );
      if (yaExiste) {
        setMsg(estado === 'aprobado'
          ? '✅ Ya estás matriculado en este curso'
          : estado === 'pendiente'
          ? '⏳ Tu solicitud ya fue enviada, espera aprobación del docente'
          : '❌ Tu solicitud fue rechazada. Contacta al docente');
      } else {
        setMsg('📨 Solicitud enviada. El docente debe aprobarte para acceder al curso.');
      }
      setCursoEncontrado(null);
      setCodigo('');
      await cargarMatriculas();
    } catch (err) {
      setError('Error: ' + err.message);
    }
  };

  const estadoColor = (estado) => ({
    aprobado: '#22c55e', pendiente: '#f59e0b', rechazado: '#ef4444'
  }[estado] || '#667eea');

  const estadoLabel = (estado) => ({
    aprobado: '✅ Aprobado', pendiente: '⏳ Pendiente', rechazado: '❌ Rechazado'
  }[estado] || estado);

  return (
    <div style={s.container}>
      <header style={s.header}>
        <button onClick={() => navigate('/mis-cursos')} style={s.backBtn}>← Mis Cursos</button>
        <h1 style={s.title}>Unirse a un Curso</h1>
      </header>

      <div style={s.card}>
        <div style={s.cardIcon}>🔑</div>
        <h2 style={s.cardTitle}>Ingresa el código del curso</h2>
        <p style={s.cardDesc}>Tu docente te proporcionará un código de 8 caracteres. Una vez que envíes la solicitud, el docente debe aprobarte.</p>

        <div style={s.searchRow}>
          <input style={s.codeInput}
            placeholder="ABCD-1234"
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleBuscar()}
            maxLength={9}
          />
          <button style={s.searchBtn} onClick={handleBuscar} disabled={buscando}>
            {buscando ? '🔍...' : 'Buscar'}
          </button>
        </div>

        {error && <p style={s.error}>{error}</p>}
        {msg && (
          <div style={{ ...s.msgBox, borderColor: msg.includes('✅') ? '#22c55e' : msg.includes('⏳') ? '#f59e0b' : '#ef4444' }}>
            {msg}
          </div>
        )}

        {cursoEncontrado && (
          <div style={s.cursoPreview}>
            <div style={s.previewHeader}>
              <span style={{ fontSize: '32px' }}>📚</span>
              <div style={{ flex: 1 }}>
                <h3 style={s.previewNombre}>{cursoEncontrado.nombre}</h3>
                <p style={s.previewMeta}>{cursoEncontrado.docenteNombre} · {cursoEncontrado.ciclo}</p>
              </div>
              <span style={s.codigoBadge}>{cursoEncontrado.codigo}</span>
            </div>
            <div style={s.tiposList}>
              {cursoEncontrado.tiposEvaluacion?.map((t, i) => (
                <span key={i} style={s.tipoTag}>{t.nombre} {t.peso}%</span>
              ))}
            </div>
            <button style={s.joinBtn} onClick={handleSolicitar}>
              📨 Enviar solicitud de ingreso
            </button>
          </div>
        )}
      </div>

      {/* Estado de mis solicitudes */}
      {cursosInfo.length > 0 && (
        <div style={{ marginTop: '32px', maxWidth: '560px', margin: '32px auto 0' }}>
          <h2 style={s.sectionTitle}>Mis solicitudes</h2>
          {cursosInfo.map((m, i) => (
            <div key={i} style={s.solicitudRow}>
              <div style={{ flex: 1 }}>
                <p style={s.solicitudNombre}>{m.curso?.nombre}</p>
                <p style={s.solicitudDocente}>{m.curso?.docenteNombre} · {m.curso?.ciclo}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ ...s.estadoBadge, color: estadoColor(m.estado), background: `${estadoColor(m.estado)}22` }}>
                  {estadoLabel(m.estado)}
                </span>
                {m.estado === 'aprobado' && (
                  <button style={s.irBtn} onClick={() => navigate(`/curso/${m.cursoId}`)}>
                    Ir al curso →
                  </button>
                )}
              </div>
            </div>
          ))}
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
  codeInput: { padding: '14px 20px', borderRadius: '12px', border: '2px solid rgba(102,126,234,0.3)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '18px', fontWeight: '700', letterSpacing: '0.15em', outline: 'none', width: '180px', textAlign: 'center' },
  searchBtn: { padding: '14px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '15px' },
  error: { color: '#ef4444', fontSize: '13px', marginTop: '12px' },
  msgBox: { marginTop: '16px', padding: '14px 16px', borderRadius: '12px', border: '1px solid', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.5' },
  cursoPreview: { marginTop: '24px', background: 'rgba(102,126,234,0.08)', borderRadius: '14px', padding: '20px', border: '1px solid rgba(102,126,234,0.2)', textAlign: 'left' },
  previewHeader: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' },
  previewNombre: { color: '#fff', fontSize: '16px', fontWeight: '600', margin: '0 0 4px' },
  previewMeta: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 },
  codigoBadge: { background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.1em', flexShrink: 0 },
  tiposList: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' },
  tipoTag: { background: 'rgba(102,126,234,0.15)', color: '#a78bfa', padding: '3px 10px', borderRadius: '6px', fontSize: '12px' },
  joinBtn: { width: '100%', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '15px' },
  sectionTitle: { color: '#fff', fontSize: '18px', fontWeight: '600', margin: '0 0 16px' },
  solicitudRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '16px 20px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.08)' },
  solicitudNombre: { color: '#fff', fontSize: '15px', fontWeight: '500', margin: '0 0 4px' },
  solicitudDocente: { color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 },
  estadoBadge: { display: 'inline-block', padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' },
  irBtn: { display: 'block', marginTop: '6px', color: '#a78bfa', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' },
};