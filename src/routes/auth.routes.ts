import { Router } from 'express';
import { 
  googleAuth, 
  googleCallback, 
  hubspotAuth, 
  hubspotCallback, 
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
router.get('/hubspot/callback', authenticateToken, hubspotCallback);

// Auth status and management
router.get('/status', authenticateToken, checkAuthStatus);
router.post('/logout', authenticateToken, logout);
router.post('/refresh', authenticateToken, refreshToken);

export default router;
