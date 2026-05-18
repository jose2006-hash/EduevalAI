// src/pages/GestionAlumnos.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllAlumnos, getCursos, registerUser, eliminarAlumno, subirAvatar, exportarNotasExcel, exportarNotasPDF } from '../firebase/services.js';
import { useAuth } from '../components/AuthContext.jsx';

export default function GestionAlumnos() {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const avatarInputRef = useRef(null);
  const [selectedAlumnoForAvatar, setSelectedAlumnoForAvatar] = useState(null);

  const [alumnos, setAlumnos] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', cursoId: '' });
  const [creando, setCreando] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const load = async () => {
      const [alms, crs] = await Promise.all([getAllAlumnos(), getCursos()]);
      setAlumnos(alms);
      setCursos(crs);
    };
    load();
  }, []);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const close = () => setShowExportMenu(false);
    if (showExportMenu) document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showExportMenu]);

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

  // Avatar de alumno
  const handleAvatarAlumno = (alumno) => {
    setSelectedAlumnoForAvatar(alumno);
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAlumnoForAvatar?.uid) return;
    try {
      const url = await subirAvatar(file, selectedAlumnoForAvatar.uid);
      setAlumnos(prev => prev.map(a =>
        a.id === selectedAlumnoForAvatar.id ? { ...a, avatarUrl: url } : a
      ));
      setMsg('✅ Foto actualizada correctamente');
    } catch (err) {
      setMsg('❌ Error subiendo foto: ' + err.message);
    } finally {
      setSelectedAlumnoForAvatar(null);
      e.target.value = '';
    }
  };

  // Exportar lista de alumnos
  const alumnosFiltrados = alumnos.filter(a =>
    !busqueda || a.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const handleExportExcel = async () => {
    setExportando(true);
    setShowExportMenu(false);
    try {
      const XLSX = await import('xlsx');
      const fecha = new Date().toLocaleDateString('es-PE');
      const headers = ['N°', 'Nombre', 'Email', 'Rol', 'Curso Asignado'];
      const rows = alumnosFiltrados.map((a, i) => [
        i + 1,
        a.nombre || '—',
        a.email || '—',
        'Alumno',
        cursos.find(c => c.id === a.cursoId)?.nombre || 'General',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([
        ['EduEval AI — Lista de Alumnos'],
        [`Docente: ${userData?.nombre || ''}`],
        [`Fecha: ${fecha}`],
        [],
        headers,
        ...rows,
      ]);
      ws['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 35 }, { wch: 12 }, { wch: 25 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
      XLSX.writeFile(wb, `EduEval_Alumnos_${fecha.replace(/\//g, '-')}.xlsx`);
    } catch (err) {
      alert('Error exportando. Instala: npm install xlsx');
    } finally {
      setExportando(false);
    }
  };

  const handleExportPDF = async () => {
    setExportando(true);
    setShowExportMenu(false);
    try {
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      const fecha = new Date().toLocaleDateString('es-PE');
      const doc = new jsPDF();

      doc.setFillColor(15, 12, 41);
      doc.rect(0, 0, 210, 30, 'F');
      doc.setFillColor(102, 126, 234);
      doc.rect(0, 30, 210, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('EduEval AI — Lista de Alumnos', 14, 14);
      doc.setFontSize(9);
      doc.setTextColor(200, 200, 220);
      doc.text(`Docente: ${userData?.nombre || ''}  |  Fecha: ${fecha}`, 14, 22);

      doc.autoTable({
        startY: 38,
        head: [['N°', 'Nombre', 'Email', 'Rol', 'Curso']],
        body: alumnosFiltrados.map((a, i) => [
          i + 1, a.nombre || '—', a.email || '—', 'Alumno',
          cursos.find(c => c.id === a.cursoId)?.nombre || 'General',
        ]),
        styles: { fontSize: 9, textColor: [220, 215, 240], lineColor: [40, 35, 80], lineWidth: 0.2 },
        headStyles: { fillColor: [30, 25, 65], textColor: [167, 139, 250], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [20, 16, 50] },
        bodyStyles: { fillColor: [15, 12, 41] },
        margin: { left: 14, right: 14 },
      });
      doc.save(`EduEval_Alumnos_${fecha.replace(/\//g, '-')}.pdf`);
    } catch (err) {
      console.error('Error exportando PDF:', err);
      alert(`Error exportando PDF. Revisa la consola para más detalles. Asegúrate de tener instaladas las dependencias: npm install jspdf jspdf-autotable`);
    } finally {
      setExportando(false);
    }
  };

  const getInitials = (nombre = '') =>
    nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={styles.container}>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleAvatarChange}
      />

      <header style={styles.header}>
        <button onClick={() => navigate('/')} style={styles.backBtn}>← Dashboard</button>
        <h1 style={styles.title}>Gestión de Alumnos</h1>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: 'auto' }}>
          {/* Búsqueda */}
          <input
            type="text"
            placeholder="🔍 Buscar alumno..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={styles.searchInput}
          />

          {/* Export */}
          <div style={{ position: 'relative' }}>
            <button
              style={{ ...styles.exportBtn, opacity: exportando ? 0.6 : 1 }}
              disabled={exportando}
              onClick={e => { e.stopPropagation(); setShowExportMenu(m => !m); }}
            >
              {exportando ? '⏳' : '⬇️'} Exportar
            </button>
            {showExportMenu && (
              <div style={styles.exportMenu} onClick={e => e.stopPropagation()}>
                <button style={styles.exportMenuItem} onClick={handleExportExcel}>
                  📊 Excel (.xlsx)
                </button>
                <button style={styles.exportMenuItem} onClick={handleExportPDF}>
                  📄 PDF
                </button>
              </div>
            )}
          </div>

          <button style={styles.primaryBtn} onClick={() => setShowForm(true)}>
            + Nuevo Alumno
          </button>
        </div>
      </header>

      {msg && (
        <div style={{
          color: msg.includes('✅') ? '#22c55e' : '#ef4444',
          marginBottom: '16px', fontSize: '14px',
          background: msg.includes('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          padding: '12px 16px', borderRadius: '10px'
        }}>
          {msg}
        </div>
      )}

      {/* Conteo */}
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginBottom: '12px' }}>
        {alumnosFiltrados.length} alumno{alumnosFiltrados.length !== 1 ? 's' : ''} registrado{alumnosFiltrados.length !== 1 ? 's' : ''}
      </p>

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <span>Alumno</span><span>Email</span><span>Curso</span><span>Rol</span><span></span>
        </div>
        {alumnosFiltrados.map((a, i) => (
          <div key={i} style={styles.tableRow}>
            {/* Avatar + nombre */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={styles.miniAvatar}
                onClick={() => handleAvatarAlumno(a)}
                title="Cambiar foto"
              >
                {a.avatarUrl
                  ? <img src={a.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>{getInitials(a.nombre)}</span>
                }
              </div>
              <span style={{ color: '#fff', fontSize: '14px' }}>{a.nombre}</span>
            </span>
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
        {alumnosFiltrados.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.3)', padding: '32px', textAlign: 'center' }}>
            {busqueda ? 'No se encontraron alumnos con ese término' : 'No hay alumnos registrados'}
          </p>
        )}
      </div>

      {/* Modal confirmación eliminar */}
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

      {/* Modal nuevo alumno */}
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
  header: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' },
  backBtn: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px' },
  title: { color: '#fff', fontSize: '22px', fontWeight: '700', margin: 0 },
  searchInput: {
    padding: '9px 14px', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff', fontSize: '13px', outline: 'none', width: '180px',
  },
  exportBtn: {
    padding: '9px 16px', borderRadius: '10px',
    background: 'rgba(34,197,94,0.15)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#22c55e', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
  exportMenu: {
    position: 'absolute', top: '110%', right: 0, zIndex: 200,
    background: '#1a1535', borderRadius: '12px', padding: '6px',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 16px 48px rgba(0,0,0,0.5)', minWidth: '180px',
  },
  exportMenuItem: {
    display: 'block', width: '100%', padding: '10px 14px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#fff', textAlign: 'left', fontSize: '13px', borderRadius: '8px',
  },
  primaryBtn: { padding: '10px 20px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap' },
  secondaryBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontWeight: '500', fontSize: '14px' },
  dangerBtn: { padding: '12px 24px', borderRadius: '12px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  deleteBtn: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', padding: '6px 10px', fontSize: '14px' },
  miniAvatar: {
    width: '36px', height: '36px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
    border: '1px solid rgba(167,139,250,0.3)',
  },
  table: { background: 'rgba(255,255,255,0.04)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2.5fr 2fr 1.5fr 1fr 48px', gap: '16px', padding: '14px 20px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  tableRow: { display: 'grid', gridTemplateColumns: '2.5fr 2fr 1.5fr 1fr 48px', gap: '16px', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '14px', alignItems: 'center' },
  badge: { background: 'rgba(102,126,234,0.2)', color: '#a78bfa', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '500' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '32px' },
  modal: { background: '#1a1535', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.1)' },
  modalTitle: { color: '#fff', fontSize: '20px', fontWeight: '700', margin: 0 },
  closeBtn: { background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px', borderRadius: '8px' },
  label: { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' },
  input: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(20,16,50,0.9)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
};