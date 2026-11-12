import crypto from 'crypto';
import { initFirebase } from '../config/firebase';
import {
  UserRepository,
  UserProfileRecord,
  UsernameConflictError,
  EmailConflictError,
  hashPassword,
} from '../repositories/user.repository';

export class ValidationError extends Error {
  public readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class InvalidCredentialsError extends Error {
  constructor(message = 'Correo o contraseña incorrectos') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Capa de Lógica de Negocio (Service) - TS-01:
 * Valida formatos y campos obligatorios con mensajes claros para el estudiante
 * y coordina la persistencia de perfiles y unicidad de username en Firestore.
 */
export class UserService {
  private readonly repository: UserRepository;

  constructor(repository = new UserRepository()) {
    this.repository = repository;
  }

  validateUsernameFormat(rawUsername: unknown): {
    username: string;
    usernameLower: string;
  } {
    const username =
      typeof rawUsername === 'string' ? rawUsername.trim() : '';

    if (!username) {
      throw new ValidationError(
        'Escribe un nombre de usuario para identificarte en las salas.',
        'username'
      );
    }

    if (username.length < 3 || username.length > 20) {
      throw new ValidationError(
        'El nombre de usuario debe tener entre 3 y 20 caracteres.',
        'username'
      );
    }

    if (!USERNAME_REGEX.test(username)) {
      throw new ValidationError(
        'Usa solo letras, números, puntos (.), guiones (-) o guiones bajos (_), sin espacios.',
        'username'
      );
    }

    return {
      username,
      usernameLower: username.toLowerCase(),
    };
  }

  validatePasswordStrength(rawPassword: unknown): string {
    const password = typeof rawPassword === 'string' ? rawPassword : '';
    if (!password) {
      throw new ValidationError(
        'Escribe una contraseña para proteger tu cuenta.',
        'password'
      );
    }
    if (password.length < 8) {
      throw new ValidationError(
        'La contraseña es muy corta: debe tener al menos 8 caracteres, incluyendo letras y números.',
        'password'
      );
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      throw new ValidationError(
        'La contraseña es débil: combina letras y al menos un número para mayor seguridad.',
        'password'
      );
    }
    return password;
  }

  async checkUsernameAvailability(
    rawUsername: unknown,
    excludeUid?: string
  ): Promise<{ available: boolean; username: string; message: string }> {
    const { username, usernameLower } =
      this.validateUsernameFormat(rawUsername);
    const available = await this.repository.isUsernameAvailable(
      usernameLower,
      excludeUid
    );

    return {
      available,
      username,
      message: available
        ? 'El nombre de usuario está disponible.'
        : 'Este nombre de usuario ya está ocupado. Elige otro diferente.',
    };
  }

  async getMyProfile(uid: string): Promise<UserProfileRecord | null> {
    return this.repository.findByUid(uid);
  }

  async registerManualUser(params: {
    uid: string;
    emailFromToken: string;
    body: Record<string, unknown>;
  }): Promise<UserProfileRecord> {
    const firstName = String(
      params.body.firstName ?? params.body.nombres ?? ''
    ).trim();
    const lastName = String(
      params.body.lastName ?? params.body.apellidos ?? ''
    ).trim();
    const email = String(
      params.body.email ?? params.body.correo ?? params.emailFromToken ?? ''
    )
      .trim()
      .toLowerCase();
    const avatar = String(
      params.body.avatar ?? params.body.avatarUrl ?? ''
    ).trim();
    const rawPassword = params.body.password;

    if (!firstName) {
      throw new ValidationError(
        'Por favor ingresa tus nombres.',
        'firstName'
      );
    }

    if (!lastName) {
      throw new ValidationError(
        'Por favor ingresa tus apellidos.',
        'lastName'
      );
    }

    const { username, usernameLower } = this.validateUsernameFormat(
      params.body.username
    );

    if (!email || !EMAIL_REGEX.test(email)) {
      throw new ValidationError(
        'Escribe un correo válido (ejemplo: ejemplo@correo.com).',
        'email'
      );
    }

    let passwordHash: string | undefined;
    if (typeof rawPassword === 'string' && rawPassword.length > 0) {
      const validPassword = this.validatePasswordStrength(rawPassword);
      passwordHash = hashPassword(validPassword);
    }

    const resolvedAvatar =
      avatar ||
      `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() ||
      'SR';

    return this.repository.registerManualProfile({
      uid: params.uid,
      firstName,
      lastName,
      username,
      usernameLower,
      email,
      avatar: resolvedAvatar,
      passwordHash,
    });
  }

  async registerManualViaBackendAuth(
    body: Record<string, unknown>
  ): Promise<UserProfileRecord> {
    const firstName = String(body.firstName ?? body.nombres ?? '').trim();
    const lastName = String(body.lastName ?? body.apellidos ?? '').trim();
    const email = String(body.email ?? body.correo ?? '')
      .trim()
      .toLowerCase();
    const avatar = String(body.avatar ?? body.avatarUrl ?? '').trim();

    if (!firstName) {
      throw new ValidationError(
        'Por favor ingresa tus nombres.',
        'firstName'
      );
    }

    if (!lastName) {
      throw new ValidationError(
        'Por favor ingresa tus apellidos.',
        'lastName'
      );
    }

    const { username, usernameLower } = this.validateUsernameFormat(
      body.username
    );

    if (!email || !EMAIL_REGEX.test(email)) {
      throw new ValidationError(
        'Escribe un correo válido (ejemplo: ejemplo@correo.com).',
        'email'
      );
    }

    const validPassword = this.validatePasswordStrength(body.password);

    // Verifica primero que el username esté libre antes de crear el usuario en Firebase Auth
    const isUsernameFree =
      await this.repository.isUsernameAvailable(usernameLower);
    if (!isUsernameFree) {
      throw new UsernameConflictError();
    }

    const existingEmail =
      await this.repository.findByEmailWithCredentials(email);
    if (existingEmail) {
      throw new EmailConflictError();
    }

    let uid = `usr_${crypto.randomBytes(10).toString('hex')}`;
    const { auth } = initFirebase();

    if (auth) {
      try {
        const fbUser = await auth.createUser({
          email,
          password: validPassword,
          displayName: `${firstName} ${lastName}`.trim(),
        });
        uid = fbUser.uid;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code || '';
        if (code === 'auth/email-already-exists') {
          throw new EmailConflictError();
        }
      }
    }

    const resolvedAvatar =
      avatar ||
      `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() ||
      'SR';

    return this.repository.registerManualProfile({
      uid,
      firstName,
      lastName,
      username,
      usernameLower,
      email,
      avatar: resolvedAvatar,
      passwordHash: hashPassword(validPassword),
    });
  }

  async loginManualViaBackendAuth(
    body: Record<string, unknown>
  ): Promise<UserProfileRecord> {
    const email = String(body.email ?? body.correo ?? '')
      .trim()
      .toLowerCase();
    const password = String(body.password ?? '');

    if (!email || !EMAIL_REGEX.test(email)) {
      throw new ValidationError(
        'Escribe un correo válido (ejemplo: ejemplo@correo.com).',
        'email'
      );
    }

    if (!password) {
      throw new ValidationError('Ingresa tu contraseña.', 'password');
    }

    const found = await this.repository.findByEmailWithCredentials(email);
    if (!found || !found.passwordHash) {
      throw new InvalidCredentialsError('Correo o contraseña incorrectos');
    }

    const expectedHash = hashPassword(password);
    if (found.passwordHash !== expectedHash) {
      throw new InvalidCredentialsError('Correo o contraseña incorrectos');
    }

    return found.profile;
  }

  async syncGoogleViaBackendAuth(
    body: Record<string, unknown>
  ): Promise<UserProfileRecord> {
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) {
      throw new ValidationError(
        'Selecciona o escribe un correo de Google válido.',
        'email'
      );
    }

    const existing = await this.repository.findByEmailWithCredentials(email);
    if (existing) {
      return existing.profile;
    }

    let uid = `ggl_${crypto
      .createHash('md5')
      .update(email)
      .digest('hex')
      .slice(0, 20)}`;
    const { auth } = initFirebase();
    if (auth) {
      try {
        const fbUser = await auth.getUserByEmail(email);
        uid = fbUser.uid;
      } catch {
        // Si aún no existe en Firebase Auth, lo crea
        try {
          const created = await auth.createUser({
            email,
            displayName: String(body.displayName ?? 'Estudiante Google'),
          });
          uid = created.uid;
        } catch {
          // Usa el UID determinístico
        }
      }
    }

    return this.syncGoogleUser({
      uid,
      emailFromToken: email,
      nameFromToken: String(body.displayName ?? ''),
      body,
    });
  }

  async syncGoogleUser(params: {
    uid: string;
    emailFromToken: string;
    nameFromToken?: string;
    pictureFromToken?: string;
    body?: Record<string, unknown>;
  }): Promise<UserProfileRecord> {
    const rawName = String(
      params.body?.displayName ?? params.nameFromToken ?? ''
    ).trim();
    const parts = rawName ? rawName.split(/\s+/) : [];
    const defaultFirstName = parts[0] || 'Estudiante';
    const defaultLastName = parts.slice(1).join(' ');

    const firstName =
      String(params.body?.firstName ?? '').trim() || defaultFirstName;
    const lastName =
      String(params.body?.lastName ?? '').trim() || defaultLastName;
    const email = (
      String(params.body?.email ?? '').trim() || params.emailFromToken
    ).toLowerCase();
    const avatar =
      String(params.body?.avatar ?? params.pictureFromToken ?? '').trim() ||
      `${firstName.charAt(0)}${lastName.charAt(0) || 'G'}`.toUpperCase();

    return this.repository.syncGoogleProfile({
      uid: params.uid,
      email,
      firstName,
      lastName,
      avatar,
    });
  }

  async setUsername(params: {
    uid: string;
    emailFromToken: string;
    nameFromToken?: string;
    pictureFromToken?: string;
    rawUsername: unknown;
    avatar?: unknown;
  }): Promise<UserProfileRecord> {
    const { username, usernameLower } = this.validateUsernameFormat(
      params.rawUsername
    );

    const rawName = (params.nameFromToken || '').trim();
    const parts = rawName ? rawName.split(/\s+/) : [];
    const firstName = parts[0] || undefined;
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
    const customAvatar =
      typeof params.avatar === 'string' && params.avatar.trim()
        ? params.avatar.trim()
        : params.pictureFromToken;

    return this.repository.assignUniqueUsername({
      uid: params.uid,
      username,
      usernameLower,
      email: params.emailFromToken,
      firstName,
      lastName,
      avatar: customAvatar,
    });
  }

  async updateProfile(params: {
    uid: string;
    emailFromToken: string;
    body: Record<string, unknown>;
  }): Promise<UserProfileRecord> {
    const firstName = String(
      params.body.firstName ?? params.body.nombres ?? ''
    ).trim();
    const lastName = String(
      params.body.lastName ?? params.body.apellidos ?? ''
    ).trim();
    const avatar = String(
      params.body.avatar ?? params.body.avatarUrl ?? ''
    ).trim();

    if (!firstName) {
      throw new ValidationError(
        'Por favor ingresa tus nombres.',
        'firstName'
      );
    }

    if (!lastName) {
      throw new ValidationError(
        'Por favor ingresa tus apellidos.',
        'lastName'
      );
    }

    const { username, usernameLower } = this.validateUsernameFormat(
      params.body.username
    );

    const resolvedAvatar =
      avatar || `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

    return this.repository.updateProfile({
      uid: params.uid,
      firstName,
      lastName,
      avatar: resolvedAvatar,
      username,
      usernameLower,
      email: params.emailFromToken,
    });
  }
}

export { UsernameConflictError, EmailConflictError };
