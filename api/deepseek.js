// api/deepseek.js  ← carpeta /api en la raíz de tu proyecto

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { path, body, method = 'POST' } = req.body;

  if (!path) return res.status(400).json({ error: 'Falta el campo "path"' });

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY no configurada en Vercel' });
  }

  // ✅ URL correcta: api.deepseek.com (no api.deepseek.ai)
  const url = `https://api.deepseek.com/v1${path}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(method !== 'DELETE' && { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (response.status === 204) return res.status(204).end();

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}