"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const server_1 = require("@apollo/server");
const schema_js_1 = require("./graphql/schema.js");
const resolvers_js_1 = require("./graphql/resolvers.js");
const auth_js_1 = require("./middleware/auth.js");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(auth_js_1.authMiddleware);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Express GraphQL API',
        version: '1.0.0',
        endpoints: {
            graphql: '/graphql',
            health: '/health',
        },
    });
});
// Apollo Server setup (without context in constructor for v5)
const apolloServer = new server_1.ApolloServer({
    typeDefs: schema_js_1.typeDefs,
    resolvers: resolvers_js_1.resolvers,
});
// Start Apollo Server
async function startServer() {
    await apolloServer.start();
    // Handle GraphQL requests
    app.post('/graphql', async (req, res) => {
        try {
            const { query, variables } = req.body;
            const result = await apolloServer.executeOperation({
                query,
                variables,
            }, {
                userId: req.userId,
                user: req.user,
            });
            res.json(result);
        }
        catch (error) {
            console.error('GraphQL error:', error);
            res.status(500).json({ errors: [{ message: 'Internal Server Error' }] });
        }
    });
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
    });
}
startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map