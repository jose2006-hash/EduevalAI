// src/openai/evaluador.js

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

/**
 * Evalúa un trabajo académico contra una rúbrica usando GPT-4o.
 * @param {string} trabajoTexto - Texto del trabajo del alumno
 * @param {object} rubrica - Objeto con criterios y pesos
 * @param {string} curso - Nombre del curso
 * @param {string} tema - Tema evaluado
 * @returns {object} Resultado con notas por criterio, nota final y retroalimentación
 */
export const evaluarTrabajo = async (trabajoTexto, rubrica, curso, tema) => {
  const criteriosTexto = rubrica.criterios.map((c, i) =>
    `${i + 1}. ${c.nombre} (peso: ${c.peso}%): ${c.descripcion}
   - Excelente (${c.puntajeMax}pts): ${c.niveles?.excelente || 'Cumple todos los requisitos'}
   - Bueno (${Math.round(c.puntajeMax * 0.75)}pts): ${c.niveles?.bueno || 'Cumple la mayoría'}
   - Regular (${Math.round(c.puntajeMax * 0.5)}pts): ${c.niveles?.regular || 'Cumple parcialmente'}
   - Insuficiente (${Math.round(c.puntajeMax * 0.25)}pts): ${c.niveles?.insuficiente || 'No cumple'}`
  ).join('\n\n');

  const prompt = `Eres un evaluador académico experto en el curso de ${curso}.
Debes evaluar el siguiente trabajo sobre "${tema}" usando ESTRICTAMENTE la rúbrica proporcionada.

=== RÚBRICA ===
${criteriosTexto}
Puntaje total máximo: ${rubrica.puntajeTotal || 20} puntos

=== TRABAJO DEL ALUMNO ===
${trabajoTexto}

=== INSTRUCCIONES ===
Evalúa el trabajo criterio por criterio. Responde ÚNICAMENTE en formato JSON con esta estructura exacta:

{
  "criterios": [
    {
      "nombre": "nombre del criterio",
      "puntajeObtenido": número,
      "puntajeMaximo": número,
      "nivel": "Excelente|Bueno|Regular|Insuficiente",
      "comentario": "comentario específico de 1-2 oraciones"
    }
  ],
  "notaFinal": número entre 0 y 20,
  "porcentaje": número entre 0 y 100,
  "nivelGlobal": "Excelente|Bueno|Regular|Insuficiente",
  "fortalezas": ["fortaleza 1", "fortaleza 2"],
  "areasDesMejora": ["área 1", "área 2"],
  "retroalimentacionGeneral": "párrafo de retroalimentación constructiva de 3-4 oraciones",
  "recomendaciones": ["recomendación 1", "recomendación 2", "recomendación 3"]
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Eres un evaluador académico justo y detallado. Siempre respondes en JSON válido.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Error al conectar con OpenAI');
  }

  const data = await response.json();
  const resultado = JSON.parse(data.choices[0].message.content);
  return resultado;
};

/**
 * Genera un reporte consolidado de toda la clase
 */
export const generarReporteClase = async (evaluaciones, cursoNombre) => {
  const resumen = evaluaciones.map(e =>
    `- ${e.alumnoNombre}: ${e.notaFinal}/20 (${e.nivelGlobal})`
  ).join('\n');

  const prompt = `Analiza los siguientes resultados de evaluación del curso ${cursoNombre}:
${resumen}

Genera un análisis del grupo respondiendo en JSON:
{
  "promedioClase": número,
  "distribucion": { "Excelente": número, "Bueno": número, "Regular": número, "Insuficiente": número },
  "analisisGeneral": "análisis de 2-3 oraciones",
  "recomendacionesDocente": ["rec1", "rec2", "rec3"]
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
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
