// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext.jsx';
import Login from './pages/Login.jsx';
import DashboardDocente from './pages/DashboardDocente.jsx';
import GestionRubricas from './pages/GestionRubricas.jsx';
import GestionAlumnos from './pages/GestionAlumnos.jsx';
import GestionCursos from './pages/GestionCursos.jsx';
import MisCursos from './pages/MisCursos.jsx';
import CursoAlumno from './pages/CursoAlumno.jsx';
import UnirseACurso from './pages/UnirseACurso.jsx';

const PrivateRoute = ({ children, allowedRole }) => {
  const { user, userData, loading } = useAuth();
  if (loading) return (
    <div style={{
      color: '#fff', display: 'flex', alignItems: 'center',
      justifyContent: 'center', height: '100vh', background: '#0f0c29',
      fontFamily: 'Segoe UI, sans-serif', fontSize: '16px'
    }}>
      Cargando...
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  if (allowedRole && userData?.rol !== allowedRole) {
    return <Navigate to={userData?.rol === 'alumno' ? '/mis-cursos' : '/dashboard'} />;
  }
  return children;
};

const RootRedirect = () => {
  const { user, userData, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  return <Navigate to={userData?.rol === 'alumno' ? '/mis-cursos' : '/dashboard'} />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          {/* ── DOCENTE ── */}
          <Route path="/dashboard" element={
            <PrivateRoute allowedRole="docente"><DashboardDocente /></PrivateRoute>
          } />
          <Route path="/rubricas" element={
            <PrivateRoute allowedRole="docente"><GestionRubricas /></PrivateRoute>
          } />
          <Route path="/alumnos" element={
            <PrivateRoute allowedRole="docente"><GestionAlumnos /></PrivateRoute>
          } />
          <Route path="/cursos" element={
            <PrivateRoute allowedRole="docente"><GestionCursos /></PrivateRoute>
          } />

          {/* ── ALUMNO ── */}
          <Route path="/mis-cursos" element={
            <PrivateRoute allowedRole="alumno"><MisCursos /></PrivateRoute>
          } />
          <Route path="/curso/:cursoId" element={
            <PrivateRoute allowedRole="alumno"><CursoAlumno /></PrivateRoute>
          } />
          <Route path="/unirse" element={
            <PrivateRoute allowedRole="alumno"><UnirseACurso /></PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
