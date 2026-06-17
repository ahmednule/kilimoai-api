import {
  authService,
  farmerService,
  matchingService,
  explanationService,
} from '../services/container.js';
import {
  GraphQLContext,
  SignupInput,
  LoginInput,
  OnboardFarmerInput,
  LoanProduct,
  ProductMatch,
} from '../types/index.js';

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

    // Loan-officer view — requires authentication (lenders sign in; PRD §5, §7).
    async farmersForProduct(
      _: unknown,
      args: { productId: string; includeNearMisses?: boolean; limit?: number },
      context: GraphQLContext,
    ) {
      if (!context.userId) {
        throw new Error('Unauthorized');
      }
      return matchingService.farmersForProduct(args.productId, {
        includeNearMisses: args.includeNearMisses ?? true,
        limit: args.limit ?? 25,
      });
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

    async verifyEmail(_: unknown, args: { token: string }) {
      return authService.verifyEmail(args.token);
    },

    async resendVerification(_: unknown, args: { email: string }) {
      return authService.resendVerification(args.email);
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

  // Field resolver: explanations are generated on demand (one LLM call each),
  // so clients only pay for the matches they choose to explain.
  ProductMatch: {
    async explanation(match: ProductMatch, args: { language?: string }) {
      return explanationService.explainMatch(match, args.language ?? 'en');
    },
  },
};
