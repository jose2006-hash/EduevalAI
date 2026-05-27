// api/evaluar-pdf.js
//
// Usa Google Gemini Flash para evaluar PDFs con imágenes/escritura a mano.
// Mucho más barato que Claude. Tier gratuito: 15 req/min.
//
// Requiere en Vercel: GEMINI_API_KEY = AIza...
// Obtener gratis en: https://aistudio.google.com

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en Vercel' });
  }

  const { images, prompt } = req.body;
  if (!images?.length || !prompt) {
    return res.status(400).json({ error: 'Faltan campos: images o prompt' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              // Adjuntar cada página del PDF como imagen
              ...images.map(imgBase64 => ({
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: imgBase64,
                },
              })),
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1500,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'Error de Gemini',
      });
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return res.status(500).json({ error: 'Sin respuesta de Gemini' });

    return res.status(200).json({ content });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}