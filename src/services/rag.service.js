"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAGService = void 0;
// services/rag.service.ts
const openai_1 = __importDefault(require("openai"));
const db_1 = __importDefault(require("../config/db"));
const gmail_service_1 = require("./gmail.service");
const hubspot_service_1 = require("./hubspot.service");
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });
const openai = new openai_1.default({
    apiKey: "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"
});
class RAGService {
    // Generate embeddings for text content
    static async generateEmbedding(text) {
        try {
            // Validate input
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                console.error('Invalid text for embedding:', text);
                throw new Error('Invalid text input for embedding');
            }
            console.log('Generating embedding for text:', text.substring(0, 100) + '...');
            const response = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: text.trim()
            });
            return response.data[0].embedding;
        }
        catch (error) {
            console.error('Error generating embedding:', error);
            throw new Error('Failed to generate embedding');
        }
    }
    // Store embedding in database
    static async storeEmbedding(userId, content, metadata, source) {
        try {
            const embedding = await this.generateEmbedding(content);
            await db_1.default.query(`INSERT INTO embeddings (user_id, content, embedding, metadata, source)
         VALUES ($1, $2, $3, $4, $5)`, [userId, content, JSON.stringify(embedding), JSON.stringify(metadata), source]);
        }
        catch (error) {
            console.error('Error storing embedding:', error);
            throw new Error('Failed to store embedding');
        }
    }
    // Search for similar content using vector similarity
    static async searchSimilar(userId, query, limit = 10, source) {
        try {
            const queryEmbedding = await this.generateEmbedding(query);
            let sql = `
        SELECT id, content, metadata, 
               embedding <=> $1 as similarity
        FROM embeddings 
        WHERE user_id = $2
      `;
            const params = [JSON.stringify(queryEmbedding), userId];
            let paramIndex = 3;
            if (source) {
                sql += ` AND source = $${paramIndex}`;
                params.push(source);
                paramIndex++;
            }
            sql += `
        ORDER BY similarity ASC
        LIMIT $${paramIndex}
      `;
            params.push(limit);
            const result = await db_1.default.query(sql, params);
            return result.rows.map(row => ({
                id: row.id,
                content: row.content,
                metadata: row.metadata,
                similarity: row.similarity
            }));
        }
        catch (error) {
            console.error('Error searching embeddings:', error);
            throw new Error('Failed to search embeddings');
        }
    }
    // Search across all data sources
    static async searchAll(userId, query, limit = 10) {
        try {
            const queryEmbedding = await this.generateEmbedding(query);
            const sql = `
        SELECT id, content, metadata, source,
               embedding <=> $1 as similarity
        FROM embeddings 
        WHERE user_id = $2
        ORDER BY similarity ASC
        LIMIT $3
      `;
            const result = await db_1.default.query(sql, [
                JSON.stringify(queryEmbedding),
                userId,
                limit
            ]);
            return result.rows.map(row => ({
                id: row.id,
                content: row.content,
                metadata: row.metadata,
                similarity: row.similarity
            }));
        }
        catch (error) {
            console.error('Error searching all data:', error);
            throw new Error('Failed to search all data');
        }
    }
    // Get context for user based on query
    static async getContextForUser(userId, query) {
        try {
            const results = await this.searchAll(userId, query, 5);
            if (results.length === 0) {
                return 'No relevant context found.';
            }
            let context = 'Relevant context:\n\n';
            for (const result of results) {
                const source = result.metadata?.source || 'unknown';
                context += `[${source}] ${result.content.substring(0, 300)}...\n\n`;
            }
            return context;
        }
        catch (error) {
            console.error('Error getting context:', error);
            return 'Unable to retrieve context.';
        }
    }
    // Index user's emails
    static async indexEmails(userId) {
        try {
            console.log(`Indexing emails for user ${userId}...`);
            // Get recent emails
            const emails = await gmail_service_1.GmailService.listEmails(userId, 100);
            for (const email of emails) {
                const content = `From: ${email.from}\nSubject: ${email.subject}\nBody: ${email.body}`;
                const metadata = {
                    source: 'email',
                    emailId: email.id,
                    from: email.from,
                    subject: email.subject,
                    date: email.date
                };
                // Check if already indexed
                const existing = await db_1.default.query('SELECT id FROM embeddings WHERE user_id = $1 AND metadata->>\'emailId\' = $2', [userId, email.id]);
                if (existing.rows.length === 0) {
                    await this.storeEmbedding(userId, content, metadata, 'email');
                }
            }
            console.log(`Indexed ${emails.length} emails for user ${userId}`);
        }
        catch (error) {
            console.error('Error indexing emails:', error);
            throw new Error('Failed to index emails');
        }
    }
    // Index user's HubSpot contacts
    static async indexContacts(userId) {
        try {
            console.log(`Indexing contacts for user ${userId}...`);
            const contacts = await (0, hubspot_service_1.searchContacts)(userId.toString(), '');
            for (const contact of contacts) {
                const content = `Name: ${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}\nEmail: ${contact.properties?.email || 'N/A'}\nPhone: ${contact.properties?.phone || 'N/A'}\nCompany: ${contact.properties?.company || 'N/A'}`;
                const metadata = {
                    source: 'contact',
                    contactId: contact.id,
                    email: contact.properties?.email,
                    name: `${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}`,
                    company: contact.properties?.company
                };
                // Check if already indexed
                const existing = await db_1.default.query('SELECT id FROM embeddings WHERE user_id = $1 AND metadata->>\'contactId\' = $2', [userId, contact.id]);
                if (existing.rows.length === 0) {
                    await this.storeEmbedding(userId, content, metadata, 'contact');
                }
            }
            console.log(`Indexed ${contacts.length} contacts for user ${userId}`);
        }
        catch (error) {
            console.error('Error indexing contacts:', error);
            throw new Error('Failed to index contacts');
        }
    }
    // Index conversation history
    static async indexConversation(userId, messageId) {
        try {
            const result = await db_1.default.query('SELECT content, role FROM messages WHERE id = $1 AND user_id = $2', [messageId, userId]);
            if (result.rows.length > 0) {
                const message = result.rows[0];
                const metadata = {
                    source: 'conversation',
                    messageId,
                    role: message.role,
                    timestamp: new Date()
                };
                await this.storeEmbedding(userId, message.content, metadata, 'conversation');
            }
        }
        catch (error) {
            console.error('Error indexing conversation:', error);
            throw new Error('Failed to index conversation');
        }
    }
    // Rebuild index for user
    static async rebuildIndex(userId) {
        try {
            console.log(`Rebuilding index for user ${userId}...`);
            // Clear existing embeddings
            await db_1.default.query('DELETE FROM embeddings WHERE user_id = $1', [userId]);
            // Re-index emails and contacts
            await this.indexEmails(userId);
            await this.indexContacts(userId);
            console.log(`Index rebuilt for user ${userId}`);
        }
        catch (error) {
            console.error('Error rebuilding index:', error);
            throw new Error('Failed to rebuild index');
        }
    }
    // Get embedding statistics
    static async getIndexStats(userId) {
        try {
            const result = await db_1.default.query(`SELECT source, COUNT(*) as count 
         FROM embeddings 
         WHERE user_id = $1 
         GROUP BY source`, [userId]);
            return result.rows.reduce((acc, row) => {
                acc[row.source] = parseInt(row.count);
                return acc;
            }, {});
        }
        catch (error) {
            console.error('Error getting index stats:', error);
            throw new Error('Failed to get index stats');
        }
    }
}
exports.RAGService = RAGService;
