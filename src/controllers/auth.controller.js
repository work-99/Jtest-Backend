"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshToken = exports.logout = exports.checkAuthStatus = exports.hubspotCallback = exports.hubspotAuth = exports.googleCallback = exports.googleAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../modules/user.model");
const google_service_1 = require("../services/google.service");
const hubspot_service_1 = require("../services/hubspot.service");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const googleAuth = async (req, res) => {
    try {
        const authUrl = (0, google_service_1.getGoogleAuthUrl)();
        res.json({ url: authUrl });
    }
    catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ error: 'Failed to generate auth URL' });
    }
};
exports.googleAuth = googleAuth;
const googleCallback = async (req, res) => {
    try {
        console.log('=== Google Callback Started ===');
        const { code } = req.query;
        if (!code || typeof code !== 'string') {
            console.log('❌ No authorization code provided');
            res.status(400).json({ error: 'Authorization code required' });
            return;
        }
        console.log('✅ Authorization code received:', code.substring(0, 20) + '...');
        // Get tokens from Google
        console.log('🔄 Getting tokens from Google...');
        const tokens = await (0, google_service_1.getGoogleTokens)(code);
        console.log('✅ Tokens received:', {
            hasAccessToken: !!tokens.access_token,
            hasRefreshToken: !!tokens.refresh_token,
            expiryDate: tokens.expiry_date
        });
        // Get user data from Google
        console.log('🔄 Getting user data from Google...');
        const userData = await (0, google_service_1.getUserData)(tokens);
        console.log('✅ User data received:', userData);
        if (!userData?.email) {
            console.log('❌ No email in user data');
            res.status(400).json({ error: 'Failed to get user email from Google' });
            return;
        }
        // Check if user exists
        console.log('🔄 Looking up user in database...');
        let user = await user_model_1.UserModel.findByEmail(userData.email);
        if (!user) {
            console.log('🔄 Creating new user...');
            // Create new user
            const createUserData = {
                email: userData.email,
                name: userData.name || userData.email,
                avatar: userData.picture,
                provider: 'google',
                provider_id: userData.sub || userData.email
            };
            user = await user_model_1.UserModel.create(createUserData);
            console.log('✅ New user created:', user);
        }
        else {
            console.log('✅ Existing user found:', user);
        }
        // Save Google credentials
        console.log('🔄 Saving Google credentials...');
        await (0, google_service_1.saveGoogleCredentials)(user.id.toString(), tokens);
        console.log('✅ Credentials saved');
        // Generate JWT token
        console.log('🔄 Generating JWT token...');
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            email: user.email,
            role: user.role
        }, JWT_SECRET, { expiresIn: '7d' });
        console.log('✅ JWT token generated');
        // Redirect to frontend with token
        const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`;
        console.log('🔄 Redirecting to:', redirectUrl);
        res.redirect(redirectUrl);
        return;
    }
    catch (error) {
        console.error('❌ Google callback error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Authentication failed', details: error.message });
        return;
    }
};
exports.googleCallback = googleCallback;
const hubspotAuth = async (req, res) => {
    try {
        const authUrl = (0, hubspot_service_1.getHubspotAuthUrl)();
        res.json({ url: authUrl });
    }
    catch (error) {
        console.error('HubSpot auth error:', error);
        res.status(500).json({ error: 'Failed to generate auth URL' });
    }
};
exports.hubspotAuth = hubspotAuth;
const hubspotCallback = async (req, res) => {
    try {
        const { code } = req.query;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }
        if (!code || typeof code !== 'string') {
            res.status(400).json({ error: 'Authorization code required' });
            return;
        }
        // Get tokens from HubSpot
        const tokens = await (0, hubspot_service_1.getHubspotTokens)(code);
        // Save HubSpot credentials
        await (0, hubspot_service_1.saveHubspotCredentials)(userId.toString(), tokens);
        res.json({ success: true, message: 'HubSpot connected successfully' });
        return;
    }
    catch (error) {
        console.error('HubSpot callback error:', error);
        res.status(500).json({ error: 'HubSpot authentication failed' });
        return;
    }
};
exports.hubspotCallback = hubspotCallback;
const checkAuthStatus = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        // Handle mock user for testing
        if (userId === 1 && req.user?.email === 'test@example.com') {
            res.json({
                user: {
                    id: 1,
                    email: 'test@example.com',
                    name: 'Test User',
                    avatar: undefined,
                    role: 'user'
                },
                connectedServices: []
            });
            return;
        }
        const user = await user_model_1.UserModel.findById(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const connectedServices = await user_model_1.UserModel.getConnectedServices(userId);
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                role: user.role
            },
            connectedServices
        });
        return;
    }
    catch (error) {
        console.error('Auth status check error:', error);
        res.status(500).json({ error: 'Failed to check auth status' });
        return;
    }
};
exports.checkAuthStatus = checkAuthStatus;
const logout = async (req, res) => {
    try {
        // In a real implementation, you might want to blacklist the token
        res.json({ success: true, message: 'Logged out successfully' });
        return;
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
        return;
    }
};
exports.logout = logout;
const refreshToken = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const user = await user_model_1.UserModel.findById(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Generate new JWT token
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            email: user.email,
            role: user.role
        }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token });
        return;
    }
    catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
        return;
    }
};
exports.refreshToken = refreshToken;
