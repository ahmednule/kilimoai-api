/**
 * Shared, lazily-constructed service singletons. Centralising construction here
 * lets both the GraphQL resolvers and the Express routes (e.g. the email
 * verification link handler) use the same instances and configuration.
 */
import { getDriver } from '../db/neo4j.js';
import { AuthService } from './AuthService.js';
import { EmailService } from './EmailService.js';
import { FarmerService } from './FarmerService.js';
import { MatchingService } from './MatchingService.js';
import { ExplanationService } from './ExplanationService.js';
import { FeatherlessClient, featherlessConfigFromEnv } from './llm/FeatherlessClient.js';

const driver = getDriver();
const featherlessConfig = featherlessConfigFromEnv();

export const emailService = new EmailService();
export const authService = new AuthService(driver, emailService);
export const farmerService = new FarmerService(driver);
export const matchingService = new MatchingService(driver);
export const explanationService = new ExplanationService(
  featherlessConfig ? new FeatherlessClient(featherlessConfig) : null,
);
