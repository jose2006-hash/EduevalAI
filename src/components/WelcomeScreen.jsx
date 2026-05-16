// src/components/WelcomeScreen.jsx
// Pantalla de bienvenida estilo Steve Jobs — Prof. Gilder Cieza Altamirano
import { useState, useEffect } from 'react';

export default function WelcomeScreen({ onEnter }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 1800);
    const t3 = setTimeout(() => setPhase(3), 3000);
    const t4 = setTimeout(() => setPhase(4), 5200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const quotes = [
    "La educación no es llenar un cubo,",
    "sino encender un fuego.",
    "— Hoy, ese fuego tiene nombre: EduEval AI.",
  ];

  return (
    <div
      onClick={phase >= 4 ? onEnter : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Georgia', 'Times New Roman', serif",
        overflow: 'hidden',
        cursor: phase >= 4 ? 'pointer' : 'default',
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        background: phase >= 1
          ? 'radial-gradient(ellipse 60% 70% at 50% 42%, rgba(30,25,60,0.95) 0%, #000 70%)'
          : 'transparent',
        transition: 'background 1.4s ease',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: '680px',
        width: '90%',
      }}>

        <div style={{
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '2px solid rgba(255,255,255,0.12)',
          boxShadow: phase >= 1
            ? '0 0 80px 20px rgba(102,126,234,0.25), 0 0 200px 60px rgba(118,75,162,0.1)'
            : 'none',
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? 'scale(1)' : 'scale(0.7)',
          transition: 'all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          marginBottom: '32px',
        }}>
          <img
            src="/gilder.png"
            alt="Prof. Gilder Cieza Altamirano"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
          />
        </div>

        <div style={{
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.9s ease',
          textAlign: 'center',
          marginBottom: '8px',
        }}>
          <p style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: '11px',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            margin: '0 0 10px',
            fontFamily: "'Trebuchet MS', sans-serif",
          }}>
            Una visión. Una plataforma.
          </p>
          <h1 style={{
            color: '#fff',
            fontSize: 'clamp(22px, 4vw, 32px)',
            fontWeight: '400',
            margin: '0 0 6px',
            letterSpacing: '1px',
            lineHeight: 1.2,
          }}>
            Prof. Gilder Cieza Altamirano
          </h1>
          <p style={{
            color: 'rgba(167,139,250,0.9)',
            fontSize: '13px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            fontFamily: "'Trebuchet MS', sans-serif",
            margin: 0,
          }}>
            Docente &amp; Creador de EduEval AI
          </p>
        </div>

        <div style={{
          width: phase >= 2 ? '200px' : '0px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)',
          transition: 'width 1s ease 0.3s',
          margin: '28px 0',
        }} />

        <div style={{ textAlign: 'center', minHeight: '90px' }}>
          {quotes.map((line, i) => (
            <p key={i} style={{
              color: i === 2 ? 'rgba(167,139,250,0.7)' : 'rgba(255,255,255,0.75)',
              fontSize: i === 2 ? '13px' : 'clamp(15px, 2.5vw, 19px)',
              fontStyle: i < 2 ? 'italic' : 'normal',
              letterSpacing: i === 2 ? '1px' : '0.3px',
              lineHeight: 1.6,
              margin: '4px 0',
              opacity: phase >= 3 ? 1 : 0,
              transform: phase >= 3 ? 'translateY(0)' : 'translateY(12px)',
              transition: `all 0.8s ease ${0.1 + i * 0.4}s`,
            }}>
              {line}
            </p>
          ))}
        </div>

        <div style={{
          marginTop: '48px',
          opacity: phase >= 4 ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}>
          <button
            onClick={onEnter}
            style={{
              padding: '14px 48px',
              borderRadius: '40px',
              border: '1px solid rgba(167,139,250,0.4)',
              background: 'rgba(102,126,234,0.12)',
              color: '#fff',
              fontSize: '14px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: "'Trebuchet MS', sans-serif",
              backdropFilter: 'blur(10px)',
              animation: phase >= 4 ? 'pulseGlow 2.5s ease-in-out infinite' : 'none',
            }}
          >
            Ingresar a EduEval AI
          </button>
        </div>

        <p style={{
          color: 'rgba(255,255,255,0.18)',
          fontSize: '11px',
          letterSpacing: '1px',
          marginTop: '20px',
          opacity: phase >= 4 ? 1 : 0,
          transition: 'opacity 1s ease 0.5s',
          fontFamily: "'Trebuchet MS', sans-serif",
        }}>
          Haz clic en cualquier lugar para continuar
        </p>
      </div>

      <style>{`
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(102,126,234,0.2);
            border-color: rgba(167,139,250,0.4);
          }
          50% {
            box-shadow: 0 0 40px rgba(102,126,234,0.5), 0 0 80px rgba(118,75,162,0.2);
            border-color: rgba(167,139,250,0.8);
          }
        }
      `}</style>
    </div>
  );
}