import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let firestoreInstance: admin.firestore.Firestore | null = null;
let initializationError: string | null = null;

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

      if (serviceAccountJson && serviceAccountJson.trim().startsWith('{')) {
        const parsed = JSON.parse(serviceAccountJson);
        if (parsed.private_key) {
          parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        admin.initializeApp({
          credential: admin.credential.cert(parsed),
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
          'Credenciales de Firebase Admin no configuradas. Define FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en las variables de entorno del backend-api.';
        return { db: null, error: initializationError };
      }
    }

    firestoreInstance = admin.firestore();
    initializationError = null;
    return { db: firestoreInstance, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error desconocido al inicializar Firebase Admin';
    initializationError = `Error al inicializar Firebase Admin SDK: ${message}`;
    return { db: null, error: initializationError };
  }
}
