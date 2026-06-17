import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { Driver } from 'neo4j-driver';
import {
  AuthPayload,
  AuthResult,
  SignupInput,
  LoginInput,
  JWTPayload,
  User,
  UserResponse,
} from '../types/index.js';
import { EmailService } from './EmailService.js';

const SALT_ROUNDS = 12;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthService {
  private driver: Driver;
  private email: EmailService;
  private jwtSecret: string;
  private jwtExpiry: string;

  constructor(driver: Driver, email: EmailService) {
    this.driver = driver;
    this.email = email;
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.jwtExpiry = process.env.JWT_EXPIRY || '24h';
  }

  /**
   * Registers a user in an unverified state and emails a verification link.
   * Does NOT issue a session — the user must verify their email first, which
   * keeps unconfirmed addresses out of authenticated areas.
   */
  async signup(input: SignupInput): Promise<AuthResult> {
    const email = normaliseEmail(input.email);
    const name = input.name?.trim();

    if (!EMAIL_RE.test(email)) throw new Error('Please provide a valid email address');
    if (!name) throw new Error('Name is required');
    if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const session = this.driver.session();
    try {
      const existing = await session.run('MATCH (u:User {email: $email}) RETURN u', { email });

      if (existing.records.length > 0) {
        const user = existing.records[0].get('u').properties as User;
        // Don't reveal that the account exists. If it's unverified, quietly
        // re-send the link so a stalled signup can be completed.
        if (!user.emailVerified) {
          const { token, hash, expiresAt } = newVerificationToken();
          await session.run(
            `MATCH (u:User {email: $email})
             SET u.verificationTokenHash = $hash,
                 u.verificationTokenExpiresAt = $expiresAt,
                 u.updatedAt = $now`,
            { email, hash, expiresAt, now: new Date().toISOString() },
          );
          await this.email.sendVerificationEmail(email, user.name, token);
        }
        return verificationPendingResult(email);
      }

      const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);
      const now = new Date().toISOString();
      const id = randomUUID();
      const { token, hash, expiresAt } = newVerificationToken();

      await session.run(
        `CREATE (u:User {
           id: $id,
           email: $email,
           name: $name,
           password: $password,
           emailVerified: false,
           verificationTokenHash: $hash,
           verificationTokenExpiresAt: $expiresAt,
           createdAt: $now,
           updatedAt: $now
         })`,
        { id, email, name, password: hashedPassword, hash, expiresAt, now },
      );

      await this.email.sendVerificationEmail(email, name, token);
      return verificationPendingResult(email);
    } finally {
      await session.close();
    }
  }

  /**
   * Confirms an email-verification token and logs the user in. Tokens are
   * single-use and time-limited: the stored hash is cleared on success.
   */
  async verifyEmail(token: string): Promise<AuthPayload> {
    if (!token) throw new Error('Verification token is required');
    const hash = hashToken(token);

    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (u:User {verificationTokenHash: $hash}) RETURN u',
        { hash },
      );

      if (result.records.length === 0) {
        throw new Error('Invalid or expired verification link');
      }

      const user = result.records[0].get('u').properties as User;
      if (
        user.verificationTokenExpiresAt &&
        new Date(user.verificationTokenExpiresAt).getTime() < Date.now()
      ) {
        throw new Error('Invalid or expired verification link');
      }

      const updated = await session.run(
        `MATCH (u:User {id: $id})
         SET u.emailVerified = true,
             u.verificationTokenHash = null,
             u.verificationTokenExpiresAt = null,
             u.updatedAt = $now
         RETURN u`,
        { id: user.id, now: new Date().toISOString() },
      );

      const verified = updated.records[0].get('u').properties as User;
      const sessionToken = this.generateToken(verified.id, verified.email);
      return { token: sessionToken, user: this.toUserResponse(verified) };
    } finally {
      await session.close();
    }
  }

  /** Re-issues a verification link. Always returns a generic result. */
  async resendVerification(rawEmail: string): Promise<AuthResult> {
    const email = normaliseEmail(rawEmail);
    const session = this.driver.session();
    try {
      const result = await session.run('MATCH (u:User {email: $email}) RETURN u', { email });
      if (result.records.length > 0) {
        const user = result.records[0].get('u').properties as User;
        if (!user.emailVerified) {
          const { token, hash, expiresAt } = newVerificationToken();
          await session.run(
            `MATCH (u:User {email: $email})
             SET u.verificationTokenHash = $hash,
                 u.verificationTokenExpiresAt = $expiresAt,
                 u.updatedAt = $now`,
            { email, hash, expiresAt, now: new Date().toISOString() },
          );
          await this.email.sendVerificationEmail(email, user.name, token);
        }
      }
      return verificationPendingResult(email);
    } finally {
      await session.close();
    }
  }

  async login(input: LoginInput): Promise<AuthPayload> {
    const email = normaliseEmail(input.email);
    const session = this.driver.session();
    try {
      const result = await session.run('MATCH (u:User {email: $email}) RETURN u', { email });

      // Generic error to avoid revealing whether an account exists.
      if (result.records.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = result.records[0].get('u').properties as User;
      const isPasswordValid = await bcrypt.compare(input.password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      if (!user.emailVerified) {
        throw new Error('Email not verified. Check your inbox or request a new verification link.');
      }

      const token = this.generateToken(user.id, user.email);
      return { token, user: this.toUserResponse(user) };
    } finally {
      await session.close();
    }
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      return jwt.verify(token, this.jwtSecret) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async getUserById(id: string): Promise<UserResponse> {
    const session = this.driver.session();
    try {
      const result = await session.run('MATCH (u:User {id: $id}) RETURN u', { id });

      if (result.records.length === 0) {
        throw new Error('User not found');
      }

      const user = result.records[0].get('u').properties as User;
      return this.toUserResponse(user);
    } finally {
      await session.close();
    }
  }

  /** Strips the password and token fields, returning the public user shape. */
  private toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: Boolean(user.emailVerified),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private generateToken(userId: string, email: string): string {
    const payload = { userId, email };
    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiry } as any);
  }
}

function normaliseEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/** Creates a verification token: the plaintext is emailed, only the hash is stored. */
function newVerificationToken(): { token: string; hash: string; expiresAt: string } {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    hash: hashToken(token),
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS).toISOString(),
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Identical response whether or not an email matched (prevents enumeration). */
function verificationPendingResult(email: string): AuthResult {
  return {
    success: true,
    message: `If ${email} is not already registered, a verification link has been sent. Please check your inbox.`,
  };
}
