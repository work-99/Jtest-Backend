// services/google.service.ts
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import pool from '../config/db';

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

export const getGoogleAuthUrl = () => {
  // Use real Google OAuth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent screen to get refresh token
  });
  console.log('Google OAuth - Using real Google OAuth URL');
  return authUrl;
};

export const getGoogleTokens = async (code: string) => {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
};

export const getUserData = async (tokens: any) => {
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
  } catch (error) {
    console.error('Error extracting user data from tokens:', error);
    return {
      email: 'user@example.com',
      name: 'Google User',
      picture: undefined,
      sub: 'user@example.com'
    };
  }
};

export const saveGoogleCredentials = async (userId: string, tokens: any) => {
  const query = `
    INSERT INTO user_credentials (user_id, service, access_token, refresh_token, expires_at)
    VALUES ($1, 'google', $2, $3, $4)
    ON CONFLICT (user_id, service) 
    DO UPDATE SET 
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at
  `;
  await pool.query(query, [
    userId,
    tokens.access_token,
    tokens.refresh_token,
    new Date(tokens.expiry_date)
  ]);
};