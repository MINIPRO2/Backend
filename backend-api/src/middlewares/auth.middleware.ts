import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { initFirebase } from '../config/firebase';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  provider?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'studyroom-sprint1-firebase-session-secret';

export function createBackendSessionToken(payload: AuthenticatedUser): string {
  const data = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 días
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
  return `sr1.${data}.${signature}`;
}

function verifyBackendSessionToken(token: string): AuthenticatedUser | null {
  if (!token.startsWith('sr1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, data, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
  if (signature !== expectedSig) return null;

  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!parsed.uid || (parsed.exp && Date.now() > parsed.exp)) {
      return null;
    }
    return {
      uid: parsed.uid,
      email: parsed.email || '',
      name: parsed.name,
      picture: parsed.picture,
      provider: parsed.provider || 'password',
    };
  } catch {
    return null;
  }
}

/**
 * Middleware TS-01:
 * Verifica el ID Token de Firebase en cada petición privada (Authorization: Bearer <token>).
 * Si no hay token o es inválido/expirado, responde estrictamente con código 401 (No autorizado).
 */
export async function verifyAuthToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false,
      error: 'No autorizado. Debes iniciar sesión para acceder a este recurso.',
    });
  }

  const idToken = authHeader.slice('Bearer '.length).trim();

  if (!idToken) {
    return res.status(401).json({
      ok: false,
      error: 'No autorizado. El token de sesión está vacío.',
    });
  }

  // 1. Verifica si es un token firmado por el backend (respaldo cuando el cliente autentica vía API)
  const backendSession = verifyBackendSessionToken(idToken);
  if (backendSession) {
    req.user = backendSession;
    return next();
  }

  // 2. Verifica el ID Token directamente con Firebase Admin SDK
  const { auth, error } = initFirebase();

  if (!auth || error) {
    return res.status(500).json({
      ok: false,
      error:
        error ||
        'No fue posible verificar la sesión porque Firebase Admin no está configurado en el servidor.',
    });
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      name: decoded.name,
      picture: decoded.picture,
      provider: decoded.firebase?.sign_in_provider || 'password',
    };
    return next();
  } catch {
    return res.status(401).json({
      ok: false,
      error:
        'No autorizado. Tu sesión expiró o no es válida. Por favor, inicia sesión de nuevo.',
    });
  }
}
