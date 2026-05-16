// src/components/WelcomeScreen.jsx
import { useState, useEffect, useRef } from 'react';

const MENSAJE_BIENVENIDA = `Bienvenido a EduEval AI. 
Soy el profesor Gilder Cieza Altamirano, creador de esta plataforma. 
La educación no es llenar un cubo... sino encender un fuego. 
Hoy, ese fuego tiene nombre: EduEval AI. 
Una herramienta diseñada para transformar la forma en que evaluamos, aprendemos y crecemos juntos. 
Bienvenido. Ingresa y comienza tu experiencia.`;

export default function WelcomeScreen({ onEnter }) {
  const [phase, setPhase] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speechReady, setSpeechReady] = useState(false);
  const utteranceRef = useRef(null);
  const mutedRef = useRef(false);

  // Sincronizar ref con state para usar dentro de callbacks
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 1800);
    const t3 = setTimeout(() => setPhase(3), 3000);
    const t4 = setTimeout(() => {
      setPhase(4);
      setSpeechReady(true);
    }, 4800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  // Hablar automáticamente cuando speechReady sea true
  useEffect(() => {
    if (!speechReady) return;
    hablar();
  }, [speechReady]);

  const hablar = () => {
    if (!window.speechSynthesis || mutedRef.current) return;

    // Cancelar cualquier voz anterior
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(MENSAJE_BIENVENIDA);
    utteranceRef.current = utterance;

    // Configurar voz en español
    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const esVoice =
        voices.find(v => v.lang === 'es-PE') ||
        voices.find(v => v.lang === 'es-MX') ||
        voices.find(v => v.lang === 'es-ES') ||
        voices.find(v => v.lang.startsWith('es'));
      if (esVoice) utterance.voice = esVoice;
    };

    setVoice();
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = setVoice;
    }

    utterance.lang = 'es-PE';
    utterance.rate = 0.92;
    utterance.pitch = 1.05;
    utterance.volume = 1;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (muted) {
      // Desmutear → volver a hablar desde el inicio
      setMuted(false);
      mutedRef.current = false;
      setTimeout(() => hablar(), 50);
    } else {
      // Mutear → detener
      setMuted(true);
      mutedRef.current = true;
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  };

  const handleEnter = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    onEnter();
  };

  const quotes = [
    "La educación no es llenar un cubo,",
    "sino encender un fuego.",
    "— Hoy, ese fuego tiene nombre: EduEval AI.",
  ];

  return (
    <div
      onClick={phase >= 4 ? handleEnter : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Georgia', 'Times New Roman', serif",
        overflow: 'hidden',
        cursor: phase >= 4 ? 'pointer' : 'default',
      }}
    >
      {/* Spotlight */}
      <div style={{
        position: 'absolute', inset: 0,
        background: phase >= 1
          ? 'radial-gradient(ellipse 60% 70% at 50% 42%, rgba(30,25,60,0.95) 0%, #000 70%)'
          : 'transparent',
        transition: 'background 1.4s ease',
        pointerEvents: 'none',
      }} />

      {/* Botón mute — esquina superior derecha */}
      {phase >= 4 && (
        <button
          onClick={toggleMute}
          title={muted ? 'Activar voz' : 'Silenciar'}
          style={{
            position: 'absolute', top: '24px', right: '28px',
            zIndex: 10,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '50%',
            width: '44px', height: '44px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '20px',
            transition: 'all 0.2s',
          }}
        >
          {muted ? '🔇' : speaking ? '🔊' : '🔈'}
        </button>
      )}

      {/* Contenido */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        maxWidth: '680px', width: '90%',
      }}>

        {/* Foto con onda de audio */}
        <div style={{ position: 'relative', marginBottom: '32px' }}>
          {/* Anillos de audio */}
          {speaking && !muted && (
            <>
              <div style={{
                position: 'absolute', inset: '-12px', borderRadius: '50%',
                border: '2px solid rgba(102,126,234,0.4)',
                animation: 'ring1 1.5s ease-out infinite',
              }} />
              <div style={{
                position: 'absolute', inset: '-24px', borderRadius: '50%',
                border: '2px solid rgba(102,126,234,0.2)',
                animation: 'ring2 1.5s ease-out infinite 0.3s',
              }} />
              <div style={{
                position: 'absolute', inset: '-36px', borderRadius: '50%',
                border: '1px solid rgba(167,139,250,0.15)',
                animation: 'ring3 1.5s ease-out infinite 0.6s',
              }} />
            </>
          )}

          <div style={{
            width: '180px', height: '180px',
            borderRadius: '50%', overflow: 'hidden',
            border: speaking && !muted
              ? '2px solid rgba(167,139,250,0.8)'
              : '2px solid rgba(255,255,255,0.12)',
            boxShadow: phase >= 1
              ? '0 0 80px 20px rgba(102,126,234,0.25), 0 0 200px 60px rgba(118,75,162,0.1)'
              : 'none',
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'scale(1)' : 'scale(0.7)',
            transition: 'all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <img
              src="/gilder.png"
              alt="Prof. Gilder Cieza Altamirano"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
            />
          </div>
        </div>

        {/* Indicador "hablando" */}
        {phase >= 4 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '16px',
            opacity: speaking && !muted ? 1 : 0,
            transition: 'opacity 0.4s',
            height: '20px',
          }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{
                width: '3px',
                background: 'rgba(167,139,250,0.8)',
                borderRadius: '2px',
                animation: speaking && !muted ? `bar 0.8s ease-in-out infinite ${i * 0.1}s alternate` : 'none',
                height: '12px',
              }} />
            ))}
            <span style={{
              color: 'rgba(167,139,250,0.7)',
              fontSize: '10px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontFamily: 'Trebuchet MS, sans-serif',
              marginLeft: '4px',
            }}>
              hablando
            </span>
          </div>
        )}

        {/* Nombre */}
        <div style={{
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.9s ease',
          textAlign: 'center', marginBottom: '8px',
        }}>
          <p style={{
            color: 'rgba(255,255,255,0.35)', fontSize: '11px',
            letterSpacing: '4px', textTransform: 'uppercase',
            margin: '0 0 10px', fontFamily: 'Trebuchet MS, sans-serif',
          }}>
            Una visión. Una plataforma.
          </p>
          <h1 style={{
            color: '#fff', fontSize: 'clamp(22px, 4vw, 32px)',
            fontWeight: '400', margin: '0 0 6px',
            letterSpacing: '1px', lineHeight: 1.2,
          }}>
            Prof. Gilder Cieza Altamirano
          </h1>
          <p style={{
            color: 'rgba(167,139,250,0.9)', fontSize: '13px',
            letterSpacing: '2px', textTransform: 'uppercase',
            fontFamily: 'Trebuchet MS, sans-serif', margin: 0,
          }}>
            Docente &amp; Creador de EduEval AI
          </p>
        </div>

        {/* Línea */}
        <div style={{
          width: phase >= 2 ? '200px' : '0px', height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)',
          transition: 'width 1s ease 0.3s', margin: '24px 0',
        }} />

        {/* Citas */}
        <div style={{ textAlign: 'center', minHeight: '90px' }}>
          {quotes.map((line, i) => (
            <p key={i} style={{
              color: i === 2 ? 'rgba(167,139,250,0.7)' : 'rgba(255,255,255,0.75)',
              fontSize: i === 2 ? '13px' : 'clamp(15px, 2.5vw, 19px)',
              fontStyle: i < 2 ? 'italic' : 'normal',
              letterSpacing: i === 2 ? '1px' : '0.3px',
              lineHeight: 1.6, margin: '4px 0',
              opacity: phase >= 3 ? 1 : 0,
              transform: phase >= 3 ? 'translateY(0)' : 'translateY(12px)',
              transition: `all 0.8s ease ${0.1 + i * 0.4}s`,
            }}>
              {line}
            </p>
          ))}
        </div>

        {/* Botón */}
        <div style={{
          marginTop: '40px',
          opacity: phase >= 4 ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}>
          <button
            onClick={handleEnter}
            style={{
              padding: '14px 48px', borderRadius: '40px',
              border: '1px solid rgba(167,139,250,0.4)',
              background: 'rgba(102,126,234,0.12)',
              color: '#fff', fontSize: '14px',
              letterSpacing: '2px', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: 'Trebuchet MS, sans-serif',
              backdropFilter: 'blur(10px)',
              animation: phase >= 4 ? 'pulseGlow 2.5s ease-in-out infinite' : 'none',
            }}
          >
            Ingresar a EduEval AI
          </button>
        </div>

        <p style={{
          color: 'rgba(255,255,255,0.18)', fontSize: '11px',
          letterSpacing: '1px', marginTop: '16px',
          opacity: phase >= 4 ? 1 : 0,
          transition: 'opacity 1s ease 0.5s',
          fontFamily: 'Trebuchet MS, sans-serif',
        }}>
          Haz clic en cualquier lugar para continuar
        </p>
      </div>

      <style>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(102,126,234,0.2); border-color: rgba(167,139,250,0.4); }
          50% { box-shadow: 0 0 40px rgba(102,126,234,0.5), 0 0 80px rgba(118,75,162,0.2); border-color: rgba(167,139,250,0.8); }
        }
        @keyframes ring1 {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        @keyframes ring2 {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        @keyframes ring3 {
          0% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(1.25); opacity: 0; }
        }
        @keyframes bar {
          0% { height: 4px; }
          100% { height: 20px; }
        }
      `}</style>
    </div>
  );
}