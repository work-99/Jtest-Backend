"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const gmail_service_1 = require("../services/gmail.service");
const task_service_1 = require("../services/task.service");
const rag_service_1 = require("../services/rag.service");
const db_1 = __importDefault(require("../config/db"));
class WebhookController {
    // Handle Gmail webhook notifications
    static async handleGmailWebhook(req, res) {
        try {
            const { headers, body } = req;
            // Verify the webhook is from Google
            const authHeader = headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            // Extract user ID from the webhook data
            const { historyId, emailAddress } = body;
            if (!historyId || !emailAddress) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }
            // Get user ID from email address
            const userResult = await db_1.default.query('SELECT user_id FROM user_credentials WHERE service = $1 AND metadata->>\'email\' = $2', ['google', emailAddress]);
            if (userResult.rows.length === 0) {
                res.status(404).json({ error: 'User not found' });
                return;
            }
            const userId = userResult.rows[0].user_id;
            // Get new emails (simplified - in production you'd track history IDs)
            const newEmails = await gmail_service_1.GmailService.listEmails(userId, 10);
            if (newEmails.length > 0) {
                // Index new emails for RAG
                for (const email of newEmails) {
                    const content = `From: ${email.from}\nSubject: ${email.subject}\nBody: ${email.body}`;
                    const metadata = {
                        source: 'email',
                        emailId: email.id,
                        from: email.from,
                        subject: email.subject,
                        date: email.date,
                        isNew: true
                    };
                    await rag_service_1.RAGService.storeEmbedding(userId, content, metadata, 'email');
                }
                // Trigger proactive agent for new emails
                await (0, task_service_1.triggerProactiveAgent)(userId, 'new_email', {
                    emailCount: newEmails.length,
                    emails: newEmails.map(email => ({
                        id: email.id,
                        from: email.from,
                        subject: email.subject,
                        snippet: email.snippet
                    }))
                });
                console.log(`Processed ${newEmails.length} new emails for user ${userId}`);
            }
            res.status(200).json({ success: true, processed: newEmails.length });
        }
        catch (error) {
            console.error('Gmail webhook error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    // Handle HubSpot webhook notifications
    static async handleHubspotWebhook(req, res) {
        try {
            const { headers, body } = req;
            // Verify HubSpot webhook signature
            const signature = headers['x-hubspot-signature'];
            if (!signature) {
                res.status(401).json({ error: 'Missing signature' });
                return;
            }
            // Extract subscription type and contact data
            const { subscriptionType, contactId, propertyName, propertyValue } = body;
            if (!subscriptionType || !contactId) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }
            // Get user ID from HubSpot credentials
            const userResult = await db_1.default.query('SELECT user_id FROM user_credentials WHERE service = $1', ['hubspot']);
            if (userResult.rows.length === 0) {
                res.status(404).json({ error: 'No HubSpot users found' });
                return;
            }
            const userId = userResult.rows[0].user_id;
            // Handle different subscription types
            switch (subscriptionType) {
                case 'contact.creation':
                    await this.handleContactCreation(userId, contactId);
                    break;
                case 'contact.propertyChange':
                    await this.handleContactPropertyChange(userId, contactId, propertyName, propertyValue);
                    break;
                case 'contact.deletion':
                    await this.handleContactDeletion(userId, contactId);
                    break;
                default:
                    console.log(`Unhandled HubSpot webhook type: ${subscriptionType}`);
            }
            res.status(200).json({ success: true });
        }
        catch (error) {
            console.error('HubSpot webhook error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    // Handle new contact creation
    static async handleContactCreation(userId, contactId) {
        try {
            // Get contact details
            const { searchContacts } = await Promise.resolve().then(() => __importStar(require('../services/hubspot.service')));
            const contacts = await searchContacts(userId.toString(), contactId);
            if (contacts.length > 0) {
                const contact = contacts[0];
                // Index contact for RAG
                const content = `Name: ${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}\nEmail: ${contact.properties?.email || 'N/A'}\nPhone: ${contact.properties?.phone || 'N/A'}`;
                const metadata = {
                    source: 'contact',
                    contactId: contact.id,
                    email: contact.properties?.email,
                    name: `${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}`,
                    isNew: true
                };
                await rag_service_1.RAGService.storeEmbedding(userId, content, metadata, 'contact');
                // Trigger proactive agent
                await (0, task_service_1.triggerProactiveAgent)(userId, 'new_contact', {
                    contactId: contact.id,
                    contactName: `${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}`,
                    email: contact.properties?.email
                });
                console.log(`Processed new contact ${contact.id} for user ${userId}`);
            }
        }
        catch (error) {
            console.error('Error handling contact creation:', error);
        }
    }
    // Handle contact property changes
    static async handleContactPropertyChange(userId, contactId, propertyName, propertyValue) {
        try {
            // Check if it's a significant property change
            const significantProperties = ['lifecyclestage', 'hs_lead_status', 'dealstage'];
            if (significantProperties.includes(propertyName)) {
                // Trigger proactive agent for significant changes
                await (0, task_service_1.triggerProactiveAgent)(userId, 'contact_update', {
                    contactId,
                    propertyName,
                    propertyValue,
                    changeType: 'significant'
                });
                console.log(`Processed significant contact update for ${contactId}`);
            }
        }
        catch (error) {
            console.error('Error handling contact property change:', error);
        }
    }
    // Handle contact deletion
    static async handleContactDeletion(userId, contactId) {
        try {
            // Remove contact from embeddings
            await db_1.default.query('DELETE FROM embeddings WHERE user_id = $1 AND metadata->>\'contactId\' = $2', [userId, contactId]);
            console.log(`Removed contact ${contactId} from embeddings for user ${userId}`);
        }
        catch (error) {
            console.error('Error handling contact deletion:', error);
        }
    }
    // Handle calendar webhook notifications
    static async handleCalendarWebhook(req, res) {
        try {
            const { headers, body } = req;
            // Verify the webhook is from Google Calendar
            const authHeader = headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const { resourceId, resourceUri, token } = body;
            if (!resourceId || !resourceUri) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }
            // Get user ID from resource URI
            const userResult = await db_1.default.query('SELECT user_id FROM user_credentials WHERE service = $1 AND metadata->>\'calendar_id\' = $2', ['google', resourceId]);
            if (userResult.rows.length === 0) {
                res.status(404).json({ error: 'User not found' });
                return;
            }
            const userId = userResult.rows[0].user_id;
            // Trigger proactive agent for calendar changes
            await (0, task_service_1.triggerProactiveAgent)(userId, 'calendar_update', {
                resourceId,
                resourceUri,
                changeType: 'calendar_event'
            });
            res.status(200).json({ success: true });
        }
        catch (error) {
            console.error('Calendar webhook error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    // Health check endpoint for webhooks
    static async healthCheck(req, res) {
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: ['gmail', 'hubspot', 'calendar']
        });
    }
    // Get webhook statistics
    static async getWebhookStats(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            // Get webhook processing statistics
            const statsResult = await db_1.default.query(`SELECT 
           COUNT(*) as total_webhooks,
           COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed_webhooks,
           COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as failed_webhooks,
           MAX(processed_at) as last_processed
         FROM webhook_logs 
         WHERE user_id = $1`, [userId]);
            const stats = statsResult.rows[0] || {
                total_webhooks: 0,
                processed_webhooks: 0,
                failed_webhooks: 0,
                last_processed: null
            };
            res.json({ success: true, stats });
        }
        catch (error) {
            console.error('Error getting webhook stats:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.WebhookController = WebhookController;
