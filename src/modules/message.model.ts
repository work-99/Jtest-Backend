import pool from '../config/db';

export interface Message {
  id: number;
  user_id: number;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  created_at: Date;
}

export interface Conversation {
  id: number;
  user_id: number;
  session_id: string;
  messages: Message[];
  context: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMessageData {
  user_id: number;
  session_id: string;
  role: Message['role'];
  content: string;
  metadata?: any;
}

export class MessageModel {
  static async createMessage(messageData: CreateMessageData): Promise<Message> {
    const query = `
      INSERT INTO conversations (user_id, session_id, messages, context)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, session_id) 
      DO UPDATE SET 
        messages = conversations.messages || $3,
        context = $4,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const newMessage = {
      role: messageData.role,
      content: messageData.content,
      metadata: messageData.metadata,
      created_at: new Date()
    };

    const values = [
      messageData.user_id,
      messageData.session_id,
      JSON.stringify([newMessage]),
      JSON.stringify({ last_updated: new Date() })
    ];

    const result = await pool.query(query, values);
    return newMessage as Message;
  }

  static async getConversation(userId: number, sessionId: string): Promise<Conversation | null> {
    const query = `
      SELECT * FROM conversations 
      WHERE user_id = $1 AND session_id = $2
    `;
    const result = await pool.query(query, [userId, sessionId]);
    return result.rows[0] || null;
  }

  static async getRecentConversations(userId: number, limit: number = 10): Promise<Conversation[]> {
    const query = `
      SELECT * FROM conversations 
      WHERE user_id = $1 
      ORDER BY updated_at DESC 
      LIMIT $2
    `;
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }

  static async addMessageToConversation(userId: number, sessionId: string, message: CreateMessageData): Promise<void> {
    const conversation = await this.getConversation(userId, sessionId);
    
    const newMessage = {
      role: message.role,
      content: message.content,
      metadata: message.metadata,
      created_at: new Date()
    };

    if (conversation) {
      // Update existing conversation
      const updatedMessages = [...conversation.messages, newMessage];
      const query = `
        UPDATE conversations 
        SET messages = $3, 
            context = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND session_id = $2
      `;
      
      const values = [
        userId,
        sessionId,
        JSON.stringify(updatedMessages),
        JSON.stringify({ last_updated: new Date() })
      ];
      
      await pool.query(query, values);
    } else {
      // Create new conversation
      const query = `
        INSERT INTO conversations (user_id, session_id, messages, context)
        VALUES ($1, $2, $3, $4)
      `;
      
      const values = [
        userId,
        sessionId,
        JSON.stringify([newMessage]),
        JSON.stringify({ last_updated: new Date() })
      ];
      
      await pool.query(query, values);
    }
  }

  static async getConversationContext(userId: number, sessionId: string, messageCount: number = 10): Promise<Message[]> {
    const conversation = await this.getConversation(userId, sessionId);
    if (!conversation) {
      return [];
    }

    const messages = conversation.messages || [];
    return messages.slice(-messageCount);
  }

  static async deleteConversation(userId: number, sessionId: string): Promise<void> {
    const query = 'DELETE FROM conversations WHERE user_id = $1 AND session_id = $2';
    await pool.query(query, [userId, sessionId]);
  }

  static async cleanupOldConversations(daysOld: number = 90): Promise<void> {
    const query = `
      DELETE FROM conversations 
      WHERE updated_at < NOW() - INTERVAL '${daysOld} days'
    `;
    await pool.query(query);
  }

  static async searchConversations(userId: number, searchTerm: string): Promise<Conversation[]> {
    const query = `
      SELECT * FROM conversations 
      WHERE user_id = $1 
      AND messages::text ILIKE $2
      ORDER BY updated_at DESC
    `;
    const result = await pool.query(query, [userId, `%${searchTerm}%`]);
    return result.rows;
  }
}
