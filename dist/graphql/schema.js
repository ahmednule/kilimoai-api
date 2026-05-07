"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeDefs = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.typeDefs = (0, graphql_tag_1.default) `
  type User {
    id: ID!
    email: String!
    name: String!
    createdAt: String!
    updatedAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    me: User
    user(id: ID!): User
  }

  type Mutation {
    signup(email: String!, password: String!, name: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
  }
`;
//# sourceMappingURL=schema.js.map