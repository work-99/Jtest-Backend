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
import { authenticateToken, asyncHandler } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all chat routes
router.use(authenticateToken);

// Chat endpoints
router.post('/message', asyncHandler(sendMessage));
router.get('/conversations', asyncHandler(getRecentConversations));
router.get('/conversations/:sessionId', asyncHandler(getConversationHistory));
router.get('/conversations/search', asyncHandler(searchConversations));
router.delete('/conversations/:sessionId', asyncHandler(deleteConversation));

// Task management endpoints
router.get('/tasks', asyncHandler(getTasks));
router.get('/tasks/:id', asyncHandler(getTask));
router.put('/tasks/:id', asyncHandler(updateTask));

export default router;
