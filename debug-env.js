"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
console.log('=== Environment Variables Debug ===');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');
console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI ? 'SET' : 'NOT SET');
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI) {
    console.log('\n✅ All Google OAuth environment variables are set');
    // Test OAuth URL generation
    const { OAuth2Client } = require('google-auth-library');
    const oauth2Client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
    const SCOPES = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
    ];
    try {
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent'
        });
        console.log('\n✅ OAuth URL generated successfully');
        console.log('URL length:', authUrl.length);
        console.log('URL contains redirect_uri:', authUrl.includes('redirect_uri'));
        console.log('First 100 chars:', authUrl.substring(0, 100));
    }
    catch (error) {
        console.error('\n❌ Error generating OAuth URL:', error);
    }
}
else {
    console.log('\n❌ Missing required environment variables');
    console.log('Please check your .env file');
}
