import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let firestoreInstance: admin.firestore.Firestore | null = null;
let initializationError: string | null = null;

function parseServiceAccountFromEnv(raw: string): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
      };
    }
  } catch {
    // Fallback tolerante si Render convierte \n en saltos de línea reales dentro del JSON
    const pidMatch = raw.match(/"project_id"\s*:\s*"([^"]+)"/);
    const emailMatch = raw.match(/"client_email"\s*:\s*"([^"]+)"/);
    const keyMatch = raw.match(
      /-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/
    );

    if (pidMatch && emailMatch && keyMatch) {
      return {
        projectId: pidMatch[1].trim(),
        clientEmail: emailMatch[1].trim(),
        privateKey: keyMatch[0].replace(/\\n/g, '\n') + '\n',
      };
    }
  }
  return null;
}

export function initFirebase(): {
  db: admin.firestore.Firestore | null;
  error: string | null;
} {
  if (firestoreInstance) {
    return { db: firestoreInstance, error: null };
  }

  try {
    if (admin.apps.length === 0) {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

      const extracted = serviceAccountJson
        ? parseServiceAccountFromEnv(serviceAccountJson)
        : null;

      if (extracted) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: extracted.projectId,
            clientEmail: extracted.clientEmail,
            privateKey: extracted.privateKey,
          }),
        });
      } else if (
        projectId &&
        clientEmail &&
        rawPrivateKey &&
        projectId !== 'tu-proyecto-firebase-id'
      ) {
        const privateKey = rawPrivateKey
          .replace(/^"|"$/g, '')
          .replace(/\\n/g, '\n');

        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      } else {
        initializationError =
          'Credenciales de Firebase Admin no configuradas. Define FIREBASE_SERVICE_ACCOUNT_JSON en las variables de entorno del backend-api.';
        return { db: null, error: initializationError };
      }
    }

    firestoreInstance = admin.firestore();
    initializationError = null;
    return { db: firestoreInstance, error: null };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Error desconocido al inicializar Firebase Admin';
    initializationError = `Error al inicializar Firebase Admin SDK: ${message}`;
    return { db: null, error: initializationError };
  }
}
