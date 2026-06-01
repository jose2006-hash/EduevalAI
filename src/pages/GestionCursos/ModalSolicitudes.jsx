// src/pages/GestionCursos/ModalSolicitudes.jsx
import { s } from './styles.js';

export default function ModalSolicitudes({ cursoPendientes, pendientes, aprobados, onAprobar, onRechazar, onExpulsar, onClose }) {
  if (!cursoPendientes) return null;
  return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={s.modalHeader}>
          <div>
            <h2 style={s.modalTitle}>{cursoPendientes.nombre}</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
              Sección {cursoPendientes.seccion} · {cursoPendientes.ciclo}
            </p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '6px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(167,139,250,0.5) rgba(255,255,255,0.06)' }}>
          {/* Pendientes */}
          <div style={s.seccion}>
            <h3 style={s.seccionTitle}>
              ⏳ Solicitudes pendientes
              {pendientes.length > 0 && <span style={s.badgeRed}>{pendientes.length}</span>}
            </h3>
            {pendientes.length === 0
              ? <p style={s.emptyText}>Sin solicitudes pendientes</p>
              : pendientes.map((m, i) => (
                <div key={i} style={s.alumnoRow}>
                  <div style={s.alumnoInfo}>
                    <span style={s.alumnoAvatar}>👤</span>
                    <div>
                      <p style={s.alumnoNombre}>{m.alumnoNombre}</p>
                      <p style={s.alumnoEmail}>{m.alumnoEmail}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={s.aprobarBtn} onClick={() => onAprobar(m.id)}>✓ Aprobar</button>
                    <button style={s.rechazarBtn} onClick={() => onRechazar(m.id)}>✕ Rechazar</button>
                  </div>
                </div>
              ))}
          </div>

          {/* Aprobados */}
          <div style={s.seccion}>
            <h3 style={s.seccionTitle}>
              ✅ Alumnos aprobados
              {aprobados.length > 0 && <span style={s.badgeGreen}>{aprobados.length}</span>}
            </h3>
            {aprobados.length === 0
              ? <p style={s.emptyText}>Sin alumnos aprobados aún</p>
              : aprobados.map((m, i) => (
                <div key={i} style={s.alumnoRowAprobado}>
                  <span style={s.alumnoAvatar}>👤</span>
                  <div style={{ flex: 1 }}>
                    <p style={s.alumnoNombre}>{m.alumnoNombre}</p>
                    <p style={s.alumnoEmail}>{m.alumnoEmail}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#22c55e', fontSize: '13px' }}>✓ Aprobado</span>
                    <button style={s.expulsarBtn} onClick={() => onExpulsar(m)}>🗑</button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <button style={{ ...s.primaryBtn, width: '100%', flexShrink: 0, marginTop: '16px' }} onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
