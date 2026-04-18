// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext.jsx';
import Login from './pages/Login.jsx';
import DashboardDocente from './pages/DashboardDocente.jsx';
import EvaluarTrabajo from './pages/EvaluarTrabajo.jsx';
import GestionRubricas from './pages/GestionRubricas.jsx';
import GestionAlumnos from './pages/GestionAlumnos.jsx';
import VistaAlumno from './pages/VistaAlumno.jsx';

const PrivateRoute = ({ children, allowedRole }) => {
  const { user, userData, loading } = useAuth();
  if (loading) return <div style={{ color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0c29' }}>Cargando...</div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRole && userData?.rol !== allowedRole) {
    return <Navigate to={userData?.rol === 'alumno' ? '/mis-notas' : '/'} />;
  }
  return children;
};

const RootRedirect = () => {
  const { user, userData, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  return <Navigate to={userData?.rol === 'alumno' ? '/mis-notas' : '/dashboard'} />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Docente routes */}
          <Route path="/dashboard" element={
            <PrivateRoute allowedRole="docente"><DashboardDocente /></PrivateRoute>
          } />
          <Route path="/evaluar" element={
            <PrivateRoute allowedRole="docente"><EvaluarTrabajo /></PrivateRoute>
          } />
          <Route path="/rubricas" element={
            <PrivateRoute allowedRole="docente"><GestionRubricas /></PrivateRoute>
          } />
          <Route path="/alumnos" element={
            <PrivateRoute allowedRole="docente"><GestionAlumnos /></PrivateRoute>
          } />

          {/* Alumno routes */}
          <Route path="/mis-notas" element={
            <PrivateRoute allowedRole="alumno"><VistaAlumno /></PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
