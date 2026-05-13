// src/openai/evaluador.js

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Convierte un File a base64
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const evaluarTrabajo = async (
  input,          // File (PDF/Word) o string de texto
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

  const jsonSchema = `{
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

  let messages;

  if (input instanceof File) {
    // ── Evaluar directamente el archivo (PDF) via base64 ─────────────────
    const base64Data = await fileToBase64(input);
    const mediaType = input.type || 'application/pdf';

    const prompt = `Eres un evaluador académico experto en el curso de "${curso}".
Evalúa el trabajo sobre "${tema}" usando ESTRICTAMENTE la rúbrica proporcionada.
${instruccion}

Lee el documento adjunto (archivo del alumno) y evalúalo según esta rúbrica:

=== RÚBRICA DE EVALUACIÓN ===
${criteriosTexto}
Puntaje total máximo: ${rubrica.puntajeTotal || 20} puntos
${enunciadoSeccion}${silaboSeccion}

Responde ÚNICAMENTE en JSON con esta estructura exacta (sin texto adicional, sin markdown):
${jsonSchema}`;

    messages = [
      {
        role: 'system',
        content:
          'Eres un evaluador académico justo y detallado. Siempre respondes ÚNICAMENTE en JSON válido, sin ningún texto adicional ni backticks.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mediaType};base64,${base64Data}`,
              detail: 'high',
            },
          },
        ],
      },
    ];
  } else {
    // ── Evaluar texto plano ───────────────────────────────────────────────
    const prompt = `Eres un evaluador académico experto en el curso de "${curso}".
Evalúa el trabajo sobre "${tema}" usando ESTRICTAMENTE la rúbrica proporcionada.
${instruccion}

=== RÚBRICA DE EVALUACIÓN ===
${criteriosTexto}
Puntaje total máximo: ${rubrica.puntajeTotal || 20} puntos
${enunciadoSeccion}${silaboSeccion}
=== TRABAJO DEL ALUMNO ===
${input}

Responde ÚNICAMENTE en JSON con esta estructura exacta (sin texto adicional, sin markdown):
${jsonSchema}`;

    messages = [
      {
        role: 'system',
        content:
          'Eres un evaluador académico justo y detallado. Siempre respondes ÚNICAMENTE en JSON válido, sin ningún texto adicional ni backticks.',
      },
      { role: 'user', content: prompt },
    ];
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `OpenAI error ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const clean = content.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

export const generarReporteClase = async (evaluaciones, cursoNombre) => {
  const resumen = evaluaciones
    .map((e) => `- ${e.alumnoNombre}: ${e.notaFinal}/20 (${e.nivelGlobal})`)
    .join('\n');

  const prompt = `Analiza los resultados del curso "${cursoNombre}":\n${resumen}\n\nResponde en JSON:\n{\n  "promedioClase": número,\n  "distribucion": { "Excelente": número, "Bueno": número, "Regular": número, "Insuficiente": número },\n  "analisisGeneral": "análisis de 2-3 oraciones",\n  "recomendacionesDocente": ["rec1", "rec2", "rec3"]\n}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
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