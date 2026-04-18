// src/pages/EvaluarTrabajo.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRubricas, getCursos, getAllAlumnos, guardarEvaluacion } from '../firebase/services.js';
import { evaluarTrabajo } from '../openai/evaluador.js';
import { useAuth } from '../components/AuthContext.jsx';

export default function EvaluarTrabajo() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: config, 2: work text, 3: result
  const [rubricas, setRubricas] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [form, setForm] = useState({
    alumnoUid: '', alumnoNombre: '',
    cursoId: '', cursoNombre: '',
    rubricaId: '', tema: '',
    trabajoTexto: '',
  });
  const [rubricaSeleccionada, setRubricaSeleccionada] = useState(null);
  const [evaluando, setEvaluando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const [rubs, crs, alms] = await Promise.all([getRubricas(), getCursos(), getAllAlumnos()]);
      setRubricas(rubs);
      setCursos(crs);
      setAlumnos(alms);
    };
    load();
  }, []);

  const handleRubricaChange = (id) => {
    const r = rubricas.find(r => r.id === id);
    setRubricaSeleccionada(r);
    setForm(f => ({ ...f, rubricaId: id }));
  };

  const handleEvaluar = async () => {
    if (!form.trabajoTexto.trim()) return setError('Ingresa el texto del trabajo');
    if (!rubricaSeleccionada) return setError('Selecciona una rúbrica');
    setError('');
    setEvaluando(true);
    try {
      const res = await evaluarTrabajo(
        form.trabajoTexto,
        rubricaSeleccionada,
        form.cursoNombre,
        form.tema
      );
      setResultado(res);

      // Save to Firebase
      await guardarEvaluacion({
        alumnoUid: form.alumnoUid,
        alumnoNombre: form.alumnoNombre,
        cursoId: form.cursoId,
        cursoNombre: form.cursoNombre,
        rubricaId: form.rubricaId,
        rubricaNombre: rubricaSeleccionada.nombre,
        tema: form.tema,
        trabajoTexto: form.trabajoTexto,
        docenteUid: userData?.uid,
        ...res,
      });
      setStep(3);
    } catch (err) {
      setError('Error al evaluar: ' + err.message);
    } finally {
      setEvaluando(false);
    }
  };

  const nivelColor = (nivel) => {
    const map = { Excelente: '#22c55e', Bueno: '#3b82f6', Regular: '#f59e0b', Insuficiente: '#ef4444' };
    return map[nivel] || '#667eea';
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate('/')} style={styles.backBtn}>← Dashboard</button>
        <h1 style={styles.title}>Evaluar Trabajo Académico</h1>
        <div style={styles.steps}>
          {['Configurar', 'Trabajo', 'Resultado'].map((s, i) => (
            <div key={i} style={{ ...styles.step, ...(step === i + 1 ? styles.stepActive : step > i + 1 ? styles.stepDone : {}) }}>
              <span style={styles.stepNum}>{step > i + 1 ? '✓' : i + 1}</span>
              <span style={styles.stepLabel}>{s}</span>
            </div>
          ))}
        </div>
      </header>

      <div style={styles.content}>
        {/* STEP 1: Configuration */}
        {step === 1 && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>📋 Configuración de Evaluación</h2>
            <div style={styles.grid2}>
              <div style={styles.field}>
                <label style={styles.label}>Alumno</label>
                <select style={styles.select}
                  value={form.alumnoUid}
                  onChange={e => {
                    const a = alumnos.find(x => x.uid === e.target.value);
                    setForm(f => ({ ...f, alumnoUid: e.target.value, alumnoNombre: a?.nombre || '' }));
                  }}>
                  <option value="">Seleccionar alumno...</option>
                  {alumnos.map(a => <option key={a.uid} value={a.uid}>{a.nombre}</option>)}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Curso</label>
                <select style={styles.select}
                  value={form.cursoId}
                  onChange={e => {
                    const c = cursos.find(x => x.id === e.target.value);
                    setForm(f => ({ ...f, cursoId: e.target.value, cursoNombre: c?.nombre || '' }));
                  }}>
                  <option value="">Seleccionar curso...</option>
                  {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Tema del Trabajo</label>
                <input style={styles.input} placeholder="Ej: Derivadas e integrales..."
                  value={form.tema} onChange={e => setForm(f => ({ ...f, tema: e.target.value }))} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Rúbrica de Evaluación</label>
                <select style={styles.select} value={form.rubricaId}
                  onChange={e => handleRubricaChange(e.target.value)}>
                  <option value="">Seleccionar rúbrica...</option>
                  {rubricas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
            </div>

            {rubricaSeleccionada && (
              <div style={styles.rubricaPreview}>
                <h3 style={styles.previewTitle}>Vista previa: {rubricaSeleccionada.nombre}</h3>
                <div style={styles.criteriosList}>
                  {rubricaSeleccionada.criterios?.map((c, i) => (
                    <div key={i} style={styles.criterioItem}>
                      <span style={styles.criterioNombre}>{c.nombre}</span>
                      <span style={styles.criterioPeso}>{c.peso}% — máx {c.puntajeMax} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button style={styles.primaryBtn}
              onClick={() => {
                if (!form.alumnoUid || !form.rubricaId || !form.tema) return setError('Completa todos los campos');
                setError(''); setStep(2);
              }}>
              Continuar →
            </button>
            {error && <p style={styles.error}>{error}</p>}
          </div>
        )}

        {/* STEP 2: Work text */}
        {step === 2 && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>📝 Texto del Trabajo</h2>
            <p style={styles.helper}>Pega o escribe el contenido del trabajo del alumno.</p>
            <textarea
              style={styles.textarea}
              placeholder="Pega aquí el trabajo académico del alumno..."
              value={form.trabajoTexto}
              onChange={e => setForm(f => ({ ...f, trabajoTexto: e.target.value }))}
              rows={18}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button style={styles.secondaryBtn} onClick={() => setStep(1)}>← Atrás</button>
              <button style={styles.primaryBtn} onClick={handleEvaluar} disabled={evaluando}>
                {evaluando ? '🤖 Evaluando con IA...' : '🚀 Evaluar con IA'}
              </button>
            </div>
            {evaluando && (
              <div style={styles.evaluandoMsg}>
                <div style={styles.spinner} />
                Analizando el trabajo con GPT-4o...
              </div>
            )}
            {error && <p style={styles.error}>{error}</p>}
          </div>
        )}

        {/* STEP 3: Results */}
        {step === 3 && resultado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header result */}
            <div style={{ ...styles.card, textAlign: 'center', borderTop: `4px solid ${nivelColor(resultado.nivelGlobal)}` }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                {resultado.notaFinal >= 18 ? '🏆' : resultado.notaFinal >= 14 ? '⭐' : resultado.notaFinal >= 11 ? '📚' : '📖'}
              </div>
              <div style={{ color: nivelColor(resultado.nivelGlobal), fontSize: '48px', fontWeight: '800' }}>
                {resultado.notaFinal}<span style={{ fontSize: '24px', opacity: 0.6 }}>/20</span>
              </div>
              <div style={{ color: nivelColor(resultado.nivelGlobal), fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>
                {resultado.nivelGlobal}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                {form.alumnoNombre} — {form.tema} — {form.cursoNombre}
              </p>
            </div>

            {/* Criteria detail */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>📊 Detalle por Criterios</h3>
              {resultado.criterios?.map((c, i) => (
                <div key={i} style={styles.criterioResult}>
                  <div style={styles.criterioResultHeader}>
                    <span style={styles.criterioResultNombre}>{c.nombre}</span>
                    <span style={{ color: nivelColor(c.nivel), fontWeight: '700' }}>
                      {c.puntajeObtenido}/{c.puntajeMaximo} — {c.nivel}
                    </span>
                  </div>
                  <div style={styles.progressBar}>
                    <div style={{
                      ...styles.progressFill,
                      width: `${(c.puntajeObtenido / c.puntajeMaximo) * 100}%`,
                      background: nivelColor(c.nivel),
                    }} />
                  </div>
                  <p style={styles.criterioComment}>{c.comentario}</p>
                </div>
              ))}
            </div>

            {/* Feedback */}
            <div style={styles.grid2}>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>💪 Fortalezas</h3>
                <ul style={styles.feedbackList}>
                  {resultado.fortalezas?.map((f, i) => (
                    <li key={i} style={{ ...styles.feedbackItem, color: '#22c55e' }}>✓ {f}</li>
                  ))}
                </ul>
              </div>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>📈 Áreas de Mejora</h3>
                <ul style={styles.feedbackList}>
                  {resultado.areasDesMejora?.map((a, i) => (
                    <li key={i} style={{ ...styles.feedbackItem, color: '#f59e0b' }}>⚠ {a}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>💬 Retroalimentación General</h3>
              <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: '1.7', marginBottom: '20px' }}>
                {resultado.retroalimentacionGeneral}
              </p>
              <h4 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Recomendaciones
              </h4>
              <ul style={styles.feedbackList}>
                {resultado.recomendaciones?.map((r, i) => (
                  <li key={i} style={{ ...styles.feedbackItem, color: '#a78bfa' }}>→ {r}</li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={styles.secondaryBtn} onClick={() => { setStep(1); setResultado(null); setForm({ alumnoUid: '', alumnoNombre: '', cursoId: '', cursoNombre: '', rubricaId: '', tema: '', trabajoTexto: '' }); }}>
                + Nueva Evaluación
              </button>
              <button style={styles.primaryBtn} onClick={() => navigate('/')}>
                Ver Dashboard →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0f0c29', fontFamily: "'Segoe UI', sans-serif", padding: '32px' },
  header: { display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px', flexWrap: 'wrap' },
  backBtn: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px' },
  title: { color: '#fff', fontSize: '24px', fontWeight: '700', flex: 1, margin: 0 },
  steps: { display: 'flex', gap: '8px' },
  step: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' },
  stepActive: { background: 'rgba(102,126,234,0.2)', border: '1px solid rgba(102,126,234,0.4)' },
  stepDone: { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' },
  stepNum: { color: '#fff', fontSize: '12px', fontWeight: '700' },
  stepLabel: { color: 'rgba(255,255,255,0.6)', fontSize: '13px' },
  content: { maxWidth: '900px', margin: '0 auto' },
  card: { background: 'rgba(255,255,255,0.04)', borderRadius: '20px', padding: '32px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '0' },
  cardTitle: { color: '#fff', fontSize: '18px', fontWeight: '600', margin: '0 0 24px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' },
  field: { marginBottom: '0' },
  label: { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' },
  input: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(30,25,60,0.9)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.6', fontFamily: 'inherit', boxSizing: 'border-box' },
  helper: { color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '16px' },
  rubricaPreview: { background: 'rgba(102,126,234,0.08)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(102,126,234,0.2)', marginBottom: '24px' },
  previewTitle: { color: '#a78bfa', fontSize: '14px', fontWeight: '600', marginBottom: '12px' },
  criteriosList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  criterioItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  criterioNombre: { color: 'rgba(255,255,255,0.7)', fontSize: '14px' },
  criterioPeso: { color: 'rgba(255,255,255,0.4)', fontSize: '12px' },
  primaryBtn: { padding: '14px 28px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '15px' },
  secondaryBtn: { padding: '14px 28px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontWeight: '500', fontSize: '15px' },
  error: { color: '#ff6b6b', fontSize: '13px', marginTop: '12px' },
  evaluandoMsg: { display: 'flex', alignItems: 'center', gap: '12px', color: '#a78bfa', fontSize: '14px', marginTop: '16px', padding: '16px', background: 'rgba(102,126,234,0.1)', borderRadius: '10px' },
  spinner: { width: '20px', height: '20px', border: '2px solid rgba(167,139,250,0.3)', borderTop: '2px solid #a78bfa', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  criterioResult: { marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  criterioResultHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  criterioResultNombre: { color: '#fff', fontSize: '15px', fontWeight: '500' },
  progressBar: { height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' },
  progressFill: { height: '100%', borderRadius: '4px', transition: 'width 0.5s ease' },
  criterioComment: { color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0, lineHeight: '1.5' },
  feedbackList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' },
  feedbackItem: { fontSize: '14px', lineHeight: '1.5' },
};
