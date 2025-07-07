"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHubspotAuthUrl = getHubspotAuthUrl;
exports.getHubspotTokens = getHubspotTokens;
exports.saveHubspotCredentials = saveHubspotCredentials;
exports.getHubspotClient = getHubspotClient;
exports.searchContacts = searchContacts;
exports.createContact = createContact;
// services/hubspot.service.ts
const api_client_1 = require("@hubspot/api-client");
const db_1 = __importDefault(require("../config/db"));
const axios_1 = __importDefault(require("axios"));
const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI;
function getHubspotAuthUrl(userId) {
    const params = new URLSearchParams({
        client_id: HUBSPOT_CLIENT_ID,
        redirect_uri: HUBSPOT_REDIRECT_URI,
        scope: 'crm.objects.contacts.read oauth',
        response_type: 'code',
    });
    // Add state parameter with user ID if provided
    if (userId) {
        params.append('state', userId);
    }
    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}
async function getHubspotTokens(code) {
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        redirect_uri: HUBSPOT_REDIRECT_URI,
        code,
    });
    const response = await axios_1.default.post('https://api.hubapi.com/oauth/v1/token', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
}
async function saveHubspotCredentials(userId, tokens) {
    await db_1.default.query(`INSERT INTO user_credentials (user_id, service, access_token, refresh_token, expires_at)
     VALUES ($1, 'hubspot', $2, $3, to_timestamp($4))
     ON CONFLICT (user_id, service)
     DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at`, [userId, tokens.access_token, tokens.refresh_token, Math.floor(Date.now() / 1000) + tokens.expires_in]);
}
async function getHubspotClient(userId) {
    // const result = await pool.query(
    //   'SELECT access_token FROM user_credentials WHERE user_id = $1 AND service = $2',
    //   [userId, 'hubspot']
    // );
    const result = await db_1.default.query('SELECT access_token FROM user_credentials WHERE service = $1', ['hubspot']);
    if (!result.rows.length)
        throw new Error('HubSpot credentials not found');
    return new api_client_1.Client({ accessToken: result.rows[0].access_token });
}
async function searchContacts(userId, query) {
    console.log('userId', userId);
    const client = await getHubspotClient(userId);
    // Only add filterGroups if query is non-empty and non-blank
    let searchRequest = {
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
    }
    catch (err) {
        if (err && typeof err === 'object' && 'response' in err) {
            const anyErr = err;
            console.log('HubSpot API Error Response:', {
                status: anyErr.response.status,
                headers: anyErr.response.headers,
                data: anyErr.response.data,
            });
        }
        throw err;
    }
}
async function createContact(userId, { email, firstname, lastname, phone }) {
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
    }
    catch (error) {
        console.error('[HubSpot] Error creating contact:', error);
        try {
            console.error('[HubSpot] Error (stringified):', JSON.stringify(error, null, 2));
        }
        catch { }
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
