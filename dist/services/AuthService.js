"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class AuthService {
    constructor(prisma) {
        this.jwtExpiry = '24h';
        this.prisma = prisma;
        this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    }
    async signup(input) {
        // Check if user already exists
        const existingUser = await this.prisma.user.findUnique({
            where: { email: input.email },
        });
        if (existingUser) {
            throw new Error('User with this email already exists');
        }
        // Hash password - bcrypt expects number for rounds
        const hashedPassword = await bcryptjs_1.default.hash(input.password, 10);
        // Create user
        const user = await this.prisma.user.create({
            data: {
                email: input.email,
                password: hashedPassword,
                name: input.name,
            },
        });
        // Generate JWT token
        const token = this.generateToken(user.id, user.email);
        const createdAtStr = user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt).toISOString();
        const updatedAtStr = user.updatedAt instanceof Date ? user.updatedAt.toISOString() : new Date(user.updatedAt).toISOString();
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
    async login(input) {
        // Find user by email
        const user = await this.prisma.user.findUnique({
            where: { email: input.email },
        });
        if (!user) {
            throw new Error('User not found');
        }
        // Verify password
        const isPasswordValid = await bcryptjs_1.default.compare(input.password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid password');
        }
        // Generate JWT token
        const token = this.generateToken(user.id, user.email);
        const createdAtStr = user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt).toISOString();
        const updatedAtStr = user.updatedAt instanceof Date ? user.updatedAt.toISOString() : new Date(user.updatedAt).toISOString();
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
    async verifyToken(token) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, this.jwtSecret);
            return payload;
        }
        catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
    async getUserById(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
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
        const createdAtStr = user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt).toISOString();
        const updatedAtStr = user.updatedAt instanceof Date ? user.updatedAt.toISOString() : new Date(user.updatedAt).toISOString();
        return {
            ...user,
            createdAt: createdAtStr,
            updatedAt: updatedAtStr,
        };
    }
    generateToken(userId, email) {
        const payload = { userId, email };
        return jsonwebtoken_1.default.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiry
        });
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=AuthService.js.map