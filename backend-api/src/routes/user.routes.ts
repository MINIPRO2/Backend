import { Router, Request, Response } from 'express';
import {
  AuthenticatedRequest,
  verifyAuthToken,
  createBackendSessionToken,
} from '../middlewares/auth.middleware';
import {
  UserService,
  ValidationError,
  UsernameConflictError,
  EmailConflictError,
  InvalidCredentialsError,
} from '../services/user.service';

const router = Router();
const userService = new UserService();

function handleControllerError(err: unknown, res: Response) {
  if (err instanceof ValidationError) {
    return res.status(400).json({
      ok: false,
      field: err.field,
      error: err.message,
    });
  }

  if (err instanceof UsernameConflictError) {
    return res.status(400).json({
      ok: false,
      field: err.field,
      error: err.message,
    });
  }

  if (err instanceof EmailConflictError) {
    return res.status(400).json({
      ok: false,
      field: err.field,
      error: err.message,
    });
  }

  if (err instanceof InvalidCredentialsError) {
    return res.status(401).json({
      ok: false,
      error: err.message,
    });
  }

  return res.status(500).json({
    ok: false,
    error:
      'Ocurrió un inconveniente en el servidor al procesar tu solicitud. Inténtalo de nuevo en unos segundos.',
  });
}

/**
 * GET /api/users/check-username?username=...
 * Verifica en el servidor si un nombre de usuario tiene formato válido y está disponible en Firestore.
 */
router.get('/check-username', async (req: Request, res: Response) => {
  try {
    const rawUsername = req.query.username;
    const excludeUid =
      typeof req.query.excludeUid === 'string'
        ? req.query.excludeUid
        : undefined;
    const result = await userService.checkUsernameAvailability(
      rawUsername,
      excludeUid
    );
    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (err) {
    return handleControllerError(err, res);
  }
});

/**
 * POST /api/users/auth/register
 * Registro manual respaldado por Firebase Admin SDK + Firestore (US-01).
 */
router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const profile = await userService.registerManualViaBackendAuth(
      req.body || {}
    );
    const token = createBackendSessionToken({
      uid: profile.uid,
      email: profile.email,
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      provider: 'password',
    });

    return res.status(201).json({
      ok: true,
      message: 'Cuenta creada exitosamente.',
      token,
      requiresUsername: false,
      data: profile,
    });
  } catch (err) {
    return handleControllerError(err, res);
  }
});

/**
 * POST /api/users/auth/login
 * Inicio de sesión manual verificando credenciales contra Firestore (US-03).
 */
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const profile = await userService.loginManualViaBackendAuth(req.body || {});
    const token = createBackendSessionToken({
      uid: profile.uid,
      email: profile.email,
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      provider: profile.provider,
    });

    return res.status(200).json({
      ok: true,
      token,
      requiresUsername: profile.requiresUsername,
      data: profile,
    });
  } catch (err) {
    return handleControllerError(err, res);
  }
});

/**
 * POST /api/users/auth/google
 * Acceso con Google sincronizando perfil en Firestore y obligando a elegir username si es nuevo (US-02).
 */
router.post('/auth/google', async (req: Request, res: Response) => {
  try {
    const profile = await userService.syncGoogleViaBackendAuth(req.body || {});
    const token = createBackendSessionToken({
      uid: profile.uid,
      email: profile.email,
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      provider: 'google',
    });

    return res.status(200).json({
      ok: true,
      token,
      requiresUsername: profile.requiresUsername,
      data: profile,
    });
  } catch (err) {
    return handleControllerError(err, res);
  }
});

/**
 * GET /api/users/me
 * Ruta privada: Obtiene el perfil del usuario autenticado desde Firestore.
 */
router.get(
  '/me',
  verifyAuthToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const profile = await userService.getMyProfile(uid);

      if (!profile) {
        return res.status(404).json({
          ok: false,
          requiresRegistration: true,
          error: 'Aún no hemos completado tu perfil en StudyRoom.',
        });
      }

      return res.status(200).json({
        ok: true,
        requiresUsername: profile.requiresUsername,
        data: profile,
      });
    } catch (err) {
      return handleControllerError(err, res);
    }
  }
);

/**
 * POST /api/users/register
 * Ruta privada (US-01): Registra el perfil manual completo en Firestore validando unicidad de username en servidor.
 */
router.post(
  '/register',
  verifyAuthToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const profile = await userService.registerManualUser({
        uid: req.user!.uid,
        emailFromToken: req.user!.email,
        body: req.body || {},
      });

      return res.status(201).json({
        ok: true,
        message: 'Cuenta creada exitosamente.',
        data: profile,
      });
    } catch (err) {
      return handleControllerError(err, res);
    }
  }
);

/**
 * POST /api/users/google-sync
 * Ruta privada (US-02): Sincroniza el usuario que ingresa con Google y determina si debe elegir username obligatorio.
 */
router.post(
  '/google-sync',
  verifyAuthToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const profile = await userService.syncGoogleUser({
        uid: req.user!.uid,
        emailFromToken: req.user!.email,
        nameFromToken: req.user!.name,
        pictureFromToken: req.user!.picture,
        body: req.body || {},
      });

      return res.status(200).json({
        ok: true,
        requiresUsername: profile.requiresUsername,
        data: profile,
      });
    } catch (err) {
      return handleControllerError(err, res);
    }
  }
);

/**
 * PUT /api/users/username
 * Ruta privada (US-02): Asigna o actualiza el nombre de usuario único obligatorio en el servidor.
 */
router.put(
  '/username',
  verifyAuthToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const profile = await userService.setUsername({
        uid: req.user!.uid,
        emailFromToken: req.user!.email,
        nameFromToken: req.user!.name,
        pictureFromToken: req.user!.picture,
        rawUsername: req.body?.username,
        avatar: req.body?.avatar,
      });

      return res.status(200).json({
        ok: true,
        message: 'Nombre de usuario guardado correctamente.',
        data: profile,
      });
    } catch (err) {
      return handleControllerError(err, res);
    }
  }
);

export default router;
