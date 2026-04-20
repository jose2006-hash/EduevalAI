// src/pages/UnirseACurso.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  buscarCursos, solicitarMatricula,
  getMatriculasByAlumno, getCurso
} from '../firebase/services.js';
import { useAuth } from '../components/AuthContext.jsx';

export default function UnirseACurso() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState({ nombre: '', docenteNombre: '', seccion: '' });
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [cursosInfo, setCursosInfo] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [buscado, setBuscado] = useState(false);

  useEffect(() => { if (user) cargarMisMatriculas(); }, [user]);

  const cargarMisMatriculas = async () => {
    const mats = await getMatriculasByAlumno(user.uid);
    const infos = await Promise.all(mats.map(async m => {
      const c = await getCurso(m.cursoId);
      return { ...m, curso: c };
    }));
    setCursosInfo(infos.filter(i => i.curso));
  };

  const handleBuscar = async () => {
    if (!busqueda.nombre.trim() && !busqueda.docenteNombre.trim() && !busqueda.seccion.trim()) {
      return setError('Ingresa al menos un criterio de búsqueda');
    }
    setError(''); setResultados([]); setBuscando(true); setBuscado(false);
    try {
      const cursos = await buscarCursos(busqueda);
      setResultados(cursos);
      setBuscado(true);
      if (cursos.length === 0) setError('No se encontraron cursos. Verifica los datos con tu docente.');
    } catch (err) {
      setError('Error al buscar: ' + err.message);
    } finally {
      setBuscando(false);
    }
  };

  const handleSolicitar = async (curso) => {
    setMsg(''); setError('');
    try {
      const { estado, yaExiste } = await solicitarMatricula(
        user.uid, userData.nombre, userData.email, curso.id
      );
      if (yaExiste) {
        setMsg(
          estado === 'aprobado' ? `✅ Ya estás matriculado en "${curso.nombre}"` :
          estado === 'pendiente' ? `⏳ Ya enviaste solicitud a "${curso.nombre}". Espera la aprobación.` :
          `❌ Tu solicitud fue rechazada. Contacta al docente.`
        );
      } else {
        setMsg(`📨 Solicitud enviada a "${curso.nombre} - Sección ${curso.seccion}". El docente debe aprobarte.`);
      }
      setResultados([]);
      setBusqueda({ nombre: '', docenteNombre: '', seccion: '' });
      setBuscado(false);
      await cargarMisMatriculas();
    } catch (err) {
      setError('Error: ' + err.message);
    }
  };

  const estadoColor = (e) => ({ aprobado: '#22c55e', pendiente: '#f59e0b', rechazado: '#ef4444' }[e] || '#667eea');
  const estadoLabel = (e) => ({ aprobado: '✅ Aprobado', pendiente: '⏳ Pendiente aprobación', rechazado: '❌ Rechazado' }[e] || e);

  return (
    <div style={s.container}>
      <header style={s.header}>
        <button onClick={() => navigate('/mis-cursos')} style={s.backBtn}>← Mis Cursos</button>
        <h1 style={s.title}>Buscar y unirse a un Curso</h1>
      </header>

      {/* Buscador */}
      <div style={s.card}>
        <div style={s.cardIcon}>🔍</div>
        <h2 style={s.cardTitle}>Busca tu curso</h2>
        <p style={s.cardDesc}>
          Ingresa el nombre del curso, el nombre del profesor y/o la sección para encontrarlo.
          Tu docente te dará estos datos.
        </p>

        <div style={s.searchGrid}>
          <div>
            <label style={s.label}>Nombre del curso</label>
            <input style={s.input}
              placeholder="Ej: Contabilidad General"
              value={busqueda.nombre}
              onChange={e => setBusqueda(b => ({ ...b, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label style={s.label}>Nombre del profesor</label>
            <input style={s.input}
              placeholder="Ej: Gilder Cieza"
              value={busqueda.docenteNombre}
              onChange={e => setBusqueda(b => ({ ...b, docenteNombre: e.target.value }))}
            />
          </div>
          <div>
            <label style={s.label}>Sección</label>
            <input style={s.input}
              placeholder="Ej: A"
              value={busqueda.seccion}
              onChange={e => setBusqueda(b => ({ ...b, seccion: e.target.value.toUpperCase() }))}
              onKeyDown={e => e.key === 'Enter' && handleBuscar()}
            />
          </div>
        </div>

        <button style={s.searchBtn} onClick={handleBuscar} disabled={buscando}>
          {buscando ? '🔍 Buscando...' : '🔍 Buscar Curso'}
        </button>

        {error && <p style={s.error}>{error}</p>}
        {msg && (
          <div style={{
            ...s.msgBox,
            borderColor: msg.includes('✅') ? '#22c55e' : msg.includes('⏳') || msg.includes('📨') ? '#f59e0b' : '#ef4444'
          }}>
            {msg}
          </div>
        )}

        {/* Resultados */}
        {buscado && resultados.length > 0 && (
          <div style={s.resultados}>
            <p style={s.resultadosTitle}>{resultados.length} curso(s) encontrado(s)</p>
            {resultados.map((c, i) => {
              const yaMatriculado = cursosInfo.find(m => m.cursoId === c.id);
              return (
                <div key={i} style={s.cursoResult}>
                  <div style={s.cursoResultLeft}>
                    <div style={s.cursoResultTop}>
                      <span style={s.cursoResultNombre}>{c.nombre}</span>
                      {c.seccion && <span style={s.seccionBadge}>Sección {c.seccion}</span>}
                    </div>
                    <p style={s.cursoResultMeta}>
                      👨‍🏫 {c.docenteNombre}
                      {c.ciclo && ` · ${c.ciclo}`}
                      {c.descripcion && ` · ${c.descripcion}`}
                    </p>
                    <div style={s.tiposList}>
                      {c.tiposEvaluacion?.map((t, j) => (
                        <span key={j} style={s.tipoTag}>{t.nombre} {t.peso}%</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {yaMatriculado ? (
                      <span style={{
                        ...s.estadoBadge,
                        color: estadoColor(yaMatriculado.estado),
                        background: `${estadoColor(yaMatriculado.estado)}22`
                      }}>
                        {estadoLabel(yaMatriculado.estado)}
                      </span>
                    ) : (
                      <button style={s.solicitarBtn} onClick={() => handleSolicitar(c)}>
                        📨 Solicitar ingreso
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mis solicitudes */}
      {cursosInfo.length > 0 && (
        <div style={s.misMatriculas}>
          <h2 style={s.sectionTitle}>Mis solicitudes y cursos</h2>
          {cursosInfo.map((m, i) => (
            <div key={i} style={s.solicitudRow}>
              <div style={{ flex: 1 }}>
                <p style={s.solicitudNombre}>
                  {m.curso?.nombre}
                  {m.curso?.seccion && <span style={s.seccionSmall}> · Sección {m.curso.seccion}</span>}
                </p>
                <p style={s.solicitudDocente}>👨‍🏫 {m.curso?.docenteNombre} · {m.curso?.ciclo}</p>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <span style={{
                  ...s.estadoBadge,
                  color: estadoColor(m.estado),
                  background: `${estadoColor(m.estado)}22`
                }}>
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
  card: { background: 'rgba(255,255,255,0.04)', borderRadius: '20px', padding: '36px', border: '1px solid rgba(255,255,255,0.08)', maxWidth: '680px', margin: '0 auto' },
  cardIcon: { fontSize: '40px', marginBottom: '12px', textAlign: 'center' },
  cardTitle: { color: '#fff', fontSize: '20px', fontWeight: '700', margin: '0 0 8px', textAlign: 'center' },
  cardDesc: { color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '0 0 24px', lineHeight: '1.6', textAlign: 'center' },
  searchGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '12px', marginBottom: '16px' },
  label: { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' },
  input: { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  searchBtn: { width: '100%', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '15px' },
  error: { color: '#ef4444', fontSize: '13px', marginTop: '12px', textAlign: 'center' },
  msgBox: { marginTop: '16px', padding: '14px 16px', borderRadius: '12px', border: '1px solid', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.5' },
  resultados: { marginTop: '24px' },
  resultadosTitle: { color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '12px' },
  cursoResult: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(102,126,234,0.08)', borderRadius: '14px', padding: '18px 20px', marginBottom: '10px', border: '1px solid rgba(102,126,234,0.2)', gap: '16px' },
  cursoResultLeft: { flex: 1 },
  cursoResultTop: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
  cursoResultNombre: { color: '#fff', fontSize: '16px', fontWeight: '600' },
  seccionBadge: { background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' },
  cursoResultMeta: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 8px' },
  tiposList: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  tipoTag: { background: 'rgba(102,126,234,0.15)', color: '#a78bfa', padding: '3px 8px', borderRadius: '6px', fontSize: '11px' },
  solicitarBtn: { padding: '10px 18px', borderRadius: '10px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap' },
  estadoBadge: { display: 'inline-block', padding: '5px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' },
  misMatriculas: { maxWidth: '680px', margin: '32px auto 0' },
  sectionTitle: { color: '#fff', fontSize: '18px', fontWeight: '600', margin: '0 0 16px' },
  solicitudRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '16px 20px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.08)' },
  solicitudNombre: { color: '#fff', fontSize: '15px', fontWeight: '500', margin: '0 0 4px' },
  seccionSmall: { color: '#a78bfa', fontWeight: '400' },
  solicitudDocente: { color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 },
  irBtn: { color: '#a78bfa', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500', padding: 0 },
};