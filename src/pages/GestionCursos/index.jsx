// src/pages/GestionCursos/index.jsx
// Orquestador principal — solo maneja estado y lógica de datos.
// El JSX de cada modal vive en su propio archivo.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCursosByDocente, crearCurso, eliminarCurso,
  getMatriculasByCurso, getPendientesByCurso,
  aprobarMatricula, rechazarMatricula, eliminarMatricula,
  crearActividad, getActividadesByCurso, eliminarActividad,
  getEntregasByCurso, eliminarEntrega,
  getRubricas, actualizarActividad,
} from '../../firebase/services.js';
import { useAuth } from '../../components/AuthContext.jsx';
import { s } from './styles.js';

import ModalSolicitudes  from './ModalSolicitudes.jsx';
import ModalActividades  from './ModalActividades.jsx';
import ModalEntregas     from './ModalEntregas.jsx';

const TIPOS_DEFAULT = [
  { nombre: 'Tareas',        peso: 30 },
  { nombre: 'Exámenes',      peso: 40 },
  { nombre: 'Participación', peso: 20 },
  { nombre: 'Otros',         peso: 10 },
];

export default function GestionCursos() {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [cursos, setCursos] = useState([]);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [leyendoPDF, setLeyendoPDF] = useState(false);

  // Solicitudes
  const [cursoPendientes, setCursoPendientes] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [aprobados, setAprobados] = useState([]);

  // Actividades
  const [cursoActividades, setCursoActividades] = useState(null);
  const [actividades, setActividades] = useState([]);
  const [rubricas, setRubricas] = useState([]);
  const [msgAct, setMsgAct] = useState('');

  // Entregas
  const [cursoEntregas, setCursoEntregas] = useState(null);
  const [entregas, setEntregas] = useState([]);

  // Form nuevo curso
  const [form, setForm] = useState({
    nombre: '', seccion: '', codigo: '', descripcion: '', ciclo: '',
    silaboTexto: '', silaboNombre: '', tiposEvaluacion: TIPOS_DEFAULT,
  });

  useEffect(() => { if (userData?.uid) cargarCursos(); }, [userData]);

  const cargarCursos = async () => {
    const crs = await getCursosByDocente(userData.uid);
    setCursos(crs);
  };

  // ── Solicitudes ────────────────────────────────────────────────────────────
  const abrirSolicitudes = async (curso) => {
    setCursoPendientes(curso);
    const [pends, todos] = await Promise.all([getPendientesByCurso(curso.id), getMatriculasByCurso(curso.id)]);
    setPendientes(pends);
    setAprobados(todos.filter(m => m.estado === 'aprobado'));
  };

  // ── Actividades ────────────────────────────────────────────────────────────
  const abrirActividades = async (curso) => {
    setCursoActividades(curso); setMsgAct('');
    const [acts, rubs] = await Promise.all([getActividadesByCurso(curso.id), getRubricas(curso.id)]);
    setActividades(acts); setRubricas(rubs);
  };

  const handleGuardarActividad = async (formAct) => {
    // Edición de fecha
    if (formAct._edit) {
      await actualizarActividad(formAct.id, { fechaLimite: formAct.fechaLimite });
      setActividades(await getActividadesByCurso(cursoActividades.id));
      setMsgAct('✅ Fecha actualizada');
      return;
    }
    if (!formAct.titulo.trim()) return setMsgAct('❌ El título es obligatorio');
    if (!formAct.tipoEvaluacion) return setMsgAct('❌ Selecciona el tipo de evaluación');
    if (!formAct.enunciadoTexto?.trim() && !formAct.descripcion?.trim()) return setMsgAct('❌ Agrega descripción o enunciado');
    try {
      await crearActividad({ ...formAct, cursoId: cursoActividades.id, cursoNombre: cursoActividades.nombre, docenteUid: userData.uid, docenteNombre: userData.nombre });
      setMsgAct(`✅ Actividad "${formAct.titulo}" publicada`);
      setActividades(await getActividadesByCurso(cursoActividades.id));
    } catch (err) { setMsgAct('❌ Error: ' + err.message); }
  };

  // ── Entregas ───────────────────────────────────────────────────────────────
  const abrirEntregas = async (curso) => {
    setCursoEntregas(curso);
    const ents = await getEntregasByCurso(curso.id);
    ents.sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0));
    setEntregas(ents);
  };

  const handleNotaGuardada = (actualizada) => {
    setEntregas(prev => prev.map(e => e.id === actualizada.id ? actualizada : e));
  };

  // ── Confirmaciones ─────────────────────────────────────────────────────────
  const ejecutarConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.tipo === 'alumno') {
        await eliminarMatricula(confirm.id);
        await abrirSolicitudes(cursoPendientes);
        setMsg('✅ Alumno eliminado');
      } else if (confirm.tipo === 'actividad') {
        await eliminarActividad(confirm.id);
        setActividades(await getActividadesByCurso(cursoActividades.id));
        setMsgAct('✅ Actividad eliminada');
      } else if (confirm.tipo === 'curso') {
        await eliminarCurso(confirm.id);
        await cargarCursos();
        setMsg('✅ Curso eliminado');
      } else if (confirm.tipo === 'entrega') {
        await eliminarEntrega(confirm.id);
        setEntregas(await getEntregasByCurso(cursoEntregas.id));
        setMsg('✅ Entrega eliminada');
      }
    } catch (err) { setMsg('❌ Error: ' + err.message); }
    setConfirm(null);
  };

  // ── Nuevo curso ────────────────────────────────────────────────────────────
  const totalPeso = form.tiposEvaluacion.reduce((s, t) => s + (t.peso || 0), 0);

  const updateTipo = (i, field, val) => {
    const tipos = [...form.tiposEvaluacion];
    tipos[i] = { ...tipos[i], [field]: field === 'peso' ? Number(val) : val };
    setForm(f => ({ ...f, tiposEvaluacion: tipos }));
  };

  const handleSilaboPDF = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLeyendoPDF(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ').replace(/\s{3,}/g, '\n').substring(0, 8000);
      setForm(f => ({ ...f, silaboTexto: text, silaboNombre: file.name }));
      setLeyendoPDF(false);
    };
    reader.readAsText(file, 'latin1');
  };

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return setMsg('❌ Nombre obligatorio');
    if (!form.seccion.trim()) return setMsg('❌ Sección obligatoria');
    if (!form.codigo.trim()) return setMsg('❌ Código obligatorio');
    if (totalPeso !== 100) return setMsg(`❌ Los pesos deben sumar 100% (ahora: ${totalPeso}%)`);
    setGuardando(true); setMsg('');
    try {
      await crearCurso({ ...form, docenteUid: userData.uid, docenteNombre: userData.nombre });
      setMsg(`✅ Curso "${form.nombre}" creado`);
      await cargarCursos(); setShowForm(false);
      setForm({ nombre: '', seccion: '', codigo: '', descripcion: '', ciclo: '', silaboTexto: '', silaboNombre: '', tiposEvaluacion: TIPOS_DEFAULT });
    } catch (err) { setMsg('❌ Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  return (
    <div style={s.container}>
      <header style={s.header}>
        <button onClick={() => navigate('/dashboard')} style={s.backBtn}>← Dashboard</button>
        <h1 style={s.title}>Mis Cursos</h1>
        <button style={s.primaryBtn} onClick={() => setShowForm(true)}>+ Nuevo Curso</button>
      </header>

      {msg && (
        <div style={{ color: msg.includes('✅') ? '#22c55e' : '#ef4444', marginBottom: '16px', fontSize: '14px', background: msg.includes('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '12px 16px', borderRadius: '10px' }}>
          {msg}
        </div>
      )}

      {/* Grid de cursos */}
      <div style={s.grid}>
        {cursos.map((c, i) => (
          <div key={i} style={s.cursoCard}>
            <div style={s.cursoTop}>
              <span style={s.cursoIcon}>📚</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {c.seccion && <span style={s.seccionBadge}>Sección {c.seccion}</span>}
                <button style={s.deleteCursoBtn} onClick={() => setConfirm({ tipo: 'curso', id: c.id, nombre: c.nombre })}>🗑</button>
              </div>
            </div>
            <h3 style={s.cursoNombre}>{c.nombre}</h3>
            <p style={s.cursoCiclo}>{c.ciclo && `${c.ciclo} · `}{c.descripcion}</p>
            <div style={s.tiposList}>
              {c.tiposEvaluacion?.map((t, j) => <span key={j} style={s.tipoTag}>{t.nombre} {t.peso}%</span>)}
            </div>
            {c.silaboNombre && <p style={s.silaboTag}>📄 {c.silaboNombre}</p>}
            <div style={s.infoBox}>
              <p style={s.infoLabel}>Los alumnos ingresan con:</p>
              <p style={s.infoValue}>Código: <strong style={{ color: '#a78bfa' }}>{c.codigo}</strong> + nombre del profesor</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <button style={s.entregasBtn}    onClick={() => abrirEntregas(c)}>📋 Ver entregas de alumnos</button>
              <button style={s.actividadesBtn} onClick={() => abrirActividades(c)}>📝 Actividades y enunciados</button>
              <button style={s.solicitudesBtn} onClick={() => abrirSolicitudes(c)}>👥 Ver alumnos y solicitudes</button>
            </div>
          </div>
        ))}
        {cursos.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.3)', gridColumn: '1/-1', textAlign: 'center', padding: '48px' }}>
            No tienes cursos. Crea el primero.
          </p>
        )}
      </div>

      {/* ── Modal confirmación ── */}
      {confirm && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: '420px', textAlign: 'center' }}>
            <p style={{ fontSize: '40px', margin: '0 0 12px' }}>⚠️</p>
            <h3 style={{ color: '#fff', fontSize: '18px', margin: '0 0 8px' }}>
              {confirm.tipo === 'alumno' ? 'Eliminar alumno' : confirm.tipo === 'actividad' ? 'Eliminar actividad' : confirm.tipo === 'entrega' ? 'Eliminar entrega' : 'Eliminar curso'}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 24px', lineHeight: '1.5' }}>
              ¿Eliminar <strong style={{ color: '#fff' }}>"{confirm.nombre}"</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button style={s.secondaryBtn} onClick={() => setConfirm(null)}>Cancelar</button>
              <button style={s.dangerBtn} onClick={ejecutarConfirm}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nuevo curso ── */}
      {showForm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Nuevo Curso</h2>
              <button style={s.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div style={s.grid3}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={s.label}>Nombre del curso *</label>
                <input style={s.input} placeholder="Ej: Contabilidad General"
                  value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Sección *</label>
                <input style={s.input} placeholder="Ej: A"
                  value={form.seccion} onChange={e => setForm(f => ({ ...f, seccion: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Código del curso *</label>
                <input style={s.input} placeholder="Ej: CONT-2024-A"
                  value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} />
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '6px' }}>Comparte este código con tus alumnos</p>
              </div>
              <div>
                <label style={s.label}>Ciclo / Semestre</label>
                <input style={s.input} placeholder="Ej: 2024-II"
                  value={form.ciclo} onChange={e => setForm(f => ({ ...f, ciclo: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={s.label}>Descripción</label>
              <input style={s.input} placeholder="Descripción breve"
                value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div style={s.silaboBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={s.label}>📄 Sílabo del curso</label>
                <label style={s.uploadBtn}>
                  {leyendoPDF ? '⏳ Leyendo...' : form.silaboNombre ? `✅ ${form.silaboNombre}` : '📎 Subir PDF'}
                  <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleSilaboPDF} />
                </label>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: 0 }}>La IA usará el sílabo como referencia al evaluar trabajos</p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label style={s.label}>Tipos de Evaluación y Pesos</label>
                <span style={{ color: totalPeso === 100 ? '#22c55e' : '#ef4444', fontSize: '13px', fontWeight: '600' }}>
                  Total: {totalPeso}% {totalPeso === 100 ? '✓' : '← debe ser 100%'}
                </span>
              </div>
              {form.tiposEvaluacion.map((t, i) => (
                <div key={i} style={s.tipoRow}>
                  <input style={{ ...s.input, flex: 2 }} placeholder="Nombre (ej: Tareas)"
                    value={t.nombre} onChange={e => updateTipo(i, 'nombre', e.target.value)} />
                  <input style={{ ...s.input, width: '70px', textAlign: 'center' }}
                    type="number" min="0" max="100" value={t.peso}
                    onChange={e => updateTipo(i, 'peso', e.target.value)} />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>%</span>
                  <button style={s.removeBtn}
                    onClick={() => setForm(f => ({ ...f, tiposEvaluacion: f.tiposEvaluacion.filter((_, idx) => idx !== i) }))}>
                    ✕
                  </button>
                </div>
              ))}
              <button style={s.addTipoBtn}
                onClick={() => setForm(f => ({ ...f, tiposEvaluacion: [...f.tiposEvaluacion, { nombre: '', peso: 0 }] }))}>
                + Agregar tipo
              </button>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={s.secondaryBtn} onClick={() => setShowForm(false)}>Cancelar</button>
              <button style={s.primaryBtn} onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Creando...' : '🚀 Crear Curso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modales delegados ── */}
      <ModalSolicitudes
        cursoPendientes={cursoPendientes}
        pendientes={pendientes}
        aprobados={aprobados}
        onAprobar={async (id) => { await aprobarMatricula(id); await abrirSolicitudes(cursoPendientes); }}
        onRechazar={async (id) => { await rechazarMatricula(id); await abrirSolicitudes(cursoPendientes); }}
        onExpulsar={(m) => setConfirm({ tipo: 'alumno', id: m.id, nombre: m.alumnoNombre })}
        onClose={() => setCursoPendientes(null)}
      />

      <ModalActividades
        cursoActividades={cursoActividades}
        actividades={actividades}
        rubricas={rubricas}
        msgAct={msgAct}
        onGuardar={handleGuardarActividad}
        onEliminar={(a) => setConfirm({ tipo: 'actividad', id: a.id, nombre: a.titulo })}
        onClose={() => { setCursoActividades(null); setMsgAct(''); }}
      />

      {cursoEntregas && (
        <ModalEntregas
          cursoEntregas={cursoEntregas}
          entregas={entregas}
          docenteNombre={userData?.nombre || ''}
          onEliminar={(e) => setConfirm({ tipo: 'entrega', id: e.id, nombre: `${e.alumnoNombre} — ${e.titulo}` })}
          onNotaGuardada={handleNotaGuardada}
          onClose={() => setCursoEntregas(null)}
        />
      )}
    </div>
  );
}
