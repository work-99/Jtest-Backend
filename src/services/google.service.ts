// services/google.service.ts
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../config/db';

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar',
  'profile',
  'email'
];

export const getGoogleAuthUrl = () => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
};

export const getGoogleTokens = async (code: string) => {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
};

export const getUserData = async (tokens: any) => {
  const ticket = await oauth2Client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  return ticket.getPayload();
};

export const saveGoogleCredentials = async (userId: string, tokens: any) => {
  const query = `
    INSERT INTO user_credentials (user_id, service, access_token, refresh_token, expiry_date)
    VALUES ($1, 'google', $2, $3, $4)
    ON CONFLICT (user_id, service) 
    DO UPDATE SET 
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expiry_date = EXCLUDED.expiry_date
  `;
  await pool.query(query, [
    userId,
    tokens.access_token,
    tokens.refresh_token,
    new Date(tokens.expiry_date)
  ]);
};