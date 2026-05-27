// api/deepseek-upload.js  ← coloca este archivo en la carpeta /api de tu proyecto
//
// Proxy para subir archivos PDF/DOCX a DeepSeek desde el servidor.
// Recibe el archivo como base64 en JSON (el navegador no puede enviar FormData
// a DeepSeek directamente por CORS).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { fileName, fileBase64, purpose = 'assistants' } = req.body;

  if (!fileName || !fileBase64) {
    return res.status(400).json({ error: 'Faltan campos: fileName o fileBase64' });
  }

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY no configurada en Vercel' });
  }

  try {
    // Reconstruir el archivo desde base64
    const buffer = Buffer.from(fileBase64, 'base64');
    const blob = new Blob([buffer]);

    const formData = new FormData();
    formData.append('file', blob, fileName);
    formData.append('purpose', purpose);

    const response = await fetch('https://api.deepseek.ai/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
      body: formData,
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
