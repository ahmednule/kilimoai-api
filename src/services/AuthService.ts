import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Driver } from 'neo4j-driver';
import { AuthPayload, SignupInput, LoginInput, JWTPayload, User, UserResponse } from '../types/index.js';

export class AuthService {
  private driver: Driver;
  private jwtSecret: string;
  private jwtExpiry: string;

  constructor(driver: Driver) {
    this.driver = driver;
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.jwtExpiry = process.env.JWT_EXPIRY || '24h';
  }

  async signup(input: SignupInput): Promise<AuthPayload> {
    const session = this.driver.session();
    try {
      // Check if user already exists
      const existing = await session.run('MATCH (u:User {email: $email}) RETURN u', {
        email: input.email,
      });

      if (existing.records.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const now = new Date().toISOString();
      const id = randomUUID();

      // Create user node
      const result = await session.run(
        `CREATE (u:User {
           id: $id,
           email: $email,
           name: $name,
           password: $password,
           createdAt: $now,
           updatedAt: $now
         })
         RETURN u`,
        { id, email: input.email, name: input.name, password: hashedPassword, now }
      );

      const user = result.records[0].get('u').properties as User;

      // Generate JWT token
      const token = this.generateToken(user.id, user.email);

      return { token, user: this.toUserResponse(user) };
    } finally {
      await session.close();
    }
  }

  async login(input: LoginInput): Promise<AuthPayload> {
    const session = this.driver.session();
    try {
      // Find user by email
      const result = await session.run('MATCH (u:User {email: $email}) RETURN u', {
        email: input.email,
      });

      if (result.records.length === 0) {
        throw new Error('User not found');
      }

      const user = result.records[0].get('u').properties as User;

      // Verify password
      const isPasswordValid = await bcrypt.compare(input.password, user.password);

      if (!isPasswordValid) {
        throw new Error('Invalid password');
      }

      // Generate JWT token
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

  /** Strips the password and returns the public-facing user shape. */
  private toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private generateToken(userId: string, email: string): string {
    const payload = { userId, email };
    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiry } as any);
  }
}
