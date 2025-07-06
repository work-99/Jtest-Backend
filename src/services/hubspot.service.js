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
exports.addContactNote = addContactNote;
// services/hubspot.service.ts
const api_client_1 = __importDefault(require("@hubspot/api-client"));
const db_1 = __importDefault(require("../config/db"));
const axios_1 = __importDefault(require("axios"));
const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI;
function getHubspotAuthUrl() {
    const params = new URLSearchParams({
        client_id: HUBSPOT_CLIENT_ID,
        redirect_uri: HUBSPOT_REDIRECT_URI,
        scope: 'crm.objects.contacts.read crm.objects.contacts.write crm.objects.notes.read crm.objects.notes.write',
        response_type: 'code',
    });
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
    const result = await db_1.default.query('SELECT access_token FROM user_credentials WHERE user_id = $1 AND service = $2', [userId, 'hubspot']);
    if (!result.rows.length)
        throw new Error('HubSpot credentials not found');
    return new api_client_1.default.Client({ accessToken: result.rows[0].access_token });
}
async function searchContacts(userId, query) {
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
async function createContact(userId, contactDetails) {
    const client = await getHubspotClient(userId);
    return await client.crm.contacts.basicApi.create({ properties: contactDetails, associations: [] });
}
async function addContactNote(userId, contactId, note) {
    const client = await getHubspotClient(userId);
    return await client.crm.objects.notes.basicApi.create({
        properties: {
            hs_note_body: note,
            hs_timestamp: new Date().toISOString(),
        },
        associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 280 }] }],
    });
}
