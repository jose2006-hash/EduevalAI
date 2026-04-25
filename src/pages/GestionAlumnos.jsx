// src/pages/GestionAlumnos.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllAlumnos, getCursos, registerUser, eliminarAlumno } from '../firebase/services.js';

export default function GestionAlumnos() {
  const navigate = useNavigate();
  const [alumnos, setAlumnos] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', cursoId: '' });
  const [creando, setCreando] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(null); // { id, nombre }

  useEffect(() => {
    const load = async () => {
      const [alms, crs] = await Promise.all([getAllAlumnos(), getCursos()]);
      setAlumnos(alms);
      setCursos(crs);
    };
    load();
  }, []);

  const handleCrear = async (e) => {
    e.preventDefault();
    setCreando(true); setMsg('');
    try {
      await registerUser(form.email, form.password, form.nombre, 'alumno');
      setMsg('✅ Alumno creado con éxito');
      const alms = await getAllAlumnos();
      setAlumnos(alms);
      setForm({ nombre: '', email: '', password: '', cursoId: '' });
      setShowForm(false);
    } catch (err) {
      setMsg('❌ Error: ' + err.message);
    } finally {
      setCreando(false);
    }
  };

  const handleEliminar = async () => {
    if (!confirm) return;
    try {
      await eliminarAlumno(confirm.id);
      setAlumnos(a => a.filter(x => x.id !== confirm.id));
      setMsg('✅ Alumno eliminado del sistema');
    } catch (err) {
      setMsg('❌ Error: ' + err.message);
    }
    setConfirm(null);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate('/')} style={styles.backBtn}>← Dashboard</button>
        <h1 style={styles.title}>Gestión de Alumnos</h1>
        <button style={styles.primaryBtn} onClick={() => setShowForm(true)}>+ Nuevo Alumno</button>
      </header>

      {msg && (
        <div style={{ color: msg.includes('✅') ? '#22c55e' : '#ef4444', marginBottom: '16px', fontSize: '14px', background: msg.includes('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '12px 16px', borderRadius: '10px' }}>
          {msg}
        </div>
      )}

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <span>Nombre</span><span>Email</span><span>Curso</span><span>Rol</span><span></span>
        </div>
        {alumnos.map((a, i) => (
          <div key={i} style={styles.tableRow}>
            <span style={{ color: '#fff' }}>{a.nombre}</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{a.email}</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>
              {cursos.find(c => c.id === a.cursoId)?.nombre || 'General'}
            </span>
            <span><span style={styles.badge}>Alumno</span></span>
            <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button style={styles.deleteBtn} title="Eliminar alumno"
                onClick={() => setConfirm({ id: a.id, nombre: a.nombre })}>🗑</button>
            </span>
          </div>
        ))}
        {alumnos.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.3)', padding: '32px', textAlign: 'center' }}>
            No hay alumnos registrados
          </p>
        )}
      </div>

      {/* ── Modal confirmación eliminar ── */}
      {confirm && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: '420px', textAlign: 'center' }}>
            <p style={{ fontSize: '40px', margin: '0 0 12px' }}>⚠️</p>
            <h3 style={{ color: '#fff', fontSize: '18px', margin: '0 0 8px' }}>Eliminar alumno</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 6px', lineHeight: '1.5' }}>
              ¿Eliminar a <strong style={{ color: '#fff' }}>"{confirm.nombre}"</strong> del sistema?
            </p>
            <p style={{ color: 'rgba(239,68,68,0.7)', fontSize: '12px', margin: '0 0 24px' }}>
              Nota: esto elimina sus datos del sistema pero no su cuenta de acceso.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button style={styles.secondaryBtn} onClick={() => setConfirm(null)}>Cancelar</button>
              <button style={styles.dangerBtn} onClick={handleEliminar}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nuevo alumno ── */}
      {showForm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={styles.modalTitle}>Nuevo Alumno</h2>
              <button style={styles.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleCrear} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { label: 'Nombre completo', key: 'nombre', type: 'text', placeholder: 'Juan Pérez García' },
                { label: 'Correo electrónico', key: 'email', type: 'email', placeholder: 'alumno@uni.edu' },
                { label: 'Contraseña temporal', key: 'password', type: 'password', placeholder: '••••••••' },
              ].map(f => (
                <div key={f.key}>
                  <label style={styles.label}>{f.label}</label>
                  <input style={styles.input} type={f.type} placeholder={f.placeholder}
                    value={form[f.key]} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))} required />
                </div>
              ))}
              <div>
                <label style={styles.label}>Curso</label>
                <select style={styles.select} value={form.cursoId}
                  onChange={e => setForm(x => ({ ...x, cursoId: e.target.value }))}>
                  <option value="">Sin curso asignado</option>
                  {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" style={styles.secondaryBtn} onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" style={styles.primaryBtn} disabled={creando}>
                  {creando ? 'Creando...' : 'Crear Alumno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0f0c29', fontFamily: "'Segoe UI', sans-serif", padding: '32px', color: '#fff' },
  header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' },
  backBtn: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px' },
  title: { color: '#fff', fontSize: '24px', fontWeight: '700', flex: 1, margin: 0 },
  primaryBtn: { padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  secondaryBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontWeight: '500', fontSize: '14px' },
  dangerBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  deleteBtn: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', padding: '6px 10px', fontSize: '14px' },
  table: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 48px', gap: '16px', padding: '14px 20px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 48px', gap: '16px', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '14px', alignItems: 'center' },
  badge: { background: 'rgba(102,126,234,0.2)', color: '#a78bfa', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '500' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '32px' },
  modal: { background: '#1a1535', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.1)' },
  modalTitle: { color: '#fff', fontSize: '20px', fontWeight: '700', margin: 0 },
  closeBtn: { background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px', borderRadius: '8px' },
  label: { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' },
  input: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(20,16,50,0.9)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
};