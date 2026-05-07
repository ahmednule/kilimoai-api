import { User as PrismaUser } from '@prisma/client';
export interface User extends PrismaUser {
}
export interface UserResponse {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}
export interface AuthPayload {
    token: string;
    user: UserResponse;
}
export interface SignupInput {
    email: string;
    password: string;
    name: string;
}
export interface LoginInput {
    email: string;
    password: string;
}
export interface GraphQLContext {
    userId?: string;
    user?: User;
}
export interface JWTPayload {
    userId: string;
    email: string;
    iat: number;
    exp: number;
}
//# sourceMappingURL=index.d.ts.map