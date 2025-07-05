import { Router } from 'express';
import { 
  sendMessage,
  getConversationHistory,
  getRecentConversations,
  searchConversations,
  deleteConversation,
  getTasks,
  getTask,
  updateTask
} from '../controllers/chat.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all chat routes
router.use(authenticateToken);

// Chat endpoints
router.post('/message', sendMessage);
router.get('/conversations', getRecentConversations);
router.get('/conversations/:sessionId', getConversationHistory);
router.get('/conversations/search', searchConversations);
router.delete('/conversations/:sessionId', deleteConversation);

// Task management endpoints
router.get('/tasks', getTasks);
router.get('/tasks/:id', getTask);
router.put('/tasks/:id', updateTask);

export default router;
