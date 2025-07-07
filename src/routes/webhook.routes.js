"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// routes/webhook.routes.ts
const express_1 = require("express");
const webhook_controller_1 = require("../controllers/webhook.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Gmail webhook endpoint
router.post('/gmail', (0, auth_middleware_1.asyncHandler)(webhook_controller_1.WebhookController.handleGmailWebhook));
// HubSpot webhook endpoint
router.post('/hubspot', (0, auth_middleware_1.asyncHandler)(webhook_controller_1.WebhookController.handleHubspotWebhook));
// Google Calendar webhook endpoint
router.post('/calendar', (0, auth_middleware_1.asyncHandler)(webhook_controller_1.WebhookController.handleCalendarWebhook));
// Health check endpoint
router.get('/health', (0, auth_middleware_1.asyncHandler)(webhook_controller_1.WebhookController.healthCheck));
// Webhook statistics (protected)
router.get('/stats', (0, auth_middleware_1.asyncHandler)(webhook_controller_1.WebhookController.getWebhookStats));
exports.default = router;
