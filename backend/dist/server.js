"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("./config/db"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const opportunityRoutes_1 = __importDefault(require("./routes/opportunityRoutes"));
const resourceRoutes_1 = __importDefault(require("./routes/resourceRoutes"));
const applicationRoutes_1 = __importDefault(require("./routes/applicationRoutes"));
const providerRoutes_1 = __importDefault(require("./routes/providerRoutes"));
const publicProviderRoutes_1 = __importDefault(require("./routes/publicProviderRoutes"));
const resourceRequestRoutes_1 = __importDefault(require("./routes/resourceRequestRoutes"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/opportunities', opportunityRoutes_1.default);
app.use('/api/resources', resourceRoutes_1.default);
app.use('/api/applications', applicationRoutes_1.default);
app.use('/api/provider', providerRoutes_1.default);
app.use('/api/providers', publicProviderRoutes_1.default);
app.use('/api/resource-requests', resourceRequestRoutes_1.default);
// Health check
app.get('/api/health', (_req, res) => {
    res.json({
        success: true,
        message: 'TechBridge API is running',
        timestamp: new Date().toISOString(),
    });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});
// Start server
const startServer = async () => {
    try {
        await (0, db_1.default)();
        app.listen(PORT, () => {
            console.log(`🚀 TechBridge API running on http://localhost:${PORT}`);
            console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
//# sourceMappingURL=server.js.map