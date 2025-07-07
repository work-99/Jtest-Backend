"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const gmail_service_1 = require("./src/services/gmail.service");
const hubspot_service_1 = require("./src/services/hubspot.service");
const ai_service_1 = require("./src/services/ai.service");
const db_1 = __importDefault(require("./src/config/db"));
const USER_ID = 2; // <-- Replace with your actual user ID
async function getOngoingInstructions(userId) {
    const { rows } = await db_1.default.query(`SELECT instruction FROM ongoing_instructions WHERE user_id = $1 AND is_active = true`, [userId]);
    return rows.map(r => r.instruction);
}
async function poll() {
    // Get the latest 5 emails
    const emails = await gmail_service_1.GmailService.listEmails(USER_ID, 1);
    for (const email of emails) {
        // Check if sender is in HubSpot
        const contacts = await (0, hubspot_service_1.searchContacts)(USER_ID.toString(), email.from);
        const isInHubSpot = contacts.some(c => c.properties?.email?.toLowerCase() === email.from.toLowerCase());
        if (!isInHubSpot) {
            // Get ongoing instructions
            const instructions = await getOngoingInstructions(USER_ID.toString());
            // Call the proactive agent
            const eventData = {
                from: email.from,
                subject: email.subject,
                body: email.body,
                date: email.date
            };
            const result = await (0, ai_service_1.processProactiveEvent)(USER_ID.toString(), 'new_email', eventData, instructions);
            console.log('Proactive agent result:', result);
        }
    }
}
poll().catch(console.error);
