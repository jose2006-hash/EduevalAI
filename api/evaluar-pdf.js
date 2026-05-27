// api/evaluar-pdf.js
//
// Usa OpenRouter con Llama 4 Scout (gratis, soporta visión) para evaluar PDFs.
// Sin tarjeta de crédito. Registro gratis en openrouter.ai
//
// Requiere en Vercel: OPENROUTER_API_KEY = sk-or-...

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY no configurada en Vercel' });
  }

  const { images, prompt } = req.body;
  if (!images?.length || !prompt) {
    return res.status(400).json({ error: 'Faltan campos: images o prompt' });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://edueval-ai.vercel.app',
        'X-Title': 'EduEval AI',
      },
      body: JSON.stringify({
        // Gemini 2.0 Flash: ~$0.10 por 1000 páginas, excelente con visión
        model: 'google/gemini-2.0-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...images.map(imgBase64 => ({
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imgBase64}` },
              })),
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'Error de OpenRouter',
      });
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) return res.status(500).json({ error: 'Sin respuesta del modelo' });

    return res.status(200).json({ content });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}