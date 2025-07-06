"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveGoogleCredentials = exports.getUserData = exports.getGoogleTokens = exports.getGoogleAuthUrl = void 0;
const google_auth_library_1 = require("google-auth-library");
const db_1 = __importDefault(require("../config/db"));
const oauth2Client = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
];
const getGoogleAuthUrl = () => {
    // Use real Google OAuth URL
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent' // Force consent screen to get refresh token
    });
    console.log('Google OAuth - Using real Google OAuth URL');
    return authUrl;
};
exports.getGoogleAuthUrl = getGoogleAuthUrl;
const getGoogleTokens = async (code) => {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    return tokens;
};
exports.getGoogleTokens = getGoogleTokens;
const getUserData = async (tokens) => {
    try {
        // For now, we'll extract basic info from the ID token if available
        // In a production app, you'd use the Google People API
        if (tokens.id_token) {
            // Decode the ID token to get user info
            const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
            return {
                email: payload.email || 'user@example.com',
                name: payload.name || 'Google User',
                picture: payload.picture,
                sub: payload.sub || 'user@example.com'
            };
        }
        // Fallback if no ID token
        return {
            email: 'user@example.com',
            name: 'Google User',
            picture: undefined,
            sub: 'user@example.com'
        };
    }
    catch (error) {
        console.error('Error extracting user data from tokens:', error);
        return {
            email: 'user@example.com',
            name: 'Google User',
            picture: undefined,
            sub: 'user@example.com'
        };
    }
};
exports.getUserData = getUserData;
const saveGoogleCredentials = async (userId, tokens) => {
    const query = `
    INSERT INTO user_credentials (user_id, service, access_token, refresh_token, expires_at)
    VALUES ($1, 'google', $2, $3, $4)
    ON CONFLICT (user_id, service) 
    DO UPDATE SET 
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at
  `;
    await db_1.default.query(query, [
        userId,
        tokens.access_token,
        tokens.refresh_token,
        new Date(tokens.expiry_date)
    ]);
};
exports.saveGoogleCredentials = saveGoogleCredentials;
