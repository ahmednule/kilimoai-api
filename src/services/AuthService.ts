import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AuthPayload, SignupInput, LoginInput, JWTPayload } from '../types/index.js';

export class AuthService {
  private prisma: PrismaClient;
  private jwtSecret: string;
  private jwtExpiry: string = '24h';

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  }

  async signup(input: SignupInput): Promise<AuthPayload> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password - bcrypt expects number for rounds
    const hashedPassword = await bcrypt.hash(input.password, 10 as any);

    // Create user
    const user: any = await this.prisma.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        name: input.name,
      },
    });

    // Generate JWT token
    const token = this.generateToken(user.id, user.email);

    const createdAtStr: string = user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt as any).toISOString();
    const updatedAtStr: string = user.updatedAt instanceof Date ? user.updatedAt.toISOString() : new Date(user.updatedAt as any).toISOString();

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: createdAtStr,
        updatedAt: updatedAtStr,
      },
    };
  }

  async login(input: LoginInput): Promise<AuthPayload> {
    // Find user by email
    const user: any = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(input.password, user.password);

    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    // Generate JWT token
    const token = this.generateToken(user.id, user.email);

    const createdAtStr: string = user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt as any).toISOString();
    const updatedAtStr: string = user.updatedAt instanceof Date ? user.updatedAt.toISOString() : new Date(user.updatedAt as any).toISOString();

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: createdAtStr,
        updatedAt: updatedAtStr,
      },
    };
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;
      return payload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async getUserById(id: string) {
    const user: any = await this.prisma.user.findUnique({
      where: { id } as any,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const createdAtStr = user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt as any).toISOString();
    const updatedAtStr = user.updatedAt instanceof Date ? user.updatedAt.toISOString() : new Date(user.updatedAt as any).toISOString();

    return {
      ...user,
      createdAt: createdAtStr,
      updatedAt: updatedAtStr,
    };
  }

  private generateToken(userId: string, email: string): string {
    const payload = { userId, email };
    return jwt.sign(payload, this.jwtSecret, { 
      expiresIn: this.jwtExpiry
    } as any);
  }
}
