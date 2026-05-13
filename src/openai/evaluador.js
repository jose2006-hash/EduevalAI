// src/openai/evaluador.js

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export const evaluarTrabajo = async (
  trabajoTexto,
  rubrica,
  curso,
  tema,
  silaboTexto = '',
  enunciadoTexto = '',
  pdfImagenes = []   // base64[] — páginas del PDF como imágenes JPEG
) => {
  const criteriosTexto = rubrica.criterios.map((c, i) =>
    `${i + 1}. ${c.nombre} (peso: ${c.peso}%): ${c.descripcion}
   - Excelente (${c.puntajeMax}pts): ${c.niveles?.excelente || 'Cumple todos los requisitos'}
   - Bueno (${Math.round(c.puntajeMax * 0.75)}pts): ${c.niveles?.bueno || 'Cumple la mayoría'}
   - Regular (${Math.round(c.puntajeMax * 0.5)}pts): ${c.niveles?.regular || 'Cumple parcialmente'}
   - Insuficiente (${Math.round(c.puntajeMax * 0.25)}pts): ${c.niveles?.insuficiente || 'No cumple'}`
  ).join('\n\n');

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

  const usarVision = pdfImagenes.length > 0;

  const prompt = `Eres un evaluador académico experto en el curso de "${curso}".
Evalúa el trabajo sobre "${tema}" usando ESTRICTAMENTE la rúbrica proporcionada.
${instruccion}
${usarVision ? 'El trabajo del alumno se presenta como imágenes del PDF original. Analiza cada página visualmente.' : ''}

=== RÚBRICA DE EVALUACIÓN ===
${criteriosTexto}
Puntaje total máximo: ${rubrica.puntajeTotal || 20} puntos
${enunciadoSeccion}${silaboSeccion}
${!usarVision ? `=== TRABAJO DEL ALUMNO ===\n${trabajoTexto}` : ''}

Responde ÚNICAMENTE en JSON con esta estructura exacta:
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

  // Contenido del mensaje — vision si hay imágenes, texto si no
  let userContent;
  if (usarVision) {
    userContent = [
      { type: 'text', text: prompt },
      ...pdfImagenes.map(img => ({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${img}`,
          detail: 'high',
        },
      })),
    ];
  } else {
    userContent = prompt;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Eres un evaluador académico justo y detallado. Siempre respondes en JSON válido.',
        },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      // response_format solo funciona con contenido texto puro, no con vision
      ...(usarVision ? {} : { response_format: { type: 'json_object' } }),
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Error al conectar con OpenAI');
  }

  const data = await response.json();
  const raw = data.choices[0].message.content;

  // Extraer JSON aunque venga envuelto en ```json ... ```
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('La IA no devolvió JSON válido');
  return JSON.parse(jsonMatch[0]);
};

export const generarReporteClase = async (evaluaciones, cursoNombre) => {
  const resumen = evaluaciones.map(e =>
    `- ${e.alumnoNombre}: ${e.notaFinal}/20 (${e.nivelGlobal})`
  ).join('\n');

  const prompt = `Analiza los resultados del curso "${cursoNombre}":\n${resumen}\n\nResponde en JSON:\n{\n  "promedioClase": número,\n  "distribucion": { "Excelente": número, "Bueno": número, "Regular": número, "Insuficiente": número },\n  "analisisGeneral": "análisis de 2-3 oraciones",\n  "recomendacionesDocente": ["rec1", "rec2", "rec3"]\n}`;

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