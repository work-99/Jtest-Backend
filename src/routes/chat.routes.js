"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_controller_1 = require("../controllers/chat.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Apply authentication middleware to all chat routes
router.use(auth_middleware_1.authenticateToken);
// Chat endpoints
router.post('/message', (0, auth_middleware_1.asyncHandler)(chat_controller_1.sendMessage));
router.get('/conversations', (0, auth_middleware_1.asyncHandler)(chat_controller_1.getRecentConversations));
router.get('/conversations/:sessionId', (0, auth_middleware_1.asyncHandler)(chat_controller_1.getConversationHistory));
router.get('/conversations/search', (0, auth_middleware_1.asyncHandler)(chat_controller_1.searchConversations));
router.delete('/conversations/:sessionId', (0, auth_middleware_1.asyncHandler)(chat_controller_1.deleteConversation));
// Task management endpoints
router.get('/tasks', (0, auth_middleware_1.asyncHandler)(chat_controller_1.getTasks));
router.get('/tasks/:id', (0, auth_middleware_1.asyncHandler)(chat_controller_1.getTask));
router.put('/tasks/:id', (0, auth_middleware_1.asyncHandler)(chat_controller_1.updateTask));
exports.default = router;
