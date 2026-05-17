// src/components/WelcomeScreen.jsx
import { useState, useEffect, useRef } from 'react';

const MENSAJE = `La mejor tecnología no se siente como tecnología. Se siente como magia. EduEval AI es esa magia puesta al servicio de la educación peruana. Cada rúbrica, cada nota, cada retroalimentación... construye un estudiante mejor. Soy el M.Sc. Gilder Cieza Altamirano, y esto que estás a punto de ver... va a cambiarte. Bienvenido.`;

export default function WelcomeScreen({ onEnter }) {
  const [phase, setPhase] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1400);
    const t3 = setTimeout(() => setPhase(3), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => hablar(), 900);
    return () => {
      clearTimeout(timer);
      window.speechSynthesis && window.speechSynthesis.cancel();
    };
  }, []);

  const hablar = () => {
    if (!window.speechSynthesis || mutedRef.current) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(MENSAJE);

    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const voz =
        voices.find(v => v.lang === 'es-PE') ||
        voices.find(v => v.lang === 'es-MX') ||
        voices.find(v => v.lang === 'es-ES') ||
        voices.find(v => v.lang.startsWith('es'));
      if (voz) utterance.voice = voz;
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = setVoice;
    } else {
      setVoice();
    }

    utterance.lang = 'es-PE';
    utterance.rate = 0.88;
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
      setMuted(false);
      mutedRef.current = false;
      setTimeout(() => hablar(), 50);
    } else {
      setMuted(true);
      mutedRef.current = true;
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  };

  const handleEnter = () => {
    window.speechSynthesis && window.speechSynthesis.cancel();
    onEnter();
  };

  return (
    <div
      onClick={phase >= 3 ? handleEnter : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Georgia', 'Times New Roman', serif",
        overflow: 'hidden',
        cursor: phase >= 3 ? 'pointer' : 'default',
      }}
    >
      {/* Spotlight */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: phase >= 1
          ? 'radial-gradient(ellipse 65% 75% at 50% 44%, rgba(28,22,58,0.97) 0%, #000 68%)'
          : 'transparent',
        transition: 'background 1.6s ease',
      }} />

      {/* Botón mute */}
      <button
        onClick={toggleMute}
        title={muted ? 'Activar voz' : 'Silenciar'}
        style={{
          position: 'absolute', top: '24px', right: '28px', zIndex: 10,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '50%', width: '44px', height: '44px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: '20px',
          opacity: phase >= 1 ? 1 : 0,
          transition: 'opacity 0.6s ease 1s',
        }}
      >
        {muted ? '🔇' : speaking ? '🔊' : '🔈'}
      </button>

      {/* Contenido */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        maxWidth: '580px', width: '90%',
      }}>

        {/* Foto + anillos */}
        <div style={{ position: 'relative', marginBottom: '32px' }}>
          {speaking && !muted && (
            <>
              {[14, 28, 44].map((offset, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  inset: `-${offset}px`,
                  borderRadius: '50%',
                  border: `${i === 0 ? 2 : 1}px solid rgba(102,126,234,${0.45 - i * 0.13})`,
                  animation: `ring 1.6s ease-out infinite ${i * 0.28}s`,
                }} />
              ))}
            </>
          )}
          <div style={{
            width: '190px', height: '190px',
            borderRadius: '50%', overflow: 'hidden',
            border: speaking && !muted
              ? '2px solid rgba(167,139,250,0.85)'
              : '2px solid rgba(255,255,255,0.1)',
            boxShadow: phase >= 1
              ? '0 0 80px 18px rgba(102,126,234,0.24), 0 0 200px 55px rgba(118,75,162,0.1)'
              : 'none',
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'scale(1)' : 'scale(0.7)',
            transition: 'all 1.3s cubic-bezier(0.34, 1.56, 0.64, 1), border 0.4s ease',
          }}>
            <img
              src="/gilder.png"
              alt="M.Sc. Gilder Cieza Altamirano"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
            />
          </div>
        </div>

        {/* Barras de audio */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          height: '24px', marginBottom: '24px',
          opacity: speaking && !muted ? 1 : 0,
          transition: 'opacity 0.4s',
        }}>
          {[0.6, 1, 0.75, 1.2, 0.5, 0.9, 0.65].map((speed, i) => (
            <div key={i} style={{
              width: '3px', borderRadius: '2px',
              background: 'rgba(167,139,250,0.75)',
              animation: `bar ${speed}s ease-in-out infinite ${i * 0.08}s alternate`,
            }} />
          ))}
          <span style={{
            color: 'rgba(167,139,250,0.55)', fontSize: '10px',
            letterSpacing: '2.5px', textTransform: 'uppercase',
            fontFamily: 'Trebuchet MS, sans-serif', marginLeft: '8px',
          }}>
            hablando
          </span>
        </div>

        {/* Nombre */}
        <div style={{
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? 'translateY(0)' : 'translateY(18px)',
          transition: 'all 1s ease',
          textAlign: 'center', marginBottom: '8px',
        }}>
          <p style={{
            color: 'rgba(255,255,255,0.28)', fontSize: '10px',
            letterSpacing: '4px', textTransform: 'uppercase',
            margin: '0 0 12px', fontFamily: 'Trebuchet MS, sans-serif',
          }}>
            Una visión. Una plataforma.
          </p>
          <h1 style={{
            color: '#fff', fontWeight: '400',
            fontSize: 'clamp(21px, 3.8vw, 30px)',
            margin: '0 0 8px', letterSpacing: '0.5px', lineHeight: 1.25,
          }}>
            M.Sc. Gilder Cieza Altamirano
          </h1>
          <p style={{
            color: 'rgba(167,139,250,0.8)', fontSize: '12px',
            letterSpacing: '2.5px', textTransform: 'uppercase',
            fontFamily: 'Trebuchet MS, sans-serif', margin: 0,
          }}>
            Docente &amp; Creador de EduEval AI
          </p>
        </div>

        {/* Línea */}
        <div style={{
          width: phase >= 2 ? '180px' : '0px', height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.4), transparent)',
          transition: 'width 1.1s ease 0.4s', margin: '28px 0',
        }} />

        {/* Botón */}
        <div style={{
          opacity: phase >= 3 ? 1 : 0,
          transition: 'opacity 1s ease',
        }}>
          <button
            onClick={handleEnter}
            style={{
              padding: '14px 52px', borderRadius: '40px',
              border: '1px solid rgba(167,139,250,0.4)',
              background: 'rgba(102,126,234,0.1)',
              color: '#fff', fontSize: '13px',
              letterSpacing: '2.5px', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: 'Trebuchet MS, sans-serif',
              backdropFilter: 'blur(10px)',
              animation: phase >= 3 ? 'pulseGlow 2.8s ease-in-out infinite' : 'none',
            }}
          >
            Ingresar a EduEval AI
          </button>
        </div>

        <p style={{
          color: 'rgba(255,255,255,0.13)', fontSize: '10px',
          letterSpacing: '1px', marginTop: '16px',
          opacity: phase >= 3 ? 1 : 0,
          transition: 'opacity 1.2s ease 0.6s',
          fontFamily: 'Trebuchet MS, sans-serif',
        }}>
          Haz clic en cualquier lugar para continuar
        </p>
      </div>

      <style>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 18px rgba(102,126,234,0.18); border-color: rgba(167,139,250,0.35); }
          50% { box-shadow: 0 0 38px rgba(102,126,234,0.48), 0 0 75px rgba(118,75,162,0.18); border-color: rgba(167,139,250,0.75); }
        }
        @keyframes ring {
          0% { transform: scale(1); opacity: 0.65; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        @keyframes bar {
          0% { height: 3px; }
          100% { height: 20px; }
        }
      `}</style>
    </div>
  );
}