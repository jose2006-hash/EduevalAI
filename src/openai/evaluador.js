// src/openai/evaluador.js
//
// Las llamadas a DeepSeek van a través de /api/deepseek (proxy Vercel).
// Los PDFs se convierten a imágenes en el navegador con pdf.js y se envían
// como vision al modelo deepseek-vl2. No se usa la Files API (no existe en DeepSeek).

import * as pdfjsLib from 'pdfjs-dist';
import { docxToText, esDocx } from '../utils/docxText.js';

// Worker de pdf.js (Vite resuelve la URL automáticamente)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

// Modelo para texto (DeepSeek). PDFs van a Gemini Flash vía /api/evaluar-pdf
const DEEPSEEK_MODEL = import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-chat';

// ─── Helper: llama al proxy Vercel ───────────────────────────────────────────
const deepseekJSON = async (path, body) => {
  const response = await fetch('/api/deepseek', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, body }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${text}`);
  }
  return response.json();
};

// ─── Helper: PDF → array de imágenes base64 ──────────────────────────────────
const pdfToImages = async (file, maxPages = 8) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = Math.min(pdf.numPages, maxPages);
  const images = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    // Escala 2.0 para que la letra sea legible
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    // JPEG 90% — buena calidad sin exceder el límite de tokens
    images.push(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
  }
  return images;
};

// ─── Helper: parsear respuesta JSON de la IA ─────────────────────────────────
const parseJsonRespuesta = (content) => {
  const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
  if (parsed.notaFinal == null && parsed.criterios?.length) {
    parsed.notaFinal = parsed.criterios.reduce((s, c) => s + (Number(c.puntajeObtenido) || 0), 0);
  }
  if (parsed.porcentaje == null && parsed.notaFinal != null) {
    parsed.porcentaje = Math.round((parsed.notaFinal / 20) * 100);
  }
  if (!parsed.nivelGlobal && parsed.notaFinal != null) {
    const n = parsed.notaFinal;
    parsed.nivelGlobal = n >= 17 ? 'Excelente' : n >= 14 ? 'Bueno' : n >= 11 ? 'Regular' : 'Insuficiente';
  }
  return parsed;
};

// ─── Helper: descargar archivo desde URL (reevaluación docente) ──────────────
export const archivoDesdeUrl = async (url, nombre = 'trabajo.pdf') => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudo descargar el archivo de la entrega');
  const blob = await response.blob();
  const ext = nombre.toLowerCase();
  const type = ext.endsWith('.docx')
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : ext.endsWith('.pdf')
    ? 'application/pdf'
    : blob.type || 'application/octet-stream';
  return new File([blob], nombre, { type });
};

// ─── EVALUACIÓN PRINCIPAL ────────────────────────────────────────────────────

export const evaluarTrabajo = async (
  input,
  rubrica,
  curso,
  tema,
  silaboTexto    = '',
  enunciadoTexto = ''
) => {
  const criteriosTexto = rubrica.criterios
    .map(
      (c, i) =>
        `${i + 1}. ${c.nombre} (peso: ${c.peso}%): ${c.descripcion}
   - Excelente (${c.puntajeMax}pts): ${c.niveles?.excelente   || 'Cumple todos los requisitos'}
   - Bueno     (${Math.round(c.puntajeMax * 0.75)}pts): ${c.niveles?.bueno       || 'Cumple la mayoría'}
   - Regular   (${Math.round(c.puntajeMax * 0.5 )}pts): ${c.niveles?.regular     || 'Cumple parcialmente'}
   - Insuf.    (${Math.round(c.puntajeMax * 0.25)}pts): ${c.niveles?.insuficiente || 'No cumple'}`
    )
    .join('\n\n');

  const silaboSeccion = silaboTexto
    ? `\n=== SÍLABO DEL CURSO ===\n${silaboTexto.substring(0, 2000)}\n`
    : '';

  const enunciadoSeccion = enunciadoTexto
    ? `\n=== ENUNCIADO DE LA ACTIVIDAD ===\n${enunciadoTexto.substring(0, 2000)}\n`
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

  // ── PDF → imágenes → vision ───────────────────────────────────────────────
  if (input instanceof File) {
    const isPdf  = input.type === 'application/pdf' || input.name?.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const images = await pdfToImages(input);
      if (images.length === 0) throw new Error('No se pudieron extraer páginas del PDF');

      // Usamos Gemini Flash (visión) vía nuestro proxy /api/evaluar-pdf
      const res = await fetch('/api/evaluar-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images,
          prompt:
            'Eres un evaluador académico justo y detallado. Siempre respondes en JSON válido sin markdown ni bloques de código.\n\n' +
            promptBase +
            `\n\nEl trabajo del alumno está en las ${images.length} imagen(es) adjuntas. Analiza TODAS las páginas.`,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al evaluar PDF con Gemini');

      return parseJsonRespuesta(result.content);
    }

    if (esDocx(input)) {
      const texto = await docxToText(input);
      return evaluarTrabajo(texto, rubrica, curso, tema, silaboTexto, enunciadoTexto);
    }

    throw new Error(`Tipo de archivo no soportado: ${input.type || input.name}. Usa PDF o Word (.docx).`);
  }

  // ── Texto plano ───────────────────────────────────────────────────────────
  const data = await deepseekJSON('/chat/completions', {
    model: DEEPSEEK_MODEL,
    messages: [
      {
        role: 'system',
        content: 'Eres un evaluador académico justo y detallado. Siempre respondes en JSON válido sin markdown.',
      },
      {
        role: 'user',
        content: promptBase + `\n\n=== TRABAJO DEL ALUMNO ===\n${input}`,
      },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
    max_tokens: 1400,
  });

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(data?.error?.message || 'Sin respuesta de DeepSeek');
  return parseJsonRespuesta(content);
};

// ─── DETECTOR DE IA ──────────────────────────────────────────────────────────

export const detectarIA = async (input) => {
  const prompt = `Eres un experto en detección de contenido generado por inteligencia artificial en trabajos académicos universitarios.

Analiza el texto proporcionado y determina qué porcentaje estimas fue generado por IA.

Busca indicadores como:
- Estructura excesivamente perfecta y simétrica
- Frases largas y formales sin errores tipográficos
- Conectores repetidos: "en primer lugar", "además", "en conclusión"
- Ausencia de voz personal o errores propios del alumno
- Párrafos con longitud uniforme y ritmo mecánico
- Explicaciones genéricas sin ejemplos concretos
- Terminología técnica superficial sin profundidad
- Ausencia de citas reales

Responde ÚNICAMENTE en JSON (sin markdown):
{
  "porcentajeIA": número entre 0 y 100,
  "nivel": "Bajo" | "Moderado" | "Alto" | "Muy alto",
  "indicadores": ["indicador 1", "indicador 2"],
  "veredicto": "frase corta de 5-10 palabras",
  "observacion": "párrafo de 2-3 oraciones en tono académico"
}

Niveles: Bajo 0-25%, Moderado 26-55%, Alto 56-80%, Muy alto 81-100%`;

  try {
    if (input instanceof File) {
      const isPdf = input.name?.toLowerCase().endsWith('.pdf') || input.type === 'application/pdf';
      if (isPdf) {
        const images = await pdfToImages(input, 4);
        const res = await fetch('/api/evaluar-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images,
            prompt: 'Eres un detector de contenido generado por IA. Respondes en JSON válido sin markdown.\n\n' +
              prompt + '\n\nAnaliza el texto escrito en las imágenes adjuntas.',
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Error en detección de IA');
        return parseJsonRespuesta(result.content);
      }

      if (esDocx(input)) {
        const texto = await docxToText(input);
        return detectarIA(texto);
      }
    }

    const textoAnalizar = typeof input === 'string' ? input : '';
    if (!textoAnalizar.trim()) {
      return {
        porcentajeIA: null,
        nivel: 'No disponible',
        indicadores: [],
        veredicto: 'Sin contenido analizable',
        observacion: 'No se pudo extraer texto del archivo para analizar.',
      };
    }

    const data = await deepseekJSON('/chat/completions', {
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Eres un detector de contenido generado por IA. Respondes en JSON válido.',
        },
        {
          role: 'user',
          content: prompt + `\n\n=== TEXTO A ANALIZAR ===\n${textoAnalizar.substring(0, 6000)}`,
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 700,
    });

    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Sin respuesta del detector de IA');
    return parseJsonRespuesta(content);
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

export const generarReporteEstadistico = async (entregas, cursoNombre, docenteNombre = '') => {
  if (!entregas || entregas.length === 0) throw new Error('No hay entregas para analizar');

  const evaluadas = entregas.filter(e => e.estado === 'evaluado');
  if (evaluadas.length === 0) throw new Error('No hay entregas evaluadas aún');

  const porAlumno = {};
  evaluadas.forEach(e => {
    if (!porAlumno[e.alumnoNombre]) porAlumno[e.alumnoNombre] = [];
    porAlumno[e.alumnoNombre].push(e);
  });

  const porTema = {};
  evaluadas.forEach(e => {
    const tema = e.actividadTitulo || e.titulo || 'Sin tema';
    if (!porTema[tema]) porTema[tema] = [];
    porTema[tema].push(e);
  });

  const resumenAlumnos = Object.entries(porAlumno)
    .map(([nombre, ents]) => {
      const prom = (ents.reduce((s, e) => s + (e.notaFinal || 0), 0) / ents.length).toFixed(1);
      return {
        alumno: nombre,
        promedio: parseFloat(prom),
        entregas: ents.length,
        areasDesMejora: [...new Set(ents.flatMap(e => e.areasDesMejora || []))].slice(0, 3),
        fortalezas:     [...new Set(ents.flatMap(e => e.fortalezas     || []))].slice(0, 2),
      };
    })
    .sort((a, b) => a.promedio - b.promedio);

  const resumenTemas = Object.entries(porTema)
    .map(([tema, ents]) => {
      const prom      = (ents.reduce((s, e) => s + (e.notaFinal || 0), 0) / ents.length).toFixed(1);
      const aprobados = ents.filter(e => e.notaFinal >= 11).length;
      return {
        tema,
        promedio: parseFloat(prom),
        totalAlumnos: ents.length,
        aprobados,
        desaprobados: ents.length - aprobados,
        tasaAprobacion: Math.round((aprobados / ents.length) * 100),
      };
    })
    .sort((a, b) => a.promedio - b.promedio);

  const promedioGeneral = (evaluadas.reduce((s, e) => s + (e.notaFinal || 0), 0) / evaluadas.length).toFixed(1);

  const prompt = `Eres un experto en análisis pedagógico y estadística educativa universitaria.
Analiza los resultados del curso "${cursoNombre}" para el docente ${docenteNombre}.

Promedio general: ${promedioGeneral}/20 | Total evaluados: ${evaluadas.length}
Aprobados (≥11): ${evaluadas.filter(e => e.notaFinal >= 11).length} | Desaprobados: ${evaluadas.filter(e => e.notaFinal < 11).length}

TEMAS: ${JSON.stringify(resumenTemas)}
ALUMNOS: ${JSON.stringify(resumenAlumnos)}

Responde ÚNICAMENTE en JSON (sin markdown):
{
  "resumenEjecutivo": "párrafo de 3-4 oraciones",
  "estadisticas": {
    "promedioGeneral": número, "tasaAprobacion": número,
    "distribucion": { "Excelente": número, "Bueno": número, "Regular": número, "Insuficiente": número }
  },
  "temasCriticos": [{ "tema": "", "promedio": 0, "tasaAprobacion": 0, "diagnostico": "", "estrategiasDocente": [] }],
  "temasDestacados": [{ "tema": "", "promedio": 0, "observacion": "" }],
  "reporteAlumnos": [{ "alumno": "", "promedio": 0, "perfil": "Excelente|Bueno|Regular|En riesgo", "fortalezas": [], "debilidades": [], "recomendacionPersonalizada": "" }],
  "recomendacionesDocente": [{ "prioridad": "Alta|Media|Baja", "accion": "", "justificacion": "" }],
  "planRefuerzo": { "temasReforzar": [], "metodologiasSugeridas": [], "alumnosEnRiesgo": [] }
}`;

  const data = await deepseekJSON('/chat/completions', {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: 'Experto en análisis pedagógico universitario. Respondes en JSON válido.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' },
    max_tokens: 2500,
  });

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(data?.error?.message || 'Sin respuesta de DeepSeek');
  return JSON.parse(content.replace(/```json|```/g, '').trim());
};

// ─── REPORTE DE CLASE (simple) ────────────────────────────────────────────────

export const generarReporteClase = async (evaluaciones, cursoNombre) => {
  const resumen = evaluaciones
    .map(e => `- ${e.alumnoNombre}: ${e.notaFinal}/20 (${e.nivelGlobal})`)
    .join('\n');

  const data = await deepseekJSON('/chat/completions', {
    model: DEEPSEEK_MODEL,
    messages: [
      {
        role: 'user',
        content: `Analiza los resultados del curso "${cursoNombre}":\n${resumen}\n\nResponde en JSON:\n{\n  "promedioClase": número,\n  "distribucion": { "Excelente": número, "Bueno": número, "Regular": número, "Insuficiente": número },\n  "analisisGeneral": "análisis de 2-3 oraciones",\n  "recomendacionesDocente": ["rec1", "rec2", "rec3"]\n}`,
      },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
    max_tokens: 700,
  });

  return JSON.parse(data.choices[0].message.content);
};