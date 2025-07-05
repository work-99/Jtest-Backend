import { Router } from 'express';
import authRoutes from './auth.routes';
import chatRoutes from './chat.routes';
import instructionsRoutes from './instructions.routes';
import webhookRoutes from './webhook.routes';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);
router.use('/instructions', instructionsRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
