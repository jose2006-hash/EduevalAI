// src/components/WelcomeScreen.jsx
import { useState, useRef, useEffect } from 'react';

export default function WelcomeScreen({ onEnter }) {
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef(null);

  // Mostrar botón saltar a los 3s
  useEffect(() => {
    const t = setTimeout(() => setShowSkip(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // Intentar reproducir cuando el video esté listo
  useEffect(() => {
    if (!videoReady || !videoRef.current) return;
    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay bloqueado — mostrar botón de play manual
        setShowSkip(true);
      });
    }
  }, [videoReady]);

  // Fallback con voz si el video falla
  useEffect(() => {
    if (!videoError) return;
    const MENSAJE = `La mejor tecnología no se siente como tecnología. Se siente como magia. EduEval AI es esa magia puesta al servicio de la educación peruana. Cada rúbrica, cada nota, cada retroalimentación... construye un estudiante mejor. Soy el M.Sc. Gilder Cieza Altamirano, y esto que estás a punto de ver... va a cambiarte. Bienvenido.`;
    if (!window.speechSynthesis) { setVideoEnded(true); return; }
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
    } else { setVoice(); }
    utterance.lang = 'es-PE';
    utterance.rate = 0.88;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => { setSpeaking(false); setVideoEnded(true); };
    utterance.onerror = () => { setSpeaking(false); setVideoEnded(true); };
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [videoError]);

  const handleEnter = () => {
    window.speechSynthesis && window.speechSynthesis.cancel();
    if (videoRef.current) videoRef.current.pause();
    onEnter();
  };

  // Click en pantalla: si el video está pausado por autoplay, reproducirlo
  const handleScreenClick = () => {
    if (videoEnded) { handleEnter(); return; }
    if (videoRef.current && videoRef.current.paused && !videoError) {
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div
      onClick={handleScreenClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Trebuchet MS', sans-serif",
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* ── VIDEO ── */}
      {!videoError && (
        <video
          ref={videoRef}
          src="/intro.mp4"
          muted={false}
          playsInline
          preload="auto"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'contain',   // ← contain para no recortar ni hacer zoom
            background: '#000',
          }}
          onCanPlayThrough={() => setVideoReady(true)}
          onEnded={() => setVideoEnded(true)}
          onError={() => setVideoError(true)}
        />
      )}

      {/* ── FALLBACK: foto + audio ── */}
      {videoError && (
        <>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 65% 75% at 50% 44%, rgba(28,22,58,0.97) 0%, #000 68%)',
          }} />
          <div style={{
            position: 'relative', zIndex: 2,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{ position: 'relative', marginBottom: '28px' }}>
              {speaking && [14, 28, 44].map((offset, i) => (
                <div key={i} style={{
                  position: 'absolute', inset: `-${offset}px`, borderRadius: '50%',
                  border: `${i === 0 ? 2 : 1}px solid rgba(102,126,234,${0.45 - i * 0.13})`,
                  animation: `ring 1.6s ease-out infinite ${i * 0.28}s`,
                }} />
              ))}
              <div style={{
                width: '180px', height: '180px', borderRadius: '50%', overflow: 'hidden',
                border: speaking ? '2px solid rgba(167,139,250,0.85)' : '2px solid rgba(255,255,255,0.1)',
                boxShadow: '0 0 80px 18px rgba(102,126,234,0.24)',
              }}>
                <img
                  src="/gilder.png"
                  alt="M.Sc. Gilder Cieza Altamirano"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
                />
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              height: '24px', marginBottom: '20px',
              opacity: speaking ? 1 : 0, transition: 'opacity 0.4s',
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
                letterSpacing: '2.5px', textTransform: 'uppercase', marginLeft: '8px',
              }}>hablando</span>
            </div>
            <h1 style={{
              color: '#fff', fontWeight: '400',
              fontSize: 'clamp(20px, 3.5vw, 28px)',
              margin: '0 0 8px', letterSpacing: '0.5px',
            }}>
              M.Sc. Gilder Cieza Altamirano
            </h1>
            <p style={{
              color: 'rgba(167,139,250,0.8)', fontSize: '12px',
              letterSpacing: '2.5px', textTransform: 'uppercase', margin: 0,
            }}>
              Docente &amp; Creador de EduEval AI
            </p>
          </div>
        </>
      )}

      {/* ── Hint de clic si autoplay bloqueado ── */}
      {!videoEnded && !videoError && videoReady && (
        <div style={{
          position: 'absolute', bottom: '90px',
          color: 'rgba(255,255,255,0.4)', fontSize: '12px',
          letterSpacing: '2px', textTransform: 'uppercase',
          animation: 'fadeIn 1s ease 1s both',
          pointerEvents: 'none',
        }}>
          Toca para reproducir
        </div>
      )}

      {/* ── Overlay al terminar ── */}
      {videoEnded && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          animation: 'fadeIn 0.8s ease',
        }} />
      )}

      {/* ── Botón INGRESAR (solo al terminar) ── */}
      {videoEnded && (
        <div style={{
          position: 'absolute', zIndex: 10,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '16px',
          animation: 'slideUp 0.9s ease',
        }}>
          <p style={{
            color: 'rgba(255,255,255,0.45)', fontSize: '11px',
            letterSpacing: '3px', textTransform: 'uppercase', margin: 0,
          }}>
            M.Sc. Gilder Cieza Altamirano
          </p>
          <button
            onClick={handleEnter}
            style={{
              padding: '16px 60px', borderRadius: '40px',
              border: '1px solid rgba(167,139,250,0.5)',
              background: 'rgba(102,126,234,0.15)',
              color: '#fff', fontSize: '15px',
              letterSpacing: '3px', textTransform: 'uppercase',
              cursor: 'pointer', backdropFilter: 'blur(12px)',
              animation: 'pulseGlow 2.5s ease-in-out infinite',
            }}
          >
            Ingresar a EduEval AI
          </button>
          <p style={{
            color: 'rgba(255,255,255,0.2)', fontSize: '10px',
            letterSpacing: '1px', margin: 0,
          }}>
            Haz clic en cualquier lugar para continuar
          </p>
        </div>
      )}

      {/* ── Botón SALTAR ── */}
      {showSkip && !videoEnded && (
        <button
          onClick={(e) => { e.stopPropagation(); handleEnter(); }}
          style={{
            position: 'absolute', bottom: '32px', right: '32px', zIndex: 10,
            padding: '10px 22px', borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(0,0,0,0.55)',
            color: 'rgba(255,255,255,0.65)', fontSize: '12px',
            letterSpacing: '1.5px', textTransform: 'uppercase',
            cursor: 'pointer', backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.5s ease',
          }}
        >
          Saltar intro ▶▶
        </button>
      )}

      <style>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(102,126,234,0.2); border-color: rgba(167,139,250,0.4); }
          50% { box-shadow: 0 0 45px rgba(102,126,234,0.55), 0 0 90px rgba(118,75,162,0.2); border-color: rgba(167,139,250,0.85); }
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ring {
          0% { transform: scale(1); opacity: 0.65; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        @keyframes bar {
          0% { height: 3px; } 100% { height: 20px; }
        }
      `}</style>
    </div>
  );
}