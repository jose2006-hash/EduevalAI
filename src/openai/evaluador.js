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
  input,           // File object (PDF/DOCX) o string de texto
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

  // ─── Archivo: PDF o DOCX ──────────────────────────────────────────────────
  if (input instanceof File) {
    const isPdf = input.type === 'application/pdf' || input.name?.toLowerCase().endsWith('.pdf');
    const isDocx =
      input.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      input.name?.toLowerCase().endsWith('.docx');

    if (isPdf) {
      // ── PDF: subir a Files API y evaluar con gpt-4o ────────────────────
      const formData = new FormData();
      formData.append('file', input, input.name);
      formData.append('purpose', 'assistants');

      const uploadRes = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.id) throw new Error('No se pudo subir el PDF: ' + JSON.stringify(uploadData));
      const fileId = uploadData.id;

      let resultData;
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content:
                  'Eres un evaluador académico justo y detallado. Siempre respondes en JSON válido sin markdown ni bloques de código.',
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text:
                      promptBase +
                      '\n\nEl trabajo del alumno está en el archivo PDF adjunto. Léelo y evalúalo.',
                  },
                  {
                    type: 'file',
                    file: { file_id: fileId },
                  },
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
        // Siempre limpiar el archivo subido
        fetch(`https://api.openai.com/v1/files/${fileId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        }).catch(() => {});
      }

      const content = resultData.choices?.[0]?.message?.content;
      if (!content) throw new Error(resultData.error?.message || 'Sin respuesta de OpenAI');
      const clean = content.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);

    } else if (isDocx) {
      // ── DOCX: subir a Files API y evaluar con gpt-4o ──────────────────
      const formData = new FormData();
      formData.append('file', input, input.name);
      formData.append('purpose', 'assistants');

      const uploadRes = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.id) throw new Error('No se pudo subir el archivo Word: ' + JSON.stringify(uploadData));
      const fileId = uploadData.id;

      let resultData;
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content:
                  'Eres un evaluador académico justo y detallado. Siempre respondes en JSON válido sin markdown ni bloques de código.',
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text:
                      promptBase +
                      '\n\nEl trabajo del alumno está en el archivo Word (.docx) adjunto. Léelo y evalúalo.',
                  },
                  {
                    type: 'file',
                    file: { file_id: fileId },
                  },
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
      const clean = content.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);

    } else {
      throw new Error(`Tipo de archivo no soportado: ${input.type || input.name}`);
    }
  }

  // ─── Texto plano ───────────────────────────────────────────────────────────
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'Eres un evaluador académico justo y detallado. Siempre respondes en JSON válido sin markdown ni bloques de código.',
        },
        {
          role: 'user',
          content: promptBase + `\n\n=== TRABAJO DEL ALUMNO ===\n${input}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(data.error?.message || 'Sin respuesta de OpenAI');
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