// src/openai/evaluador.js

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Convierte un File a base64 (sin el prefijo data:...)
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const evaluarTrabajo = async (
  input,
  rubrica,
  curso,
  tema,
  silaboTexto = '',
  enunciadoTexto = ''
) => {
  const criteriosTexto = rubrica.criterios
    .map(
      (c, i) =>
        `${i + 1}. ${c.nombre} (peso: ${c.peso}%): ${c.descripcion}
   - Excelente (${c.puntajeMax}pts): ${c.niveles?.excelente || 'Cumple todos los requisitos'}
   - Bueno (${Math.round(c.puntajeMax * 0.75)}pts): ${c.niveles?.bueno || 'Cumple la mayoría'}
   - Regular (${Math.round(c.puntajeMax * 0.5)}pts): ${c.niveles?.regular || 'Cumple parcialmente'}
   - Insuficiente (${Math.round(c.puntajeMax * 0.25)}pts): ${c.niveles?.insuficiente || 'No cumple'}`
    )
    .join('\n\n');

  const silaboSeccion = silaboTexto
    ? `\n=== SÍLABO DEL CURSO ===\n${silaboTexto.substring(0, 2000)}\n`
    : '';

  const enunciadoSeccion = enunciadoTexto
    ? `\n=== ENUNCIADO DE LA ACTIVIDAD (lo que el docente solicitó) ===\n${enunciadoTexto.substring(0, 2000)}\n`
    : '';

  const instruccion = enunciadoTexto.trim()
    ? 'Evalúa si el trabajo responde correctamente al enunciado. Penaliza si el alumno no abordó lo solicitado.'
    : silaboTexto.trim()
    ? 'Verifica que el trabajo se alinee con los contenidos del sílabo.'
    : '';

  const promptBase = `Eres un evaluador académico experto en el curso de "${curso}".
Evalúa el trabajo sobre "${tema}" usando ESTRICTAMENTE la rúbrica proporcionada.
${instruccion}

=== RÚBRICA DE EVALUACIÓN ===
${criteriosTexto}
Puntaje total máximo: ${rubrica.puntajeTotal || 20} puntos
${enunciadoSeccion}${silaboSeccion}

Responde ÚNICAMENTE en JSON con esta estructura exacta (sin markdown, sin bloques de código):
{
  "criterios": [
    {
      "nombre": "nombre del criterio",
      "puntajeObtenido": número,
      "puntajeMaximo": número,
      "nivel": "Excelente|Bueno|Regular|Insuficiente",
      "comentario": "comentario de 1-2 oraciones"
    }
  ],
  "notaFinal": número entre 0 y 20,
  "porcentaje": número entre 0 y 100,
  "nivelGlobal": "Excelente|Bueno|Regular|Insuficiente",
  "fortalezas": ["fortaleza 1", "fortaleza 2"],
  "areasDesMejora": ["área 1", "área 2"],
  "retroalimentacionGeneral": "párrafo de 3-4 oraciones",
  "recomendaciones": ["recomendación 1", "recomendación 2"]
}`;

  if (input instanceof File) {
    const isPdf = input.type === 'application/pdf' || input.name?.toLowerCase().endsWith('.pdf');
    const isDocx =
      input.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      input.name?.toLowerCase().endsWith('.docx');

    if (isPdf || isDocx) {
      const formData = new FormData();
      formData.append('file', input, input.name);
      formData.append('purpose', 'assistants');

      const uploadRes = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.id) throw new Error('No se pudo subir el archivo: ' + JSON.stringify(uploadData));
      const fileId = uploadData.id;

      let resultData;
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: 'Eres un evaluador académico justo y detallado. Siempre respondes en JSON válido sin markdown ni bloques de código.' },
              {
                role: 'user',
                content: [
                  { type: 'text', text: promptBase + `\n\nEl trabajo del alumno está en el archivo adjunto (${isPdf ? 'PDF' : 'Word'}). Léelo y evalúalo.` },
                  { type: 'file', file: { file_id: fileId } },
                ],
              },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
            max_tokens: 2000,
          }),
        });
        resultData = await response.json();
      } finally {
        fetch(`https://api.openai.com/v1/files/${fileId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        }).catch(() => {});
      }

      const content = resultData.choices?.[0]?.message?.content;
      if (!content) throw new Error(resultData.error?.message || 'Sin respuesta de OpenAI');
      return JSON.parse(content.replace(/```json|```/g, '').trim());
    } else {
      throw new Error(`Tipo de archivo no soportado: ${input.type || input.name}`);
    }
  }

  // Texto plano
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Eres un evaluador académico justo y detallado. Siempre respondes en JSON válido sin markdown ni bloques de código.' },
        { role: 'user', content: promptBase + `\n\n=== TRABAJO DEL ALUMNO ===\n${input}` },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(data.error?.message || 'Sin respuesta de OpenAI');
  return JSON.parse(content.replace(/```json|```/g, '').trim());
};

// ─── DETECTOR DE IA ──────────────────────────────────────────────────────────
//
// Analiza el texto o archivo del alumno y estima el porcentaje de contenido
// generado por IA. Retorna:
//   { porcentajeIA, nivel, indicadores, veredicto, observacion }
//
// porcentajeIA: 0-100
// nivel: 'Bajo' | 'Moderado' | 'Alto' | 'Muy alto'
// indicadores: string[] — señales específicas detectadas
// veredicto: string — frase corta
// observacion: string — párrafo explicativo para el alumno
//
export const detectarIA = async (input) => {
  const prompt = `Eres un experto en detección de contenido generado por inteligencia artificial en trabajos académicos universitarios.

Analiza el texto proporcionado y determina qué porcentaje estimas fue generado por IA (ChatGPT, Gemini, Copilot u otros LLMs).

Busca indicadores como:
- Estructura excesivamente perfecta y simétrica
- Frases largas y formales sin errores tipográficos
- Uso repetido de conectores como "en primer lugar", "además", "en conclusión"
- Ausencia de voz personal, experiencias propias o errores propios del alumno
- Párrafos con longitud uniforme y ritmo mecánico
- Explicaciones genéricas sin ejemplos concretos o locales
- Terminología técnica usada de forma amplia pero superficial
- Ausencia de citas de fuentes reales o citas genéricas

Responde ÚNICAMENTE en JSON (sin markdown):
{
  "porcentajeIA": número entre 0 y 100,
  "nivel": "Bajo" | "Moderado" | "Alto" | "Muy alto",
  "indicadores": ["indicador 1 detectado", "indicador 2 detectado"],
  "veredicto": "frase corta de 5-10 palabras",
  "observacion": "párrafo explicativo de 2-3 oraciones dirigido al alumno, en tono académico"
}

Criterios de nivel:
- Bajo: 0-25% (probablemente escrito por el alumno)
- Moderado: 26-55% (mezcla probable de IA y redacción propia)
- Alto: 56-80% (mayoría de contenido generado por IA)
- Muy alto: 81-100% (casi todo generado por IA)`;

  try {
    // Si es archivo, subirlo primero
    if (input instanceof File) {
      const isPdf  = input.name?.toLowerCase().endsWith('.pdf');
      const isDocx = input.name?.toLowerCase().endsWith('.docx');

      if (isPdf || isDocx) {
        const formData = new FormData();
        formData.append('file', input, input.name);
        formData.append('purpose', 'assistants');

        const uploadRes = await fetch('https://api.openai.com/v1/files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.id) throw new Error('No se pudo subir el archivo para análisis de IA');
        const fileId = uploadData.id;

        let resultData;
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: 'Eres un detector de contenido generado por IA en trabajos académicos. Respondes en JSON válido.' },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: prompt + '\n\nEl texto a analizar está en el archivo adjunto.' },
                    { type: 'file', file: { file_id: fileId } },
                  ],
                },
              ],
              temperature: 0.2,
              response_format: { type: 'json_object' },
              max_tokens: 800,
            }),
          });
          resultData = await response.json();
        } finally {
          fetch(`https://api.openai.com/v1/files/${fileId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
          }).catch(() => {});
        }

        const content = resultData.choices?.[0]?.message?.content;
        if (!content) throw new Error('Sin respuesta del detector de IA');
        return JSON.parse(content.replace(/```json|```/g, '').trim());
      }
    }

    // Texto plano
    const textoAnalizar = typeof input === 'string' ? input : '';
    if (!textoAnalizar.trim()) {
      return { porcentajeIA: 0, nivel: 'Bajo', indicadores: [], veredicto: 'Sin texto para analizar', observacion: 'No se pudo analizar el contenido.' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Eres un detector de contenido generado por IA en trabajos académicos. Respondes en JSON válido.' },
          { role: 'user', content: prompt + `\n\n=== TEXTO A ANALIZAR ===\n${textoAnalizar.substring(0, 6000)}` },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: 800,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Sin respuesta del detector de IA');
    return JSON.parse(content.replace(/```json|```/g, '').trim());

  } catch (err) {
    console.error('Error en detectarIA:', err);
    return {
      porcentajeIA: null,
      nivel: 'No disponible',
      indicadores: [],
      veredicto: 'No se pudo analizar',
      observacion: 'El análisis de IA no pudo completarse en este momento.',
    };
  }
};

// ─── REPORTE ESTADÍSTICO POR CURSO ───────────────────────────────────────────
//
// Recibe todas las entregas evaluadas de un curso y genera:
//   - Análisis por alumno (fortalezas, debilidades, recomendación personalizada)
//   - Análisis estadístico global (temas con menor rendimiento, distribución)
//   - Recomendaciones pedagógicas para el docente (qué temas reforzar en clase)
//
export const generarReporteEstadistico = async (entregas, cursoNombre, docenteNombre = '') => {
  if (!entregas || entregas.length === 0) throw new Error('No hay entregas para analizar');

  // Preparar resumen compacto para no exceder tokens
  const evaluadas = entregas.filter(e => e.estado === 'evaluado');
  if (evaluadas.length === 0) throw new Error('No hay entregas evaluadas aún');

  // Agrupar por alumno
  const porAlumno = {};
  evaluadas.forEach(e => {
    if (!porAlumno[e.alumnoNombre]) porAlumno[e.alumnoNombre] = [];
    porAlumno[e.alumnoNombre].push(e);
  });

  // Agrupar por tema
  const porTema = {};
  evaluadas.forEach(e => {
    const tema = e.actividadTitulo || e.titulo || 'Sin tema';
    if (!porTema[tema]) porTema[tema] = [];
    porTema[tema].push(e);
  });

  // Resumen compacto para la IA
  const resumenAlumnos = Object.entries(porAlumno).map(([nombre, ents]) => {
    const prom = (ents.reduce((s, e) => s + (e.notaFinal || 0), 0) / ents.length).toFixed(1);
    const areas = [...new Set(ents.flatMap(e => e.areasDesMejora || []))].slice(0, 3);
    const fortalezas = [...new Set(ents.flatMap(e => e.fortalezas || []))].slice(0, 2);
    return { alumno: nombre, promedio: parseFloat(prom), entregas: ents.length, areasDesMejora: areas, fortalezas };
  }).sort((a, b) => a.promedio - b.promedio);

  const resumenTemas = Object.entries(porTema).map(([tema, ents]) => {
    const prom = (ents.reduce((s, e) => s + (e.notaFinal || 0), 0) / ents.length).toFixed(1);
    const aprobados = ents.filter(e => e.notaFinal >= 11).length;
    return {
      tema,
      promedio: parseFloat(prom),
      totalAlumnos: ents.length,
      aprobados,
      desaprobados: ents.length - aprobados,
      tasaAprobacion: Math.round((aprobados / ents.length) * 100),
    };
  }).sort((a, b) => a.promedio - b.promedio);

  const promedioGeneral = (evaluadas.reduce((s, e) => s + (e.notaFinal || 0), 0) / evaluadas.length).toFixed(1);

  const prompt = `Eres un experto en análisis pedagógico y estadística educativa universitaria.

Analiza los resultados del curso "${cursoNombre}" y genera un reporte completo para el docente ${docenteNombre}.

=== DATOS ESTADÍSTICOS ===
Promedio general: ${promedioGeneral}/20
Total evaluados: ${evaluadas.length}
Aprobados (≥11): ${evaluadas.filter(e => e.notaFinal >= 11).length}
Desaprobados (<11): ${evaluadas.filter(e => e.notaFinal < 11).length}

=== RENDIMIENTO POR TEMA ===
${JSON.stringify(resumenTemas, null, 2)}

=== RENDIMIENTO POR ALUMNO (ordenado de menor a mayor) ===
${JSON.stringify(resumenAlumnos, null, 2)}

Genera un reporte pedagógico completo. Responde ÚNICAMENTE en JSON (sin markdown):
{
  "resumenEjecutivo": "párrafo de 3-4 oraciones con diagnóstico general del grupo",

  "estadisticas": {
    "promedioGeneral": número,
    "tasaAprobacion": número (0-100),
    "distribucion": {
      "Excelente": número,
      "Bueno": número,
      "Regular": número,
      "Insuficiente": número
    }
  },

  "temasCriticos": [
    {
      "tema": "nombre del tema",
      "promedio": número,
      "tasaAprobacion": número,
      "diagnostico": "por qué este tema tiene bajo rendimiento",
      "estrategiasDocente": ["estrategia 1 para reforzar en clase", "estrategia 2"]
    }
  ],

  "temasDestacados": [
    {
      "tema": "nombre",
      "promedio": número,
      "observacion": "qué salió bien"
    }
  ],

  "reporteAlumnos": [
    {
      "alumno": "nombre",
      "promedio": número,
      "perfil": "Excelente|Bueno|Regular|En riesgo",
      "fortalezas": ["fortaleza principal"],
      "debilidades": ["área a mejorar"],
      "recomendacionPersonalizada": "consejo específico de 1-2 oraciones"
    }
  ],

  "recomendacionesDocente": [
    {
      "prioridad": "Alta|Media|Baja",
      "accion": "acción concreta que debe tomar el docente",
      "justificacion": "por qué es importante"
    }
  ],

  "planRefuerzo": {
    "temasReforzar": ["tema 1", "tema 2"],
    "metodologiasSugeridas": ["metodología 1", "metodología 2"],
    "alumnosEnRiesgo": ["nombre alumno 1", "nombre alumno 2"]
  }
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Eres un experto en análisis pedagógico universitario. Respondes en JSON válido sin markdown.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
      max_tokens: 3000,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(data.error?.message || 'Sin respuesta de OpenAI');
  return JSON.parse(content.replace(/```json|```/g, '').trim());
};

export const generarReporteClase = async (evaluaciones, cursoNombre) => {
  const resumen = evaluaciones
    .map((e) => `- ${e.alumnoNombre}: ${e.notaFinal}/20 (${e.nivelGlobal})`)
    .join('\n');

  const prompt = `Analiza los resultados del curso "${cursoNombre}":\n${resumen}\n\nResponde en JSON:\n{\n  "promedioClase": número,\n  "distribucion": { "Excelente": número, "Bueno": número, "Regular": número, "Insuficiente": número },\n  "analisisGeneral": "análisis de 2-3 oraciones",\n  "recomendacionesDocente": ["rec1", "rec2", "rec3"]\n}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
};