// src/pages/GestionCursos.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCursosByDocente, crearCurso,
  getMatriculasByCurso, getPendientesByCurso,
  aprobarMatricula, rechazarMatricula
} from '../firebase/services.js';
import { useAuth } from '../components/AuthContext.jsx';

const TIPOS_DEFAULT = [
  { nombre: 'Tareas', peso: 30 },
  { nombre: 'Exámenes', peso: 40 },
  { nombre: 'Participación', peso: 20 },
  { nombre: 'Otros', peso: 10 },
];

export default function GestionCursos() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [cursos, setCursos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [cursoPendientes, setCursoPendientes] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [aprobados, setAprobados] = useState([]);
  // ✅ FIX 1: único useState con codigo incluido
  const [form, setForm] = useState({
    nombre: '', seccion: '', codigo: '', descripcion: '', ciclo: '',
    silaboTexto: '', silaboNombre: '',
    tiposEvaluacion: TIPOS_DEFAULT,
  });
  const [leyendoPDF, setLeyendoPDF] = useState(false);

  useEffect(() => { if (userData?.uid) cargarCursos(); }, [userData]);

  const cargarCursos = async () => {
    const crs = await getCursosByDocente(userData.uid);
    setCursos(crs);
  };

  const abrirSolicitudes = async (curso) => {
    setCursoPendientes(curso);
    const [pends, todos] = await Promise.all([
      getPendientesByCurso(curso.id),
      getMatriculasByCurso(curso.id),
    ]);
    setPendientes(pends);
    setAprobados(todos.filter(m => m.estado === 'aprobado'));
  };

  const handleAprobar = async (id) => {
    await aprobarMatricula(id);
    await abrirSolicitudes(cursoPendientes);
  };

  const handleRechazar = async (id) => {
    await rechazarMatricula(id);
    await abrirSolicitudes(cursoPendientes);
  };

  const handleSilaboPDF = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLeyendoPDF(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result
        .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
        .replace(/\s{3,}/g, '\n').substring(0, 8000);
      setForm(f => ({ ...f, silaboTexto: text, silaboNombre: file.name }));
      setLeyendoPDF(false);
    };
    reader.readAsText(file, 'latin1');
  };

  const updateTipo = (i, field, val) => {
    const tipos = [...form.tiposEvaluacion];
    tipos[i] = { ...tipos[i], [field]: field === 'peso' ? Number(val) : val };
    setForm(f => ({ ...f, tiposEvaluacion: tipos }));
  };

  const totalPeso = form.tiposEvaluacion.reduce((s, t) => s + (t.peso || 0), 0);

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return setMsg('❌ El nombre del curso es obligatorio');
    if (!form.seccion.trim()) return setMsg('❌ La sección es obligatoria');
    // ✅ FIX 2: validación de código antes de guardar
    if (!form.codigo.trim()) return setMsg('❌ El código del curso es obligatorio');
    if (totalPeso !== 100) return setMsg(`❌ Los pesos deben sumar 100% (actualmente: ${totalPeso}%)`);
    setGuardando(true);
    setMsg('');
    try {
      await crearCurso({
        ...form,
        docenteUid: userData.uid,
        docenteNombre: userData.nombre,
      });
      setMsg(`✅ Curso "${form.nombre} - Sección ${form.seccion}" creado exitosamente`);
      await cargarCursos();
      setShowForm(false);
      // ✅ FIX 3: reset incluye codigo: ''
      setForm({ nombre: '', seccion: '', codigo: '', descripcion: '', ciclo: '', silaboTexto: '', silaboNombre: '', tiposEvaluacion: TIPOS_DEFAULT });
    } catch (err) {
      setMsg('❌ Error: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={s.container}>
      <header style={s.header}>
        <button onClick={() => navigate('/dashboard')} style={s.backBtn}>← Dashboard</button>
        <h1 style={s.title}>Mis Cursos</h1>
        <button style={s.primaryBtn} onClick={() => setShowForm(true)}>+ Nuevo Curso</button>
      </header>

      {msg && (
        <div style={{ color: msg.includes('✅') ? '#22c55e' : '#ef4444', marginBottom: '16px', fontSize: '14px', background: msg.includes('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '12px 16px', borderRadius: '10px' }}>
          {msg}
        </div>
      )}

      <div style={s.grid}>
        {cursos.map((c, i) => (
          <div key={i} style={s.cursoCard}>
            <div style={s.cursoTop}>
              <span style={s.cursoIcon}>📚</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {c.seccion && <span style={s.seccionBadge}>Sección {c.seccion}</span>}
              </div>
            </div>
            <h3 style={s.cursoNombre}>{c.nombre}</h3>
            <p style={s.cursoCiclo}>
              {c.ciclo && `${c.ciclo} · `}
              {c.descripcion}
            </p>
            <div style={s.tiposList}>
              {c.tiposEvaluacion?.map((t, j) => (
                <span key={j} style={s.tipoTag}>{t.nombre} {t.peso}%</span>
              ))}
            </div>
            {c.silaboNombre && (
              <p style={s.silaboTag}>📄 {c.silaboNombre}</p>
            )}
            {/* ✅ FIX 4: infoBox muestra código */}
            <div style={s.infoBox}>
              <p style={s.infoLabel}>Los alumnos ingresan con:</p>
              <p style={s.infoValue}>Código: <strong style={{ color: '#a78bfa' }}>{c.codigo}</strong> + nombre del profesor</p>
            </div>
            <button style={s.solicitudesBtn} onClick={() => abrirSolicitudes(c)}>
              👥 Ver alumnos y solicitudes
            </button>
          </div>
        ))}
        {cursos.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.3)', gridColumn: '1/-1', textAlign: 'center', padding: '48px' }}>
            No tienes cursos. Crea el primero.
          </p>
        )}
      </div>

      {/* Modal solicitudes */}
      {cursoPendientes && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>{cursoPendientes.nombre}</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
                  Sección {cursoPendientes.seccion} · {cursoPendientes.ciclo}
                </p>
              </div>
              <button style={s.closeBtn} onClick={() => setCursoPendientes(null)}>✕</button>
            </div>

            <div style={s.seccion}>
              <h3 style={s.seccionTitle}>
                ⏳ Solicitudes pendientes
                {pendientes.length > 0 && <span style={s.badgeRed}>{pendientes.length}</span>}
              </h3>
              {pendientes.length === 0 ? (
                <p style={s.emptyText}>Sin solicitudes pendientes</p>
              ) : pendientes.map((m, i) => (
                <div key={i} style={s.alumnoRow}>
                  <div style={s.alumnoInfo}>
                    <span style={s.alumnoAvatar}>👤</span>
                    <div>
                      <p style={s.alumnoNombre}>{m.alumnoNombre}</p>
                      <p style={s.alumnoEmail}>{m.alumnoEmail}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={s.aprobarBtn} onClick={() => handleAprobar(m.id)}>✓ Aprobar</button>
                    <button style={s.rechazarBtn} onClick={() => handleRechazar(m.id)}>✕ Rechazar</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={s.seccion}>
              <h3 style={s.seccionTitle}>
                ✅ Alumnos aprobados
                {aprobados.length > 0 && <span style={s.badgeGreen}>{aprobados.length}</span>}
              </h3>
              {aprobados.length === 0 ? (
                <p style={s.emptyText}>Sin alumnos aprobados aún</p>
              ) : aprobados.map((m, i) => (
                <div key={i} style={s.alumnoRowAprobado}>
                  <span style={s.alumnoAvatar}>👤</span>
                  <div>
                    <p style={s.alumnoNombre}>{m.alumnoNombre}</p>
                    <p style={s.alumnoEmail}>{m.alumnoEmail}</p>
                  </div>
                  <span style={{ marginLeft: 'auto', color: '#22c55e', fontSize: '13px' }}>✓ Aprobado</span>
                </div>
              ))}
            </div>

            <button style={{ ...s.primaryBtn, width: '100%' }} onClick={() => setCursoPendientes(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal nuevo curso */}
      {showForm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Nuevo Curso</h2>
              <button style={s.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>

            {/* ✅ FIX 5: grid3 con nombre (span 2) + sección */}
            <div style={s.grid3}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={s.label}>Nombre del curso *</label>
                <input style={s.input} placeholder="Ej: Contabilidad General"
                  value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Sección *</label>
                <input style={s.input} placeholder="Ej: A, B, C"
                  value={form.seccion} onChange={e => setForm(f => ({ ...f, seccion: e.target.value.toUpperCase() }))} />
              </div>
            </div>

            {/* ✅ FIX 6: grid2 con código + ciclo (sin duplicado) */}
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Código del curso *</label>
                <input style={s.input} placeholder="Ej: CONT-2024-A (tú lo defines)"
                  value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} />
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '6px' }}>
                  Este código lo compartirás con tus alumnos para que puedan encontrarte
                </p>
              </div>
              <div>
                <label style={s.label}>Ciclo / Semestre</label>
                <input style={s.input} placeholder="Ej: 2024-II"
                  value={form.ciclo} onChange={e => setForm(f => ({ ...f, ciclo: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={s.label}>Descripción</label>
              <input style={s.input} placeholder="Descripción breve"
                value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>

            <div style={s.silaboBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={s.label}>📄 Sílabo del curso</label>
                <label style={s.uploadBtn}>
                  {leyendoPDF ? '⏳ Leyendo...' : form.silaboNombre ? `✅ ${form.silaboNombre}` : '📎 Subir PDF'}
                  <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleSilaboPDF} />
                </label>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: 0 }}>
                La IA usará el sílabo como referencia al evaluar trabajos
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label style={s.label}>Tipos de Evaluación y Pesos</label>
                <span style={{ color: totalPeso === 100 ? '#22c55e' : '#ef4444', fontSize: '13px', fontWeight: '600' }}>
                  Total: {totalPeso}% {totalPeso === 100 ? '✓' : '← debe ser 100%'}
                </span>
              </div>
              {form.tiposEvaluacion.map((t, i) => (
                <div key={i} style={s.tipoRow}>
                  <input style={{ ...s.input, flex: 2 }} placeholder="Nombre (ej: Tareas)"
                    value={t.nombre} onChange={e => updateTipo(i, 'nombre', e.target.value)} />
                  <input style={{ ...s.input, width: '70px', textAlign: 'center' }}
                    type="number" min="0" max="100" value={t.peso}
                    onChange={e => updateTipo(i, 'peso', e.target.value)} />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>%</span>
                  <button onClick={() => setForm(f => ({ ...f, tiposEvaluacion: f.tiposEvaluacion.filter((_, idx) => idx !== i) }))}
                    style={s.removeBtn}>✕</button>
                </div>
              ))}
              <button onClick={() => setForm(f => ({ ...f, tiposEvaluacion: [...f.tiposEvaluacion, { nombre: '', peso: 0 }] }))}
                style={s.addTipoBtn}>+ Agregar tipo</button>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={s.secondaryBtn} onClick={() => setShowForm(false)}>Cancelar</button>
              <button style={s.primaryBtn} onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Creando...' : '🚀 Crear Curso'}
              </button>
            </div>
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
  title: { color: '#fff', fontSize: '24px', fontWeight: '700', flex: 1, margin: 0 },
  primaryBtn: { padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  secondaryBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontSize: '14px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' },
  cursoCard: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '10px' },
  cursoTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cursoIcon: { fontSize: '28px' },
  seccionBadge: { background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700' },
  cursoNombre: { color: '#fff', fontSize: '18px', fontWeight: '600', margin: 0 },
  cursoCiclo: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 },
  tiposList: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  tipoTag: { background: 'rgba(102,126,234,0.15)', color: '#a78bfa', padding: '3px 10px', borderRadius: '6px', fontSize: '12px' },
  silaboTag: { color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 },
  infoBox: { background: 'rgba(102,126,234,0.06)', border: '1px solid rgba(102,126,234,0.15)', borderRadius: '10px', padding: '10px 14px' },
  infoLabel: { color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  infoValue: { color: '#a78bfa', fontSize: '12px', margin: 0, fontStyle: 'italic' },
  solicitudesBtn: { width: '100%', padding: '10px', borderRadius: '10px', background: 'rgba(102,126,234,0.12)', border: '1px solid rgba(102,126,234,0.2)', color: '#a78bfa', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '32px' },
  modal: { background: '#1a1535', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '680px', border: '1px solid rgba(255,255,255,0.1)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  modalTitle: { color: '#fff', fontSize: '20px', fontWeight: '700', margin: '0 0 4px' },
  closeBtn: { background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '16px', width: '32px', height: '32px', borderRadius: '8px' },
  seccion: { marginBottom: '24px' },
  seccionTitle: { color: '#fff', fontSize: '15px', fontWeight: '600', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' },
  badgeRed: { background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '700' },
  badgeGreen: { background: 'rgba(34,197,94,0.2)', color: '#22c55e', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '700' },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: '13px' },
  alumnoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px', border: '1px solid rgba(239,68,68,0.15)' },
  alumnoRowAprobado: { display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '12px 16px', marginBottom: '8px', border: '1px solid rgba(34,197,94,0.1)' },
  alumnoInfo: { display: 'flex', alignItems: 'center', gap: '12px' },
  alumnoAvatar: { fontSize: '24px' },
  alumnoNombre: { color: '#fff', fontSize: '14px', fontWeight: '500', margin: '0 0 2px' },
  alumnoEmail: { color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 },
  aprobarBtn: { padding: '8px 16px', borderRadius: '8px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  rechazarBtn: { padding: '8px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '16px', marginBottom: '16px' },
  label: { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' },
  input: { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  silaboBox: { background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '12px', padding: '16px', marginBottom: '20px' },
  uploadBtn: { display: 'inline-block', padding: '8px 16px', borderRadius: '8px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontSize: '13px', cursor: 'pointer' },
  tipoRow: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' },
  removeBtn: { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', padding: '8px 10px', fontSize: '13px' },
  addTipoBtn: { width: '100%', padding: '10px', borderRadius: '10px', border: '2px dashed rgba(102,126,234,0.3)', background: 'transparent', color: '#a78bfa', cursor: 'pointer', fontSize: '13px' },
};