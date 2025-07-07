"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkServiceConnected = exports.requireRole = exports.optionalAuth = exports.authenticateToken = void 0;
exports.asyncHandler = asyncHandler;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../modules/user.model");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// Helper to wrap async middleware
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
exports.authenticateToken = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
        res.status(401).json({ error: 'Access token required' });
        return;
    }
    // Handle mock token for testing
    if (token === 'mock-token') {
        req.user = {
            id: 1,
            email: 'test@example.com',
            role: 'user'
        };
        return next();
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        if (!decoded.userId) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        // Verify user exists
        const user = await user_model_1.UserModel.findById(decoded.userId);
        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        // Add user to request object
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role
        };
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }
});
exports.optionalAuth = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        if (decoded.userId) {
            const user = await user_model_1.UserModel.findById(decoded.userId);
            if (user) {
                req.user = {
                    id: user.id,
                    email: user.email,
                    role: user.role
                };
            }
        }
    }
    next();
});
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};
exports.requireRole = requireRole;
const checkServiceConnected = (service) => {
    return asyncHandler(async (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const hasCredentials = await user_model_1.UserModel.hasValidCredentials(req.user.id, service);
        if (!hasCredentials) {
            res.status(403).json({
                error: `${service} integration not connected`
            });
            return;
        }
        next();
    });
};
exports.checkServiceConnected = checkServiceConnected;
