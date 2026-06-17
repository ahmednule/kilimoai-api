import { getDriver } from '../db/neo4j.js';
import { AuthService } from '../services/AuthService.js';
import { FarmerService } from '../services/FarmerService.js';
import { MatchingService } from '../services/MatchingService.js';
import {
  GraphQLContext,
  SignupInput,
  LoginInput,
  OnboardFarmerInput,
  LoanProduct,
} from '../types/index.js';

const driver = getDriver();
const authService = new AuthService(driver);
const farmerService = new FarmerService(driver);
const matchingService = new MatchingService(driver);

export const resolvers = {
  Query: {
    async me(_: unknown, __: unknown, context: GraphQLContext) {
      if (!context.userId) {
        throw new Error('Unauthorized');
      }
      return authService.getUserById(context.userId);
    },

    async user(_: unknown, args: { id: string }, context: GraphQLContext) {
      if (!context.userId) {
        throw new Error('Unauthorized');
      }
      return authService.getUserById(args.id);
    },

    // Farmer-facing domain queries (no auth — farmers use the assistant freely).
    async farmer(_: unknown, args: { id: string }) {
      return farmerService.getFarmerById(args.id);
    },

    async farmerMatches(
      _: unknown,
      args: { farmerId: string; includeNearMisses?: boolean; limit?: number },
    ) {
      return matchingService.matchFarmer(args.farmerId, {
        includeNearMisses: args.includeNearMisses ?? true,
        limit: args.limit ?? 10,
      });
    },

    async loanProducts() {
      return farmerService.listLoanProducts();
    },

    async loanProduct(_: unknown, args: { id: string }) {
      return farmerService.getLoanProductById(args.id);
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

    async onboardFarmer(_: unknown, args: { input: OnboardFarmerInput }) {
      return farmerService.onboardFarmer(args.input);
    },
  },

  // Field resolver: matches already carry the full product/lender objects, so
  // the lender field is only fetched on demand for standalone product queries.
  LoanProduct: {
    async lender(product: LoanProduct) {
      return farmerService.getLenderForProduct(product.id);
    },
  },
};
