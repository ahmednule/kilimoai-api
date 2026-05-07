import { GraphQLContext } from '../types/index.js';
export declare const resolvers: {
    Query: {
        me(_: unknown, __: unknown, context: GraphQLContext): Promise<any>;
        user(_: unknown, args: {
            id: string;
        }): Promise<any>;
    };
    Mutation: {
        signup(_: unknown, args: {
            email: string;
            password: string;
            name: string;
        }): Promise<import("../types/index.js").AuthPayload>;
        login(_: unknown, args: {
            email: string;
            password: string;
        }): Promise<import("../types/index.js").AuthPayload>;
    };
};
//# sourceMappingURL=resolvers.d.ts.map