import { Router, Request, Response } from 'express';
import { Sprint0Service } from '../services/sprint0.service';

const router = Router();
const sprint0Service = new Sprint0Service();

/**
 * Capa de Rutas (Routes):
 * Recibe la petición HTTP, invoca la capa de lógica (Service) y maneja errores con mensajes claros.
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const result = await sprint0Service.obtenerEstadoBaseTecnica();
    return res.status(200).json(result);
  } catch (err) {
    const errMsg =
      err instanceof Error
        ? err.message
        : 'Error inesperado al consultar Cloud Firestore.';
    return res.status(500).json({
      ok: false,
      error: `Error al consultar Cloud Firestore: ${errMsg}`,
    });
  }
});

export default router;
