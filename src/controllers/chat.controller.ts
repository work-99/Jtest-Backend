import { Request, Response } from 'express';
import { processMessage } from '../services/ai.service';
import { MessageModel } from '../modules/message.model';
import { TaskModel } from '../modules/task.model';
import { v4 as uuidv4 } from 'uuid';

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { message, sessionId = uuidv4() } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Save user message to conversation
    await MessageModel.addMessageToConversation(userId, sessionId, {
      user_id: userId,
      session_id: sessionId,
      role: 'user',
      content: message
    });

    // Process message with AI
    const aiResponse = await processMessage(userId.toString(), message);

    // Save AI response to conversation
    await MessageModel.addMessageToConversation(userId, sessionId, {
      user_id: userId,
      session_id: sessionId,
      role: 'assistant',
      content: aiResponse.text,
      metadata: {
        actionRequired: 'actionRequired' in aiResponse ? aiResponse.actionRequired : false,
        toolCalls: 'toolCalls' in aiResponse ? aiResponse.toolCalls : undefined
      }
    });

    // If action is required, create a task
    if ('actionRequired' in aiResponse && aiResponse.actionRequired) {
      await TaskModel.create({
        user_id: userId,
        type: 'ai_action',
        data: {
          sessionId,
          message,
          response: aiResponse,
          timestamp: new Date()
        }
      });
    }

    res.json({
      text: aiResponse.text,
      actionRequired: 'actionRequired' in aiResponse ? aiResponse.actionRequired : false,
      sessionId
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
};

export const getConversationHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { sessionId } = req.params;
    const { limit = 50 } = req.query;

    const conversation = await MessageModel.getConversation(userId, sessionId);
    
    if (!conversation) {
      return res.json({ messages: [] });
    }

    const messages = conversation.messages || [];
    const limitedMessages = messages.slice(-Number(limit));

    res.json({ messages: limitedMessages });

  } catch (error) {
    console.error('Get conversation history error:', error);
    res.status(500).json({ error: 'Failed to get conversation history' });
  }
};

export const getRecentConversations = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { limit = 10 } = req.query;
    const conversations = await MessageModel.getRecentConversations(userId, Number(limit));

    res.json({ conversations });

  } catch (error) {
    console.error('Get recent conversations error:', error);
    res.status(500).json({ error: 'Failed to get recent conversations' });
  }
};

export const searchConversations = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    const conversations = await MessageModel.searchConversations(userId, q);
    res.json({ conversations });

  } catch (error) {
    console.error('Search conversations error:', error);
    res.status(500).json({ error: 'Failed to search conversations' });
  }
};

export const deleteConversation = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { sessionId } = req.params;
    await MessageModel.deleteConversation(userId, sessionId);

    res.json({ success: true, message: 'Conversation deleted' });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
};

export const getTasks = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
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

  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
};

export const getTask = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;
    const task = await TaskModel.findById(Number(id));

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ task });

  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;
    const { status, data } = req.body;

    const task = await TaskModel.findById(Number(id));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let updatedTask;
    if (status) {
      updatedTask = await TaskModel.updateStatus(Number(id), status);
    }
    if (data) {
      updatedTask = await TaskModel.updateData(Number(id), data);
    }

    res.json({ task: updatedTask });

  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
};
