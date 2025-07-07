// services/hubspot.service.ts
import { Client } from '@hubspot/api-client';
import pool from '../config/db';
import axios from 'axios';

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI;

export function getHubspotAuthUrl(userId?: string) {
  const params = new URLSearchParams({
    client_id: HUBSPOT_CLIENT_ID!,
    redirect_uri: HUBSPOT_REDIRECT_URI!,
    scope: 'crm.objects.contacts.read oauth',
    response_type: 'code',
  });
  
  // Add state parameter with user ID if provided
  if (userId) {
    params.append('state', userId);
  }
  
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
  // const result = await pool.query(
  //   'SELECT access_token FROM user_credentials WHERE user_id = $1 AND service = $2',
  //   [userId, 'hubspot']
  // );
  const result = await pool.query(
    'SELECT access_token FROM user_credentials WHERE service = $1',
    ['hubspot']
  );
  if (!result.rows.length) throw new Error('HubSpot credentials not found');
  return new Client({ accessToken: result.rows[0].access_token });
}

export async function searchContacts(userId: string, query: string) {
  console.log('userId', userId);
  const client = await getHubspotClient(userId);

  // Only add filterGroups if query is non-empty and non-blank
  let searchRequest: any = {
    properties: ['firstname', 'lastname', 'email', 'phone'],
    limit: 5,
    after: 0,
  };

  if (query && query.trim() !== '') {
    const tokens = query.trim().split(/\s+/);
    searchRequest.filterGroups = tokens.flatMap(token => [
      [
        { propertyName: 'firstname', operator: 'CONTAINS_TOKEN', value: token }
      ],
      [
        { propertyName: 'lastname', operator: 'CONTAINS_TOKEN', value: token }
      ],
      [
        { propertyName: 'email', operator: 'CONTAINS_TOKEN', value: token }
      ]
    ]);
  }

  // Remove any empty arrays (HubSpot doesn't like them)
  if (!searchRequest.filterGroups) {
    // Do nothing
  }
  if (!searchRequest.sorts || searchRequest.sorts.length === 0) {
    delete searchRequest.sorts;
  }

  // Debug log
  console.log('HubSpot searchRequest:', JSON.stringify(searchRequest, null, 2));

  // Log the request URL and headers
  const apiUrl = 'https://api.hubapi.com/crm/v3/objects/contacts/search';
  const token = (await getHubspotClient(userId)).config.accessToken;
  console.log('HubSpot API URL:', apiUrl);
  console.log('HubSpot API Headers:', JSON.stringify({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }, null, 2));

  // Make the API call and log the response
  try {
    const result = await client.crm.contacts.searchApi.doSearch(searchRequest);
    console.log('HubSpot API Response:', JSON.stringify(result, null, 2));
    return result.results;
  } catch (err) {
    if (err && typeof err === 'object' && 'response' in err) {
      const anyErr = err as any;
      console.log('HubSpot API Error Response:', {
        status: anyErr.response.status,
        headers: anyErr.response.headers,
        data: anyErr.response.data,
      });
      
    }
    throw err;
  }
}

export async function createContact(userId: string, { email, firstname, lastname, phone }: { email: string, firstname: string, lastname: string, phone?: string }) {
  console.log('[HubSpot] createContact called with:', { email, firstname, lastname, phone });
  try {
    console.log('[HubSpot] Attempting to create contact:', { email, firstname, lastname, phone });
    const client = await getHubspotClient(userId);
    const result = await client.crm.contacts.basicApi.create({
      properties: {
        email: email || '',
        firstname: firstname || '',
        lastname: lastname || '',
        phone: phone || ''
      },
      associations: []
    });
    console.log('[HubSpot] Contact creation result:', result);
    // Defensive: check for success
    if (!result || typeof result !== 'object' || !('id' in result)) {
      console.error('[HubSpot] Contact creation returned invalid result:', result);
      throw new Error('HubSpot contact creation failed or returned invalid result');
    }
    console.log('[HubSpot] createContact returning:', result);
    return result;
  } catch (error: any) {
    console.error('[HubSpot] Error creating contact:', error);
    try { console.error('[HubSpot] Error (stringified):', JSON.stringify(error, null, 2)); } catch {}
    if (error.response) {
      console.error('[HubSpot] API error.response:', error.response);
    }
    if (error.body) {
      console.error('[HubSpot] API error.body:', error.body);
    }
    if (error.message) {
      console.error('[HubSpot] API error.message:', error.message);
    }
    throw error;
  }
}