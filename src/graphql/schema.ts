import gql from 'graphql-tag';

export const typeDefs = gql`
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
