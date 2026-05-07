"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvers = void 0;
const client_1 = require("@prisma/client");
const AuthService_js_1 = require("../services/AuthService.js");
const prisma = new client_1.PrismaClient();
const authService = new AuthService_js_1.AuthService(prisma);
exports.resolvers = {
    Query: {
        async me(_, __, context) {
            if (!context.userId) {
                throw new Error('Unauthorized');
            }
            return authService.getUserById(context.userId);
        },
        async user(_, args) {
            return authService.getUserById(args.id);
        },
    },
    Mutation: {
        async signup(_, args) {
            const input = {
                email: args.email,
                password: args.password,
                name: args.name,
            };
            return authService.signup(input);
        },
        async login(_, args) {
            const input = {
                email: args.email,
                password: args.password,
            };
            return authService.login(input);
        },
    },
};
//# sourceMappingURL=resolvers.js.map