"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
console.log('=== Testing Minimal HubSpot Scopes ===\n');
// Test with minimal scopes
const minimalScopes = 'crm.objects.contacts.read oauth';
const clientId = process.env.HUBSPOT_CLIENT_ID;
const redirectUri = process.env.HUBSPOT_REDIRECT_URI;
console.log('Client ID:', clientId);
console.log('Redirect URI:', redirectUri);
console.log('Minimal Scopes:', minimalScopes);
const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: minimalScopes,
    response_type: 'code',
});
const authUrl = `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
console.log('\nMinimal Scopes Auth URL:');
console.log(authUrl);
console.log('\nTry this URL to see if minimal scopes work.');
