// src/pages/GestionRubricas.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRubricas, guardarRubrica, eliminarRubrica, getCursos } from '../firebase/services.js';

const rubricaEjemplo = {
  nombre: 'Rúbrica: Trabajo de Investigación - Cálculo',
  cursoId: '',
  puntajeTotal: 20,
  criterios: [
    { nombre: 'Contenido Matemático', descripcion: 'Corrección y profundidad de los conceptos matemáticos', peso: 40, puntajeMax: 8, niveles: { excelente: 'Dominio total, sin errores', bueno: 'Mayormente correcto, errores menores', regular: 'Comprensión parcial, errores significativos', insuficiente: 'Errores graves o contenido ausente' } },
    { nombre: 'Metodología', descripcion: 'Claridad del proceso y pasos seguidos', peso: 25, puntajeMax: 5, niveles: { excelente: 'Metodología clara y bien estructurada', bueno: 'Metodología adecuada con algunas imprecisiones', regular: 'Metodología incompleta', insuficiente: 'Sin metodología definida' } },
    { nombre: 'Redacción y Presentación', descripcion: 'Calidad de la redacción académica y presentación', peso: 20, puntajeMax: 4, niveles: { excelente: 'Excelente redacción, sin errores', bueno: 'Buena redacción, errores menores', regular: 'Redacción aceptable con errores', insuficiente: 'Redacción deficiente' } },
    { nombre: 'Conclusiones', descripcion: 'Calidad y coherencia de las conclusiones', peso: 15, puntajeMax: 3, niveles: { excelente: 'Conclusiones sólidas y bien argumentadas', bueno: 'Conclusiones adecuadas', regular: 'Conclusiones superficiales', insuficiente: 'Sin conclusiones o irrelevantes' } },
  ]
};

export default function GestionRubricas() {
  const navigate = useNavigate();
  const [rubricas, setRubricas] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [nueva, setNueva] = useState({ nombre: '', cursoId: '', puntajeTotal: 20, criterios: [] });
  const [guardando, setGuardando] = useState(false);
  const [confirm, setConfirm] = useState(null); // { id, nombre }

  useEffect(() => {
    const load = async () => {
      const [rubs, crs] = await Promise.all([getRubricas(), getCursos()]);
      setRubricas(rubs);
      setCursos(crs);
    };
    load();
  }, []);

  const addCriterio = () => setNueva(n => ({
    ...n,
    criterios: [...n.criterios, { nombre: '', descripcion: '', peso: 0, puntajeMax: 0, niveles: { excelente: '', bueno: '', regular: '', insuficiente: '' } }]
  }));

  const updateCriterio = (i, field, val) => setNueva(n => {
    const crs = [...n.criterios];
    if (field.startsWith('nivel_')) {
      crs[i] = { ...crs[i], niveles: { ...crs[i].niveles, [field.replace('nivel_', '')]: val } };
    } else {
      crs[i] = { ...crs[i], [field]: field === 'peso' || field === 'puntajeMax' ? Number(val) : val };
    }
    return { ...n, criterios: crs };
  });

  const removeCriterio = (i) => setNueva(n => ({
    ...n, criterios: n.criterios.filter((_, idx) => idx !== i)
  }));

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await guardarRubrica(nueva);
      const rubs = await getRubricas();
      setRubricas(rubs);
      setShowForm(false);
      setNueva({ nombre: '', cursoId: '', puntajeTotal: 20, criterios: [] });
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async () => {
    if (!confirm) return;
    try {
      await eliminarRubrica(confirm.id);
      setRubricas(r => r.filter(x => x.id !== confirm.id));
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setConfirm(null);
  };

  const usarEjemplo = () => setNueva({ ...rubricaEjemplo, cursoId: cursos[0]?.id || '' });

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate('/')} style={styles.backBtn}>← Dashboard</button>
        <h1 style={styles.title}>Gestión de Rúbricas</h1>
        <button style={styles.primaryBtn} onClick={() => setShowForm(true)}>+ Nueva Rúbrica</button>
      </header>

      <div style={styles.grid}>
        {rubricas.map((r, i) => (
          <div key={i} style={styles.rubricaCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={styles.rubricaIcon}>📋</div>
              <button style={styles.deleteBtn} title="Eliminar rúbrica"
                onClick={() => setConfirm({ id: r.id, nombre: r.nombre })}>🗑</button>
            </div>
            <h3 style={styles.rubricaNombre}>{r.nombre}</h3>
            <p style={styles.rubricaInfo}>
              {r.criterios?.length || 0} criterios · {r.puntajeTotal || 20} pts
            </p>
            <div style={styles.criteriosTags}>
              {r.criterios?.slice(0, 3).map((c, j) => (
                <span key={j} style={styles.tag}>{c.nombre}</span>
              ))}
              {(r.criterios?.length || 0) > 3 && <span style={styles.tag}>+{r.criterios.length - 3} más</span>}
            </div>
          </div>
        ))}
        {rubricas.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.3)', gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}>
            No hay rúbricas. Crea la primera.
          </p>
        )}
      </div>

      {/* ── Modal confirmación eliminar ── */}
      {confirm && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: '420px', textAlign: 'center' }}>
            <p style={{ fontSize: '40px', margin: '0 0 12px' }}>⚠️</p>
            <h3 style={{ color: '#fff', fontSize: '18px', margin: '0 0 8px' }}>Eliminar rúbrica</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 24px', lineHeight: '1.5' }}>
              ¿Eliminar <strong style={{ color: '#fff' }}>"{confirm.nombre}"</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button style={styles.secondaryBtn} onClick={() => setConfirm(null)}>Cancelar</button>
              <button style={styles.dangerBtn} onClick={handleEliminar}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nueva rúbrica ── */}
      {showForm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Nueva Rúbrica</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button style={styles.exampleBtn} onClick={usarEjemplo}>Usar ejemplo</button>
                <button style={styles.closeBtn} onClick={() => setShowForm(false)}>✕</button>
              </div>
            </div>

            <div style={styles.grid2}>
              <div style={styles.field}>
                <label style={styles.label}>Nombre de la Rúbrica</label>
                <input style={styles.input} value={nueva.nombre}
                  onChange={e => setNueva(n => ({ ...n, nombre: e.target.value }))}
                  placeholder="Rúbrica: Trabajo de Investigación" />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Curso</label>
                <select style={styles.select} value={nueva.cursoId}
                  onChange={e => setNueva(n => ({ ...n, cursoId: e.target.value }))}>
                  <option value="">Todos los cursos</option>
                  {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Puntaje Total</label>
                <input style={styles.input} type="number" value={nueva.puntajeTotal}
                  onChange={e => setNueva(n => ({ ...n, puntajeTotal: Number(e.target.value) }))} />
              </div>
            </div>

            <h3 style={styles.sectionTitle}>Criterios de Evaluación</h3>
            {nueva.criterios.map((c, i) => (
              <div key={i} style={styles.criterioForm}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={styles.criterioNum}>Criterio {i + 1}</span>
                  <button style={styles.deleteBtn} onClick={() => removeCriterio(i)} title="Quitar criterio">🗑</button>
                </div>
                <div style={styles.grid3}>
                  <div style={styles.field}>
                    <label style={styles.labelSm}>Nombre</label>
                    <input style={styles.inputSm} value={c.nombre}
                      onChange={e => updateCriterio(i, 'nombre', e.target.value)} placeholder="Ej: Contenido" />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.labelSm}>Peso (%)</label>
                    <input style={styles.inputSm} type="number" value={c.peso}
                      onChange={e => updateCriterio(i, 'peso', e.target.value)} />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.labelSm}>Puntaje Máx</label>
                    <input style={styles.inputSm} type="number" value={c.puntajeMax}
                      onChange={e => updateCriterio(i, 'puntajeMax', e.target.value)} />
                  </div>
                </div>
                <div style={styles.field}>
                  <label style={styles.labelSm}>Descripción</label>
                  <input style={styles.inputSm} value={c.descripcion}
                    onChange={e => updateCriterio(i, 'descripcion', e.target.value)}
                    placeholder="Qué evalúa este criterio..." />
                </div>
                <div style={styles.grid2}>
                  {['excelente', 'bueno', 'regular', 'insuficiente'].map(nivel => (
                    <div key={nivel} style={styles.field}>
                      <label style={{ ...styles.labelSm, textTransform: 'capitalize' }}>{nivel}</label>
                      <input style={styles.inputSm} value={c.niveles?.[nivel] || ''}
                        onChange={e => updateCriterio(i, `nivel_${nivel}`, e.target.value)}
                        placeholder={`Descripción nivel ${nivel}...`} />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button style={styles.addCriterioBtn} onClick={addCriterio}>+ Agregar Criterio</button>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button style={styles.secondaryBtn} onClick={() => setShowForm(false)}>Cancelar</button>
              <button style={styles.primaryBtn} onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Guardando...' : '💾 Guardar Rúbrica'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0f0c29', fontFamily: "'Segoe UI', sans-serif", padding: '32px' },
  header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' },
  backBtn: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px' },
  title: { color: '#fff', fontSize: '24px', fontWeight: '700', flex: 1, margin: 0 },
  primaryBtn: { padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  secondaryBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontWeight: '500', fontSize: '14px' },
  dangerBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  deleteBtn: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', padding: '5px 9px', fontSize: '14px', flexShrink: 0 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  rubricaCard: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' },
  rubricaIcon: { fontSize: '32px', marginBottom: '12px' },
  rubricaNombre: { color: '#fff', fontSize: '16px', fontWeight: '600', margin: '0 0 8px' },
  rubricaInfo: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 16px' },
  criteriosTags: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  tag: { background: 'rgba(102,126,234,0.15)', color: '#a78bfa', padding: '4px 10px', borderRadius: '6px', fontSize: '12px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '32px' },
  modal: { background: '#1a1535', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '800px', border: '1px solid rgba(255,255,255,0.1)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  modalTitle: { color: '#fff', fontSize: '20px', fontWeight: '700', margin: 0 },
  exampleBtn: { padding: '8px 16px', borderRadius: '8px', background: 'rgba(102,126,234,0.2)', color: '#a78bfa', border: '1px solid rgba(102,126,234,0.3)', cursor: 'pointer', fontSize: '13px' },
  closeBtn: { background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px', borderRadius: '8px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  grid3: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '8px' },
  field: {},
  label: { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' },
  labelSm: { display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' },
  input: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  inputSm: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(20,16,50,0.9)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  sectionTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', margin: '0 0 16px' },
  criterioForm: { background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '20px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '10px' },
  criterioNum: { color: '#a78bfa', fontSize: '13px', fontWeight: '600' },
  addCriterioBtn: { width: '100%', padding: '12px', borderRadius: '10px', border: '2px dashed rgba(102,126,234,0.3)', background: 'transparent', color: '#a78bfa', cursor: 'pointer', fontSize: '14px', marginTop: '8px' },
};