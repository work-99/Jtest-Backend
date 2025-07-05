// routes/webhook.routes.ts
import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const router = Router();

// Gmail webhook endpoint
router.post('/gmail', WebhookController.handleGmailWebhook);

// HubSpot webhook endpoint
router.post('/hubspot', WebhookController.handleHubspotWebhook);

// Google Calendar webhook endpoint
router.post('/calendar', WebhookController.handleCalendarWebhook);

// Health check endpoint
router.get('/health', WebhookController.healthCheck);

// Webhook statistics (protected)
router.get('/stats', WebhookController.getWebhookStats);

export default router; 