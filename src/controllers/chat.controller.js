"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTask = exports.getTask = exports.getTasks = exports.deleteConversation = exports.searchConversations = exports.getRecentConversations = exports.getConversationHistory = exports.sendMessage = void 0;
const ai_service_1 = require("../services/ai.service");
const message_model_1 = require("../modules/message.model");
const task_model_1 = require("../modules/task.model");
const uuid_1 = require("uuid");
const sendMessage = async (req, res) => {
    const userIdNumber = req.user?.id;
    const message = req.body.message;
    console.log('Received chat message:', { userId: userIdNumber, message });
    try {
        console.log('sendMessage called with body:', req.body);
        if (!userIdNumber) {
            console.log('No user ID found');
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        // At this point, userId is guaranteed to be a number
        console.log('User ID:', userIdNumber);
        const { sessionId } = req.body;
        const finalSessionId = sessionId || (0, uuid_1.v4)();
        console.log('Message:', message, 'Session ID:', finalSessionId);
        if (!message || typeof message !== 'string') {
            console.log('Invalid message format');
            res.status(400).json({ error: 'Message is required' });
            return;
        }
        console.log('Saving user message to conversation...');
        // Save user message to conversation
        await message_model_1.MessageModel.addMessageToConversation(userIdNumber, finalSessionId, {
            user_id: userIdNumber,
            session_id: finalSessionId,
            role: 'user',
            content: message
        });
        console.log('User message saved');
        console.log('Processing message with AI...');
        // Process message with AI
        const aiResponse = await (0, ai_service_1.processMessage)(userIdNumber.toString(), message);
        console.log('AI response received:', aiResponse);
        console.log('Saving AI response to conversation...');
        // Save AI response to conversation
        const text = Array.isArray(aiResponse) ? JSON.stringify(aiResponse) : aiResponse.text || 'No response generated';
        await message_model_1.MessageModel.addMessageToConversation(userIdNumber, finalSessionId, {
            user_id: userIdNumber,
            session_id: finalSessionId,
            role: 'assistant',
            content: text,
            metadata: {
                actionRequired: 'actionRequired' in aiResponse ? aiResponse.actionRequired : false,
                toolCalls: 'toolCalls' in aiResponse ? aiResponse.toolCalls : undefined
            }
        });
        console.log('AI response saved');
        // If action is required, create a task
        if ('actionRequired' in aiResponse && aiResponse.actionRequired) {
            console.log('Creating task for action...');
            await task_model_1.TaskModel.create({
                user_id: userIdNumber,
                type: 'ai_action',
                data: {
                    sessionId: finalSessionId,
                    message,
                    response: aiResponse,
                    timestamp: new Date()
                }
            });
            console.log('Task created');
        }
        console.log('Sending response to client');
        res.json({
            text,
            actionRequired: 'actionRequired' in aiResponse ? aiResponse.actionRequired : false,
            sessionId: finalSessionId
        });
        return;
    }
    catch (error) {
        console.error('Send message error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to process message' });
        return;
    }
};
exports.sendMessage = sendMessage;
const getConversationHistory = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const { sessionId } = req.params;
        const { limit = 50 } = req.query;
        if (!sessionId) {
            res.status(400).json({ error: 'Session ID is required' });
            return;
        }
        const conversation = await message_model_1.MessageModel.getConversation(userId, sessionId);
        if (!conversation) {
            res.json({ messages: [] });
            return;
        }
        const messages = conversation.messages || [];
        const limitedMessages = messages.slice(-Number(limit));
        res.json({ messages: limitedMessages });
        return;
    }
    catch (error) {
        console.error('Get conversation history error:', error);
        res.status(500).json({ error: 'Failed to get conversation history' });
        return;
    }
};
exports.getConversationHistory = getConversationHistory;
const getRecentConversations = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const { limit = 10 } = req.query;
        const conversations = await message_model_1.MessageModel.getRecentConversations(userId, Number(limit));
        res.json({ conversations });
        return;
    }
    catch (error) {
        console.error('Get recent conversations error:', error);
        res.status(500).json({ error: 'Failed to get recent conversations' });
        return;
    }
};
exports.getRecentConversations = getRecentConversations;
const searchConversations = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            res.status(400).json({ error: 'Search query required' });
            return;
        }
        const conversations = await message_model_1.MessageModel.searchConversations(userId, q);
        res.json({ conversations });
        return;
    }
    catch (error) {
        console.error('Search conversations error:', error);
        res.status(500).json({ error: 'Failed to search conversations' });
        return;
    }
};
exports.searchConversations = searchConversations;
const deleteConversation = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const { sessionId } = req.params;
        await message_model_1.MessageModel.deleteConversation(userId, sessionId);
        res.json({ success: true, message: 'Conversation deleted' });
        return;
    }
    catch (error) {
        console.error('Delete conversation error:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
        return;
    }
};
exports.deleteConversation = deleteConversation;
const getTasks = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const { status, type, limit = 50 } = req.query;
        let tasks;
        if (status) {
            tasks = await task_model_1.TaskModel.findByUserId(userId, Number(limit));
            tasks = tasks.filter(task => task.status === status);
        }
        else if (type) {
            tasks = await task_model_1.TaskModel.getTasksByType(userId, type);
        }
        else {
            tasks = await task_model_1.TaskModel.findByUserId(userId, Number(limit));
        }
        res.json({ tasks });
        return;
    }
    catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'Failed to get tasks' });
        return;
    }
};
exports.getTasks = getTasks;
const getTask = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const { id } = req.params;
        const task = await task_model_1.TaskModel.findById(Number(id));
        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        if (task.user_id !== userId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        res.json({ task });
        return;
    }
    catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ error: 'Failed to get task' });
        return;
    }
};
exports.getTask = getTask;
const updateTask = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const { id } = req.params;
        const { status, data } = req.body;
        const task = await task_model_1.TaskModel.findById(Number(id));
        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        if (task.user_id !== userId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        let updatedTask;
        if (status) {
            updatedTask = await task_model_1.TaskModel.updateStatus(Number(id), status);
        }
        if (data) {
            updatedTask = await task_model_1.TaskModel.updateData(Number(id), data);
        }
        res.json({ task: updatedTask });
        return;
    }
    catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Failed to update task' });
        return;
    }
};
exports.updateTask = updateTask;
