// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, registerUser } from '../firebase/services.js';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
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
    setError('');
    setLoading(true);
    try {
      await loginUser(email, password);
      navigate('/');
    } catch {
      setError('Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>🎓</div>
        <h1 style={styles.title}>AcademIA</h1>
        <p style={styles.subtitle}>Plataforma de Evaluación con IA</p>

        {/* Toggle */}
        <div style={styles.toggle}>
          <button
            style={{ ...styles.toggleBtn, ...(mode === 'login' ? styles.toggleActive : {}) }}
            onClick={() => { setMode('login'); reset(); }}
          >
            Iniciar sesión
          </button>
          <button
            style={{ ...styles.toggleBtn, ...(mode === 'register' ? styles.toggleActive : {}) }}
            onClick={() => { setMode('register'); reset(); }}
          >
            Registrarse
          </button>
        </div>

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                style={styles.input} placeholder="correo@universidad.edu" required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                style={styles.input} placeholder="••••••••" required />
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Nombre completo</label>
              <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                style={styles.input} placeholder="Juan Pérez García" required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                style={styles.input} placeholder="correo@universidad.edu" required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                style={styles.input} placeholder="Mínimo 6 caracteres" required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Soy...</label>
              <div style={styles.rolSelector}>
                {[
                  { value: 'alumno', icon: '👨‍🎓', label: 'Alumno' },
                  { value: 'docente', icon: '👨‍🏫', label: 'Docente' },
                ].map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRol(r.value)}
                    style={{ ...styles.rolBtn, ...(rol === r.value ? styles.rolBtnActive : {}) }}
                  >
                    <span style={{ fontSize: '22px' }}>{r.icon}</span>
                    <span>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
            <p style={styles.hint}>
              Al registrarte como <strong>{rol}</strong> tendrás acceso a{' '}
              {rol === 'docente' ? 'el dashboard, rúbricas y evaluaciones.' : 'tu portal de notas y retroalimentación.'}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px',
    padding: '48px', width: '100%', maxWidth: '440px', textAlign: 'center',
  },
  logo: { fontSize: '48px', marginBottom: '12px' },
  title: { color: '#fff', fontSize: '32px', fontWeight: '700', margin: '0 0 8px' },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '28px' },
  toggle: {
    display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: '12px',
    padding: '4px', marginBottom: '28px',
  },
  toggleBtn: {
    flex: 1, padding: '10px', borderRadius: '9px', border: 'none',
    background: 'transparent', color: 'rgba(255,255,255,0.5)',
    fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s',
  },
  toggleActive: { background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: '600' },
  form: { textAlign: 'left' },
  field: { marginBottom: '18px' },
  label: { display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginBottom: '8px', fontWeight: '500' },
  input: {
    width: '100%', padding: '14px 16px', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)',
    color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box',
  },
  rolSelector: { display: 'flex', gap: '10px' },
  rolBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    padding: '14px', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
    fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s',
  },
  rolBtnActive: {
    border: '2px solid #667eea', background: 'rgba(102,126,234,0.15)', color: '#fff',
  },
  error: { color: '#ff6b6b', fontSize: '13px', marginBottom: '12px', textAlign: 'center' },
  btn: {
    width: '100%', padding: '16px', borderRadius: '12px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', fontSize: '16px', fontWeight: '600',
    border: 'none', cursor: 'pointer', marginTop: '4px', marginBottom: '16px',
  },
  hint: { color: 'rgba(255,255,255,0.3)', fontSize: '12px', textAlign: 'center', lineHeight: '1.5' },
};
