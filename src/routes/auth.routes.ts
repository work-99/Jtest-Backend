import { Router } from 'express';
import { 
  googleAuth, 
  googleCallback, 
  hubspotAuth, 
  checkAuthStatus, 
  logout, 
  refreshToken 
} from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Google OAuth routes
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

// HubSpot OAuth routes
router.get('/hubspot', authenticateToken, hubspotAuth);

// HubSpot redirect route for compatibility
router.get('/hubspot/callback', authenticateToken, (req, res) => {
  // Redirect to the new HubSpot callback endpoint
  const redirectUrl = `/api/integrations/hubspot/callback${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
  res.redirect(redirectUrl);
});

// Auth status and management
router.get('/status', authenticateToken, checkAuthStatus);
router.post('/logout', authenticateToken, logout);
router.post('/refresh', authenticateToken, refreshToken);

export default router;
