import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { checkWithTurnitin } from './turnitinClient.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

app.post('/api/turnitin/check', async (req, res) => {
  const { entregaId, archivoUrl } = req.body;
  if (!entregaId || !archivoUrl) return res.status(400).json({ error: 'entregaId y archivoUrl requeridos' });
  try {
    const result = await checkWithTurnitin(archivoUrl, entregaId);
    return res.json(result);
  } catch (err) {
    console.error('Error en /api/turnitin/check:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
});

app.listen(PORT, () => {
  console.log(`EduEval server listening on http://localhost:${PORT}`);
});
