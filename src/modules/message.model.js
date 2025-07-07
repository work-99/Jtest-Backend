"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageModel = void 0;
const db_1 = __importDefault(require("../config/db"));
class MessageModel {
    static async createMessage(messageData) {
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
        const result = await db_1.default.query(query, values);
        return newMessage;
    }
    static async getConversation(userId, sessionId) {
        const query = `
      SELECT * FROM conversations 
      WHERE user_id = $1 AND session_id = $2
    `;
        const result = await db_1.default.query(query, [userId, sessionId]);
        return result.rows[0] || null;
    }
    static async getRecentConversations(userId, limit = 10) {
        const query = `
      SELECT * FROM conversations 
      WHERE user_id = $1 
      ORDER BY updated_at DESC 
      LIMIT $2
    `;
        const result = await db_1.default.query(query, [userId, limit]);
        return result.rows;
    }
    static async addMessageToConversation(userId, sessionId, message) {
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
            await db_1.default.query(query, values);
        }
        else {
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
            await db_1.default.query(query, values);
        }
    }
    static async getConversationContext(userId, sessionId, messageCount = 10) {
        const conversation = await this.getConversation(userId, sessionId);
        if (!conversation) {
            return [];
        }
        const messages = conversation.messages || [];
        return messages.slice(-messageCount);
    }
    static async deleteConversation(userId, sessionId) {
        const query = 'DELETE FROM conversations WHERE user_id = $1 AND session_id = $2';
        await db_1.default.query(query, [userId, sessionId]);
    }
    static async cleanupOldConversations(daysOld = 90) {
        const query = `
      DELETE FROM conversations 
      WHERE updated_at < NOW() - INTERVAL '${daysOld} days'
    `;
        await db_1.default.query(query);
    }
    static async searchConversations(userId, searchTerm) {
        const query = `
      SELECT * FROM conversations 
      WHERE user_id = $1 
      AND messages::text ILIKE $2
      ORDER BY updated_at DESC
    `;
        const result = await db_1.default.query(query, [userId, `%${searchTerm}%`]);
        return result.rows;
    }
}
exports.MessageModel = MessageModel;
