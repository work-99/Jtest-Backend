"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleHubspotWebhook = exports.handleGmailWebhook = void 0;
const db_1 = __importDefault(require("../config/db"));
const ai_service_1 = require("../services/ai.service");
// Gmail webhook (push notification or polling)
const handleGmailWebhook = async (req, res) => {
    try {
        // Example: Google push notification header
        const userId = req.headers['x-goog-channel-id'];
        const messageId = req.headers['x-goog-resource-id'];
        // In a real implementation, fetch the new email using Gmail API
        // Check for ongoing instructions
        const { rows: instructions } = await db_1.default.query(`SELECT * FROM ongoing_instructions WHERE user_id = $1 AND is_active = true`, [userId]);
        if (instructions.length) {
            const message = `New email received (ID: ${messageId}). Check if any instructions apply.`;
            await (0, ai_service_1.processMessage)(userId, message);
        }
        res.status(200).send();
    }
    catch (error) {
        console.error('Gmail webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.handleGmailWebhook = handleGmailWebhook;
// HubSpot webhook (or polling)
const handleHubspotWebhook = async (req, res) => {
    try {
        const { objectId, eventType, userId } = req.body;
        if (eventType === 'contact.creation') {
            const { rows: instructions } = await db_1.default.query(`SELECT * FROM ongoing_instructions WHERE user_id = $1 AND trigger_type = 'contact_creation' AND is_active = true`, [userId]);
            if (instructions.length) {
                const message = `New contact created in HubSpot (ID: ${objectId}). Follow instructions.`;
                await (0, ai_service_1.processMessage)(userId, message);
            }
        }
        res.status(200).send();
    }
    catch (error) {
        console.error('HubSpot webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.handleHubspotWebhook = handleHubspotWebhook;
