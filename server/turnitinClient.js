import fetch from 'node-fetch';

// Cliente Turnitin placeholder.
// Si configuras las variables de entorno apropiadas, aquí podrás implementar
// la llamada real a la API de Turnitin (OAuth, subida del archivo, petición de informe).

export const checkWithTurnitin = async (archivoUrl, entregaId) => {
  // Si detectamos variables de entorno (PLACEHOLDER), podríamos integrar.
  const TURNITIN_ENABLED = false; // Cambia a true cuando implementes la lógica real

  if (TURNITIN_ENABLED) {
    // TODO: implementar OAuth y llamadas reales a Turnitin aquí.
    // 1) Obtener access token con client credentials
    // 2) Subir documento o pasar URL según API
    // 3) Solicitar similarity report
    // 4) Esperar a que esté listo y devolver porcentaje y texto
    return { iaScore: 0, iaObservacion: 'Implementación Turnitin pendiente' };
  }

  // Mock: generar puntuación entre 20-80
  const iaScore = Math.round(Math.random() * 60) + 20;
  const iaObservacion = `Turnitin mock: ${iaScore}% probable contenido generado por IA / similaridades.`;

  // Simular latencia
  await new Promise(r => setTimeout(r, 800));

  return { iaScore, iaObservacion };
};
