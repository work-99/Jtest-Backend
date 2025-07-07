"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Google OAuth routes
router.get('/google', auth_controller_1.googleAuth);
router.get('/google/callback', auth_controller_1.googleCallback);
// HubSpot OAuth routes
router.get('/hubspot', auth_middleware_1.authenticateToken, auth_controller_1.hubspotAuth);
// HubSpot redirect route for compatibility
router.get('/hubspot/callback', auth_middleware_1.authenticateToken, (req, res) => {
    // Redirect to the new HubSpot callback endpoint
    const redirectUrl = `/api/integrations/hubspot/callback${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
    res.redirect(redirectUrl);
});
// Auth status and management
router.get('/status', auth_middleware_1.authenticateToken, auth_controller_1.checkAuthStatus);
router.post('/logout', auth_middleware_1.authenticateToken, auth_controller_1.logout);
router.post('/refresh', auth_middleware_1.authenticateToken, auth_controller_1.refreshToken);
exports.default = router;
