// services/hubspot.service.ts
import hubspot from '@hubspot/api-client';
import pool from '../config/db';
import axios from 'axios';

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI;

export function getHubspotAuthUrl() {
  const params = new URLSearchParams({
    client_id: HUBSPOT_CLIENT_ID!,
    redirect_uri: HUBSPOT_REDIRECT_URI!,
    scope: 'crm.objects.contacts.read crm.objects.contacts.write crm.objects.notes.read crm.objects.notes.write',
    response_type: 'code',
  });
  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}

export async function getHubspotTokens(code: string) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: HUBSPOT_CLIENT_ID!,
    client_secret: HUBSPOT_CLIENT_SECRET!,
    redirect_uri: HUBSPOT_REDIRECT_URI!,
    code,
  });
  const response = await axios.post('https://api.hubapi.com/oauth/v1/token', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data;
}

export async function saveHubspotCredentials(userId: string, tokens: any) {
  await pool.query(
    `INSERT INTO user_credentials (user_id, service, access_token, refresh_token, expires_at)
     VALUES ($1, 'hubspot', $2, $3, to_timestamp($4))
     ON CONFLICT (user_id, service)
     DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at`,
    [userId, tokens.access_token, tokens.refresh_token, Math.floor(Date.now() / 1000) + tokens.expires_in]
  );
}

export async function getHubspotClient(userId: string) {
  const result = await pool.query(
    'SELECT access_token FROM user_credentials WHERE user_id = $1 AND service = $2',
    [userId, 'hubspot']
  );
  if (!result.rows.length) throw new Error('HubSpot credentials not found');
  return new hubspot.Client({ accessToken: result.rows[0].access_token });
}

export async function searchContacts(userId: string, query: string) {
  const client = await getHubspotClient(userId);
  const result = await client.crm.contacts.searchApi.doSearch({
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'CONTAINS_TOKEN', value: query }] }],
    properties: ['firstname', 'lastname', 'email', 'phone'],
    limit: 5,
    sorts: [],
    after: 0,
  });
  return result.results;
}

export async function createContact(userId: string, contactDetails: { email: string; firstname?: string; lastname?: string; phone?: string; }) {
  const client = await getHubspotClient(userId);
  return await client.crm.contacts.basicApi.create({ properties: contactDetails, associations: [] });
}

export async function addContactNote(userId: string, contactId: string, note: string) {
  const client = await getHubspotClient(userId);
  return await client.crm.objects.notes.basicApi.create({
    properties: {
      hs_note_body: note,
      hs_timestamp: new Date().toISOString(),
    },
    associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 280 }] }],
  });
}