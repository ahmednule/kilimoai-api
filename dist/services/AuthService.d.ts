import { PrismaClient } from '@prisma/client';
import { AuthPayload, SignupInput, LoginInput, JWTPayload } from '../types/index.js';
export declare class AuthService {
    private prisma;
    private jwtSecret;
    private jwtExpiry;
    constructor(prisma: PrismaClient);
    signup(input: SignupInput): Promise<AuthPayload>;
    login(input: LoginInput): Promise<AuthPayload>;
    verifyToken(token: string): Promise<JWTPayload>;
    getUserById(id: string): Promise<any>;
    private generateToken;
}
//# sourceMappingURL=AuthService.d.ts.map