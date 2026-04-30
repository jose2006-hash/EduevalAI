// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, registerUser } from '../firebase/services.js';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('alumno');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const reset = () => { setError(''); setEmail(''); setPassword(''); setNombre(''); };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await loginUser(email, password);
      navigate('/');
    } catch {
      setError('Correo o contraseña incorrectos');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    setLoading(true);
    try {
      await registerUser(email, password, nombre, rol);
      navigate('/');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Este correo ya está registrado');
      else setError('Error al registrar: ' + err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={s.container}>
      {/* Animated background blobs */}
      <div style={s.blob1} />
      <div style={s.blob2} />
      <div style={s.blob3} />

      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <span style={s.logoEmoji}>🎓</span>
        </div>
        <h1 style={s.title}>AcademIA</h1>
        <p style={s.subtitle}>Sistema Inteligente de Evaluación y Retroalimentación Académica</p>
        <p style={s.docente}>Mg. Gilder Cieza Altamirano · Docente Universitario</p>

        {/* Toggle */}
        <div style={s.toggle}>
          <button
            style={{ ...s.toggleBtn, ...(mode === 'login' ? s.toggleActive : {}) }}
            onClick={() => { setMode('login'); reset(); }}>
            Iniciar sesión
          </button>
          <button
            style={{ ...s.toggleBtn, ...(mode === 'register' ? s.toggleActive : {}) }}
            onClick={() => { setMode('register'); reset(); }}>
            Registrarse
          </button>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                style={s.input} placeholder="correo@universidad.edu" required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                style={s.input} placeholder="••••••••" required />
            </div>
            {error && <div style={s.errorBox}>{error}</div>}
            <button type="submit" style={s.btn} disabled={loading}>
              {loading
                ? <span style={s.loadingInner}><span style={s.spinner} /> Ingresando...</span>
                : '→ Ingresar'}
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Nombre completo</label>
              <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                style={s.input} placeholder="Juan Pérez García" required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                style={s.input} placeholder="correo@universidad.edu" required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                style={s.input} placeholder="Mínimo 6 caracteres" required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Soy...</label>
              <div style={s.rolSelector}>
                {[
                  { value: 'alumno', icon: '👨‍🎓', label: 'Alumno' },
                  { value: 'docente', icon: '👨‍🏫', label: 'Docente' },
                ].map(r => (
                  <button key={r.value} type="button" onClick={() => setRol(r.value)}
                    style={{ ...s.rolBtn, ...(rol === r.value ? s.rolBtnActive : {}) }}>
                    <span style={{ fontSize: '28px' }}>{r.icon}</span>
                    <span style={{ fontWeight: '600' }}>{r.label}</span>
                    {rol === r.value && <span style={s.checkMark}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
            {error && <div style={s.errorBox}>{error}</div>}
            <button type="submit" style={s.btn} disabled={loading}>
              {loading
                ? <span style={s.loadingInner}><span style={s.spinner} /> Creando cuenta...</span>
                : '→ Crear cuenta'}
            </button>
            <p style={s.hint}>
              Acceso como <strong style={{ color: '#a78bfa' }}>{rol}</strong>:{' '}
              {rol === 'docente'
                ? 'gestión de cursos, rúbricas y evaluaciones.'
                : 'portal de notas y retroalimentación.'}
            </p>
          </form>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blob { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-50px) scale(1.1)} 66%{transform:translate(-20px,20px) scale(0.9)} }
      `}</style>
    </div>
  );
}

const s = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0515 0%, #1a0533 40%, #0d1f4a 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Segoe UI', sans-serif",
    position: 'relative', overflow: 'hidden',
  },
  blob1: {
    position: 'absolute', width: '500px', height: '500px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 70%)',
    top: '-100px', left: '-100px',
    animation: 'blob 8s ease-in-out infinite',
  },
  blob2: {
    position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
    bottom: '-80px', right: '-80px',
    animation: 'blob 10s ease-in-out infinite reverse',
  },
  blob3: {
    position: 'absolute', width: '300px', height: '300px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 70%)',
    top: '50%', left: '60%',
    animation: 'blob 12s ease-in-out infinite',
  },
  card: {
    position: 'relative', zIndex: 1,
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '28px',
    padding: '48px 44px',
    width: '100%', maxWidth: '460px',
    textAlign: 'center',
    boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  logoWrap: {
    width: '72px', height: '72px', borderRadius: '20px', margin: '0 auto 16px',
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 8px 32px rgba(124,58,237,0.5)',
  },
  logoEmoji: { fontSize: '36px' },
  title: {
    color: '#fff', fontSize: '34px', fontWeight: '800', margin: '0 0 8px',
    background: 'linear-gradient(135deg, #fff 40%, #a78bfa)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.5px',
  },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: '13px', marginBottom: '4px', lineHeight: '1.5' },
  docente: { color: 'rgba(167,139,250,0.6)', fontSize: '12px', marginBottom: '28px', fontStyle: 'italic' },
  toggle: {
    display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '14px',
    padding: '4px', marginBottom: '28px', gap: '4px',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  toggleBtn: {
    flex: 1, padding: '11px', borderRadius: '11px', border: 'none',
    background: 'transparent', color: 'rgba(255,255,255,0.45)',
    fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s',
  },
  toggleActive: {
    background: 'linear-gradient(135deg, rgba(124,58,237,0.6), rgba(37,99,235,0.6))',
    color: '#fff', fontWeight: '700',
    boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
  },
  form: { textAlign: 'left' },
  field: { marginBottom: '18px' },
  label: {
    display: 'block', color: 'rgba(255,255,255,0.75)', fontSize: '13px',
    marginBottom: '8px', fontWeight: '600', letterSpacing: '0.02em',
  },
  input: {
    width: '100%', padding: '14px 16px', borderRadius: '13px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.07)',
    color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  rolSelector: { display: 'flex', gap: '12px' },
  rolBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    padding: '18px 12px', borderRadius: '14px',
    border: '2px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '14px', cursor: 'pointer', position: 'relative',
    transition: 'all 0.2s',
  },
  rolBtnActive: {
    border: '2px solid #7c3aed',
    background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(37,99,235,0.15))',
    color: '#fff',
    boxShadow: '0 0 20px rgba(124,58,237,0.3)',
  },
  checkMark: {
    position: 'absolute', top: '8px', right: '10px',
    color: '#a78bfa', fontSize: '13px', fontWeight: '700',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5', fontSize: '13px', padding: '12px 16px',
    borderRadius: '10px', marginBottom: '14px', textAlign: 'center',
  },
  btn: {
    width: '100%', padding: '16px', borderRadius: '14px',
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    color: '#fff', fontSize: '16px', fontWeight: '700',
    border: 'none', cursor: 'pointer', marginTop: '4px', marginBottom: '16px',
    boxShadow: '0 8px 24px rgba(124,58,237,0.4)',
    transition: 'opacity 0.2s, transform 0.1s',
    letterSpacing: '0.03em',
  },
  loadingInner: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  spinner: {
    display: 'inline-block', width: '16px', height: '16px',
    border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  hint: { color: 'rgba(255,255,255,0.3)', fontSize: '12px', textAlign: 'center', lineHeight: '1.6' },
};