// src/openai/evaluador.js
// ── Usando Google Gemini en vez de OpenAI ──────────────────────────────────
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const callGemini = async (prompt) => {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Error al conectar con Gemini');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(text);
};

export const evaluarTrabajo = async (
  trabajoTexto,
  rubrica,
  curso,
  tema,
  silaboTexto = '',
  enunciadoTexto = ''
) => {
  const criteriosTexto = rubrica.criterios.map((c, i) =>
    `${i + 1}. ${c.nombre} (peso: ${c.peso}%): ${c.descripcion}
   - Excelente (${c.puntajeMax}pts): ${c.niveles?.excelente || 'Cumple todos los requisitos'}
   - Bueno (${Math.round(c.puntajeMax * 0.75)}pts): ${c.niveles?.bueno || 'Cumple la mayoría'}
   - Regular (${Math.round(c.puntajeMax * 0.5)}pts): ${c.niveles?.regular || 'Cumple parcialmente'}
   - Insuficiente (${Math.round(c.puntajeMax * 0.25)}pts): ${c.niveles?.insuficiente || 'No cumple'}`
  ).join('\n\n');

  const silaboSeccion = silaboTexto
    ? `\n=== SÍLABO DEL CURSO ===\n${silaboTexto.substring(0, 3000)}\n`
    : '';

  const enunciadoSeccion = enunciadoTexto
    ? `\n=== ENUNCIADO DE LA ACTIVIDAD ===\n${enunciadoTexto.substring(0, 3000)}\n`
    : '';

  const instruccion = enunciadoTexto.trim()
    ? 'Evalúa si el trabajo responde correctamente al enunciado. Penaliza si el alumno no abordó lo solicitado.'
    : silaboTexto.trim()
      ? 'Verifica que el trabajo se alinee con los contenidos del sílabo.'
      : '';

  const prompt = `Eres un evaluador académico experto en el curso de "${curso}".
Evalúa el trabajo sobre "${tema}" usando ESTRICTAMENTE la rúbrica proporcionada.
${instruccion}

=== RÚBRICA ===
${criteriosTexto}
Puntaje total máximo: ${rubrica.puntajeTotal || 20} puntos
${enunciadoSeccion}${silaboSeccion}
=== TRABAJO DEL ALUMNO ===
${trabajoTexto}

Responde ÚNICAMENTE en JSON con esta estructura exacta (sin texto extra, sin markdown):
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
  "recomendaciones": ["recomendación 1", "recomendación 2", "recomendación 3"]
}`;

  return await callGemini(prompt);
};

export const generarReporteClase = async (evaluaciones, cursoNombre) => {
  const resumen = evaluaciones.map(e =>
    `- ${e.alumnoNombre}: ${e.notaFinal}/20 (${e.nivelGlobal})`
  ).join('\n');

  const prompt = `Analiza los resultados del curso "${cursoNombre}":\n${resumen}\n\nResponde en JSON (sin texto extra):\n{\n  "promedioClase": número,\n  "distribucion": { "Excelente": número, "Bueno": número, "Regular": número, "Insuficiente": número },\n  "analisisGeneral": "análisis de 2-3 oraciones",\n  "recomendacionesDocente": ["rec1", "rec2", "rec3"]\n}`;

  return await callGemini(prompt);
};