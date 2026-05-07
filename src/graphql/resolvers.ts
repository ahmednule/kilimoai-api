import { PrismaClient } from '@prisma/client';
import { AuthService } from '../services/AuthService.js';
import { GraphQLContext, SignupInput, LoginInput } from '../types/index.js';

const prisma = new PrismaClient();
const authService = new AuthService(prisma);

export const resolvers = {
  Query: {
    async me(_: unknown, __: unknown, context: GraphQLContext) {
      if (!context.userId) {
        throw new Error('Unauthorized');
      }
      return authService.getUserById(context.userId);
    },

    async user(_: unknown, args: { id: string }) {
      return authService.getUserById(args.id);
    },
  },

  Mutation: {
    async signup(
      _: unknown,
      args: { email: string; password: string; name: string }
    ) {
      const input: SignupInput = {
        email: args.email,
        password: args.password,
        name: args.name,
      };
      return authService.signup(input);
    },

    async login(
      _: unknown,
      args: { email: string; password: string }
    ) {
      const input: LoginInput = {
        email: args.email,
        password: args.password,
      };
      return authService.login(input);
    },
  },
};
