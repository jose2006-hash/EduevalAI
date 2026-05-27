// api/deepseek.js  ← coloca este archivo en la carpeta /api de tu proyecto
//
// Proxy serverless para DeepSeek.
// El navegador NO puede llamar a DeepSeek directamente (CORS).
// Este endpoint corre en el servidor de Vercel, donde no hay restricción.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { path, body, method = 'POST' } = req.body;

  if (!path) {
    return res.status(400).json({ error: 'Falta el campo "path"' });
  }

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY; // ← sin VITE_
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY no configurada en Vercel' });
  }

  try {
    const response = await fetch(`https://api.deepseek.ai/v1${path}`, {
      method,
      headers: {
        ...(method !== 'DELETE' && { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    // DELETE suele responder 204 sin cuerpo
    if (response.status === 204) {
      return res.status(204).end();
    }

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
