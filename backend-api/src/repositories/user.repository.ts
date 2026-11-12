import crypto from 'crypto';
import { initFirebase } from '../config/firebase';

export interface UserProfileRecord {
  uid: string;
  firstName: string;
  lastName: string;
  username: string | null;
  usernameLower: string | null;
  email: string;
  avatar: string;
  provider: 'password' | 'google';
  requiresUsername: boolean;
  createdAt: string;
  updatedAt: string;
}

export class UsernameConflictError extends Error {
  public readonly field = 'username';
  constructor(
    message = 'Este nombre de usuario ya está ocupado. Elige otro diferente.'
  ) {
    super(message);
    this.name = 'UsernameConflictError';
  }
}

export class EmailConflictError extends Error {
  public readonly field = 'email';
  constructor(
    message = 'Este correo ya está registrado. Inicia sesión o usa otro correo.'
  ) {
    super(message);
    this.name = 'EmailConflictError';
  }
}

const USERS_COLLECTION = 'users';
const USERNAMES_COLLECTION = 'usernames';

export function hashPassword(password: string): string {
  return crypto
    .createHash('sha256')
    .update(`studyroom_salt_${password}`)
    .digest('hex');
}

/**
 * Capa de Acceso a Datos (Repository) - TS-01:
 * Gestiona los perfiles de usuario en Cloud Firestore y garantiza la unicidad
 * del nombre de usuario y correo en el servidor mediante transacciones atómicas.
 */
export class UserRepository {
  private getFirestore() {
    const { db, error } = initFirebase();
    if (!db || error) {
      throw new Error(
        error ||
          'No fue posible conectar con Cloud Firestore. Verifica las credenciales en el servidor.'
      );
    }
    return db;
  }

  async findByUid(uid: string): Promise<UserProfileRecord | null> {
    const db = this.getFirestore();
    const docSnap = await db.collection(USERS_COLLECTION).doc(uid).get();
    if (!docSnap.exists) {
      return null;
    }
    const data = docSnap.data() || {};
    return this.mapDocToProfile(uid, data);
  }

  async findByEmailWithCredentials(email: string): Promise<{
    profile: UserProfileRecord;
    passwordHash?: string;
  } | null> {
    const db = this.getFirestore();
    const normalizedEmail = email.trim().toLowerCase();
    const snap = await db
      .collection(USERS_COLLECTION)
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();

    if (snap.empty) {
      return null;
    }

    const doc = snap.docs[0];
    const data = doc.data() || {};
    return {
      profile: this.mapDocToProfile(doc.id, data),
      passwordHash:
        typeof data.passwordHash === 'string' ? data.passwordHash : undefined,
    };
  }

  async isUsernameAvailable(
    usernameLower: string,
    excludeUid?: string
  ): Promise<boolean> {
    const db = this.getFirestore();

    const usernameDoc = await db
      .collection(USERNAMES_COLLECTION)
      .doc(usernameLower)
      .get();

    if (usernameDoc.exists) {
      const ownerUid = usernameDoc.data()?.uid;
      if (!excludeUid || ownerUid !== excludeUid) {
        return false;
      }
    }

    const querySnap = await db
      .collection(USERS_COLLECTION)
      .where('usernameLower', '==', usernameLower)
      .limit(1)
      .get();

    if (!querySnap.empty) {
      const existingDoc = querySnap.docs[0];
      if (!excludeUid || existingDoc.id !== excludeUid) {
        return false;
      }
    }

    return true;
  }

  async registerManualProfile(input: {
    uid: string;
    firstName: string;
    lastName: string;
    username: string;
    usernameLower: string;
    email: string;
    avatar: string;
    passwordHash?: string;
  }): Promise<UserProfileRecord> {
    const db = this.getFirestore();
    const now = new Date().toISOString();

    const userRef = db.collection(USERS_COLLECTION).doc(input.uid);
    const usernameRef = db
      .collection(USERNAMES_COLLECTION)
      .doc(input.usernameLower);

    return db.runTransaction(async (tx) => {
      const [userSnap, usernameSnap, duplicateUsernameSnap, duplicateEmailSnap] =
        await Promise.all([
          tx.get(userRef),
          tx.get(usernameRef),
          tx.get(
            db
              .collection(USERS_COLLECTION)
              .where('usernameLower', '==', input.usernameLower)
              .limit(1)
          ),
          tx.get(
            db
              .collection(USERS_COLLECTION)
              .where('email', '==', input.email.toLowerCase())
              .limit(1)
          ),
        ]);

      if (
        !duplicateEmailSnap.empty &&
        duplicateEmailSnap.docs[0].id !== input.uid
      ) {
        throw new EmailConflictError();
      }

      if (usernameSnap.exists && usernameSnap.data()?.uid !== input.uid) {
        throw new UsernameConflictError();
      }

      if (
        !duplicateUsernameSnap.empty &&
        duplicateUsernameSnap.docs[0].id !== input.uid
      ) {
        throw new UsernameConflictError();
      }

      const previousUsernameLower = userSnap.exists
        ? (userSnap.data()?.usernameLower as string | null)
        : null;

      if (
        previousUsernameLower &&
        previousUsernameLower !== input.usernameLower
      ) {
        const oldUsernameRef = db
          .collection(USERNAMES_COLLECTION)
          .doc(previousUsernameLower);
        tx.delete(oldUsernameRef);
      }

      const createdAt =
        userSnap.exists && userSnap.data()?.createdAt
          ? String(userSnap.data()?.createdAt)
          : now;

      const record: UserProfileRecord = {
        uid: input.uid,
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username,
        usernameLower: input.usernameLower,
        email: input.email.toLowerCase(),
        avatar: input.avatar,
        provider: 'password',
        requiresUsername: false,
        createdAt,
        updatedAt: now,
      };

      const docPayload: Record<string, unknown> = { ...record };
      if (input.passwordHash) {
        docPayload.passwordHash = input.passwordHash;
      }

      tx.set(userRef, docPayload, { merge: true });
      tx.set(usernameRef, {
        uid: input.uid,
        username: input.username,
        updatedAt: now,
      });

      return record;
    });
  }

  async syncGoogleProfile(input: {
    uid: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar: string;
  }): Promise<UserProfileRecord> {
    const db = this.getFirestore();
    const now = new Date().toISOString();
    const userRef = db.collection(USERS_COLLECTION).doc(input.uid);

    const existingSnap = await userRef.get();

    if (existingSnap.exists) {
      const existing = this.mapDocToProfile(
        input.uid,
        existingSnap.data() || {}
      );
      const updated: UserProfileRecord = {
        ...existing,
        email: input.email || existing.email,
        firstName: existing.firstName || input.firstName,
        lastName: existing.lastName || input.lastName,
        avatar: existing.avatar || input.avatar,
        requiresUsername: !existing.username,
        updatedAt: now,
      };
      await userRef.set(updated, { merge: true });
      return updated;
    }

    const newProfile: UserProfileRecord = {
      uid: input.uid,
      firstName: input.firstName,
      lastName: input.lastName,
      username: null,
      usernameLower: null,
      email: input.email,
      avatar: input.avatar,
      provider: 'google',
      requiresUsername: true,
      createdAt: now,
      updatedAt: now,
    };

    await userRef.set(newProfile);
    return newProfile;
  }

  async assignUniqueUsername(input: {
    uid: string;
    username: string;
    usernameLower: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  }): Promise<UserProfileRecord> {
    const db = this.getFirestore();
    const now = new Date().toISOString();

    const userRef = db.collection(USERS_COLLECTION).doc(input.uid);
    const usernameRef = db
      .collection(USERNAMES_COLLECTION)
      .doc(input.usernameLower);

    return db.runTransaction(async (tx) => {
      const [userSnap, usernameSnap, duplicateQuerySnap] = await Promise.all([
        tx.get(userRef),
        tx.get(usernameRef),
        tx.get(
          db
            .collection(USERS_COLLECTION)
            .where('usernameLower', '==', input.usernameLower)
            .limit(1)
        ),
      ]);

      if (usernameSnap.exists && usernameSnap.data()?.uid !== input.uid) {
        throw new UsernameConflictError();
      }

      if (
        !duplicateQuerySnap.empty &&
        duplicateQuerySnap.docs[0].id !== input.uid
      ) {
        throw new UsernameConflictError();
      }

      const existingData = userSnap.exists ? userSnap.data() || {} : {};
      const previousUsernameLower = existingData.usernameLower as
        | string
        | null
        | undefined;

      if (
        previousUsernameLower &&
        previousUsernameLower !== input.usernameLower
      ) {
        const oldUsernameRef = db
          .collection(USERNAMES_COLLECTION)
          .doc(previousUsernameLower);
        tx.delete(oldUsernameRef);
      }

      const record: UserProfileRecord = {
        uid: input.uid,
        firstName:
          input.firstName || existingData.firstName || 'Estudiante',
        lastName: input.lastName ?? existingData.lastName ?? '',
        username: input.username,
        usernameLower: input.usernameLower,
        email: input.email || existingData.email || '',
        avatar: input.avatar || existingData.avatar || 'SM',
        provider: existingData.provider === 'password' ? 'password' : 'google',
        requiresUsername: false,
        createdAt: existingData.createdAt || now,
        updatedAt: now,
      };

      tx.set(userRef, record, { merge: true });
      tx.set(usernameRef, {
        uid: input.uid,
        username: input.username,
        updatedAt: now,
      });

      return record;
    });
  }

  async updateProfile(input: {
    uid: string;
    firstName: string;
    lastName: string;
    avatar: string;
    username: string;
    usernameLower: string;
    email: string;
  }): Promise<UserProfileRecord> {
    return this.assignUniqueUsername(input);
  }

  private mapDocToProfile(
    uid: string,
    data: FirebaseFirestore.DocumentData
  ): UserProfileRecord {
    const username =
      typeof data.username === 'string' && data.username.trim().length > 0
        ? data.username.trim()
        : null;
    return {
      uid,
      firstName: typeof data.firstName === 'string' ? data.firstName : '',
      lastName: typeof data.lastName === 'string' ? data.lastName : '',
      username,
      usernameLower: username ? username.toLowerCase() : null,
      email: typeof data.email === 'string' ? data.email : '',
      avatar: typeof data.avatar === 'string' ? data.avatar : 'SM',
      provider: data.provider === 'google' ? 'google' : 'password',
      requiresUsername: !username,
      createdAt:
        typeof data.createdAt === 'string'
          ? data.createdAt
          : new Date().toISOString(),
      updatedAt:
        typeof data.updatedAt === 'string'
          ? data.updatedAt
          : new Date().toISOString(),
    };
  }
}
