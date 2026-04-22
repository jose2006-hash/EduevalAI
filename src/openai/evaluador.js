// src/openai/evaluador.js

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

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
    ? `\n=== SÍLABO DEL CURSO (contenidos y metodología del curso) ===\n${silaboTexto.substring(0, 3000)}\n`
    : '';

  const enunciadoSeccion = enunciadoTexto
    ? `\n=== ENUNCIADO DE LA ACTIVIDAD (lo que el docente solicitó específicamente) ===\n${enunciadoTexto.substring(0, 3000)}\n`
    : '';

  const tieneEnunciado = enunciadoTexto.trim().length > 0;
  const tieneSilabo = silaboTexto.trim().length > 0;

  const instruccionContexto = tieneEnunciado
    ? 'Evalúa si el trabajo responde correctamente al enunciado de la actividad. Penaliza si el alumno no abordó lo que se pidió específicamente.'
    : tieneSilabo
      ? 'Considera el sílabo para verificar si el trabajo se alinea con los contenidos del curso.'
      : '';

  const prompt = `Eres un evaluador académico experto en el curso de "${curso}".
Evalúa el trabajo sobre "${tema}" usando ESTRICTAMENTE la rúbrica proporcionada.
${instruccionContexto}

=== RÚBRICA DE EVALUACIÓN ===
${criteriosTexto}
Puntaje total máximo: ${rubrica.puntajeTotal || 20} puntos
${enunciadoSeccion}${silaboSeccion}
=== TRABAJO DEL ALUMNO ===
${trabajoTexto}

=== INSTRUCCIONES ===
Evalúa criterio por criterio. Si existe enunciado, verifica que el alumno lo haya respondido correctamente.
Responde ÚNICAMENTE en formato JSON con esta estructura exacta:

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
  return JSON.parse(data.choices[0].message.content);
};

export const generarReporteClase = async (evaluaciones, cursoNombre) => {
  const resumen = evaluaciones.map(e =>
    `- ${e.alumnoNombre}: ${e.notaFinal}/20 (${e.nivelGlobal})`
  ).join('\n');

  const prompt = `Analiza los resultados del curso ${cursoNombre}:\n${resumen}\n\nResponde en JSON:\n{\n  "promedioClase": número,\n  "distribucion": { "Excelente": número, "Bueno": número, "Regular": número, "Insuficiente": número },\n  "analisisGeneral": "análisis de 2-3 oraciones",\n  "recomendacionesDocente": ["rec1", "rec2", "rec3"]\n}`;

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