import { Request, Response } from 'express';
import { processMessage } from '../services/ai.service';
import { MessageModel } from '../modules/message.model';
import { TaskModel } from '../modules/task.model';
import { v4 as uuidv4 } from 'uuid';

export const sendMessage = async (req: Request, res: Response) => {
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
    const finalSessionId = sessionId || uuidv4();
    console.log('Message:', message, 'Session ID:', finalSessionId);
    
    if (!message || typeof message !== 'string') {
      console.log('Invalid message format');
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    console.log('Saving user message to conversation...');
    // Save user message to conversation
    await MessageModel.addMessageToConversation(userIdNumber, finalSessionId, {
      user_id: userIdNumber,
      session_id: finalSessionId,
      role: 'user',
      content: message
    });
    console.log('User message saved');

    console.log('Processing message with AI...');
    // Process message with AI
    const aiResponse = await processMessage(userIdNumber.toString(), message);
    console.log('AI response received:', aiResponse);

    console.log('Saving AI response to conversation...');
    // Save AI response to conversation
    const text = Array.isArray(aiResponse) ? JSON.stringify(aiResponse) : aiResponse.text || 'No response generated';
    await MessageModel.addMessageToConversation(userIdNumber, finalSessionId, {
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
      await TaskModel.create({
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
  } catch (error) {
    console.error('Send message error:', error);
    console.error('Error stack:', (error as Error).stack);
    res.status(500).json({ error: 'Failed to process message' });
    return;
  }
};

export const getConversationHistory = async (req: Request, res: Response) => {
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

    const conversation = await MessageModel.getConversation(userId, sessionId);
    
    if (!conversation) {
      res.json({ messages: [] });
      return;
    }

    const messages = conversation.messages || [];
    const limitedMessages = messages.slice(-Number(limit));

    res.json({ messages: limitedMessages });
    return;
  } catch (error) {
    console.error('Get conversation history error:', error);
    res.status(500).json({ error: 'Failed to get conversation history' });
    return;
  }
};

export const getRecentConversations = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { limit = 10 } = req.query;
    const conversations = await MessageModel.getRecentConversations(userId, Number(limit));

    res.json({ conversations });
    return;
  } catch (error) {
    console.error('Get recent conversations error:', error);
    res.status(500).json({ error: 'Failed to get recent conversations' });
    return;
  }
};

export const searchConversations = async (req: Request, res: Response) => {
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

    const conversations = await MessageModel.searchConversations(userId, q);
    res.json({ conversations });
    return;
  } catch (error) {
    console.error('Search conversations error:', error);
    res.status(500).json({ error: 'Failed to search conversations' });
    return;
  }
};

export const deleteConversation = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { sessionId } = req.params;
    await MessageModel.deleteConversation(userId, sessionId);

    res.json({ success: true, message: 'Conversation deleted' });
    return;
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
    return;
  }
};

export const getTasks = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { status, type, limit = 50 } = req.query;
    
    let tasks;
    if (status) {
      tasks = await TaskModel.findByUserId(userId, Number(limit));
      tasks = tasks.filter(task => task.status === status);
    } else if (type) {
      tasks = await TaskModel.getTasksByType(userId, type as string);
    } else {
      tasks = await TaskModel.findByUserId(userId, Number(limit));
    }

    res.json({ tasks });
    return;
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
    return;
  }
};

export const getTask = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const task = await TaskModel.findById(Number(id));

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
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to get task' });
    return;
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const { status, data } = req.body;
    const task = await TaskModel.findById(Number(id));

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
      updatedTask = await TaskModel.updateStatus(Number(id), status);
    }
    if (data) {
      updatedTask = await TaskModel.updateData(Number(id), data);
    }

    res.json({ task: updatedTask });
    return;
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
    return;
  }
};
