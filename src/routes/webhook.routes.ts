// routes/webhook.routes.ts
import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';
import { asyncHandler } from '../middleware/auth.middleware';

const router = Router();

// Gmail webhook endpoint
router.post('/gmail', asyncHandler(WebhookController.handleGmailWebhook));

// HubSpot webhook endpoint
router.post('/hubspot', asyncHandler(WebhookController.handleHubspotWebhook));

// Google Calendar webhook endpoint
router.post('/calendar', asyncHandler(WebhookController.handleCalendarWebhook));

// Health check endpoint
router.get('/health', asyncHandler(WebhookController.healthCheck));

// Webhook statistics (protected)
router.get('/stats', asyncHandler(WebhookController.getWebhookStats));

export default router; 