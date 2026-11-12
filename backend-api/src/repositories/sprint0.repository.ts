import { initFirebase } from '../config/firebase';

export interface Sprint0StatusRecord {
  id: string;
  appName: string;
  sprint: string;
  message: string;
  accessibilityTarget: string;
  activeRoomsCount: number;
  updatedAt: string;
}

const COLLECTION_NAME = 'system_status';
const DOCUMENT_ID = 'sprint0';

/**
 * Capa de Acceso a Datos (Repository):
 * Encapsula todas las lecturas y escrituras hacia Cloud Firestore.
 */
export class Sprint0Repository {
  async getOrCreateStatusDocument(): Promise<{
    source: string;
    record: Sprint0StatusRecord;
  }> {
    const { db, error } = initFirebase();

    if (!db || error) {
      throw new Error(
        error ||
          'No fue posible conectar con Cloud Firestore. Verifica las credenciales en las variables de entorno del servidor.'
      );
    }

    const docRef = db.collection(COLLECTION_NAME).doc(DOCUMENT_ID);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      const initialData: Omit<Sprint0StatusRecord, 'id'> = {
        appName: 'StudyRoom - Salón de Estudio Colaborativo',
        sprint: 'Conexión Cloud Firestore',
        message:
          'Conexión activa: Este dato proviene en tiempo real de Cloud Firestore a través de la API.',
        accessibilityTarget: 'WCAG 2.2 Nivel AA',
        activeRoomsCount: 3,
        updatedAt: new Date().toISOString(),
      };

      await docRef.set(initialData);

      return {
        source: `Cloud Firestore (${COLLECTION_NAME}/${DOCUMENT_ID})`,
        record: {
          id: DOCUMENT_ID,
          ...initialData,
        },
      };
    }

    const docData = snapshot.data() || {};

    return {
      source: `Cloud Firestore (${COLLECTION_NAME}/${DOCUMENT_ID})`,
      record: {
        id: snapshot.id,
        appName:
          docData.appName ?? 'StudyRoom - Salón de Estudio Colaborativo',
        sprint:
          docData.sprint ??
          'Sprint 0: Fundamentación UX y Base Técnica End-to-End',
        message:
          docData.message ??
          'Dato leído en tiempo real desde Cloud Firestore a través de la API.',
        accessibilityTarget:
          docData.accessibilityTarget ?? 'WCAG 2.2 Nivel AA',
        activeRoomsCount:
          typeof docData.activeRoomsCount === 'number'
            ? docData.activeRoomsCount
            : 1,
        updatedAt: docData.updatedAt ?? new Date().toISOString(),
      },
    };
  }
}
