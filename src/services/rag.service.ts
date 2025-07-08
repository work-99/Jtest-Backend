// services/rag.service.ts
import OpenAI from 'openai';
import pool from '../config/db';
import { GmailService } from './gmail.service';
import { searchContacts } from './hubspot.service';

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface EmbeddingResult {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
}

export class RAGService {
  // Generate embeddings for text content
  static async generateEmbedding(text: string): Promise<number[]> {
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
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  // Store embedding in database
  static async storeEmbedding(
    userId: number,
    content: string,
    metadata: any,
    source: 'email' | 'contact' | 'conversation'
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(content);
      
      await pool.query(
        `INSERT INTO embeddings (user_id, content, embedding, metadata, source)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, content, JSON.stringify(embedding), JSON.stringify(metadata), source]
      );
    } catch (error) {
      console.error('Error storing embedding:', error);
      throw new Error('Failed to store embedding');
    }
  }

  // Search for similar content using vector similarity
  static async searchSimilar(
    userId: number,
    query: string,
    limit: number = 10,
    source?: string
  ): Promise<EmbeddingResult[]> {
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
      
      const result = await pool.query(sql, params);
      
      return result.rows.map(row => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata,
        similarity: row.similarity
      }));
    } catch (error) {
      console.error('Error searching embeddings:', error);
      throw new Error('Failed to search embeddings');
    }
  }

  // Search across all data sources
  static async searchAll(
    userId: number,
    query: string,
    limit: number = 10
  ): Promise<EmbeddingResult[]> {
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
      
      const result = await pool.query(sql, [
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
    } catch (error) {
      console.error('Error searching all data:', error);
      throw new Error('Failed to search all data');
    }
  }

  // Get context for user based on query
  static async getContextForUser(userId: number, query: string): Promise<string> {
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
    } catch (error) {
      console.error('Error getting context:', error);
      return 'Unable to retrieve context.';
    }
  }

  // Index user's emails
  static async indexEmails(userId: number): Promise<void> {
    try {
      console.log(`Indexing emails for user ${userId}...`);
      
      // Get recent emails
      const emails = await GmailService.listEmails(userId, 100);
      
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
        const existing = await pool.query(
          'SELECT id FROM embeddings WHERE user_id = $1 AND metadata->>\'emailId\' = $2',
          [userId, email.id]
        );
        
        if (existing.rows.length === 0) {
          await this.storeEmbedding(userId, content, metadata, 'email');
        }
      }
      
      console.log(`Indexed ${emails.length} emails for user ${userId}`);
    } catch (error) {
      console.error('Error indexing emails:', error);
      throw new Error('Failed to index emails');
    }
  }

  // Index user's HubSpot contacts
  static async indexContacts(userId: number): Promise<void> {
    try {
      console.log(`Indexing contacts for user ${userId}...`);
      
      const contacts = await searchContacts(userId.toString(), '');
      
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
        const existing = await pool.query(
          'SELECT id FROM embeddings WHERE user_id = $1 AND metadata->>\'contactId\' = $2',
          [userId, contact.id]
        );
        
        if (existing.rows.length === 0) {
          await this.storeEmbedding(userId, content, metadata, 'contact');
        }
      }
      
      console.log(`Indexed ${contacts.length} contacts for user ${userId}`);
    } catch (error) {
      console.error('Error indexing contacts:', error);
      throw new Error('Failed to index contacts');
    }
  }

  // Index conversation history
  static async indexConversation(userId: number, messageId: number): Promise<void> {
    try {
      const result = await pool.query(
        'SELECT content, role FROM messages WHERE id = $1 AND user_id = $2',
        [messageId, userId]
      );
      
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
    } catch (error) {
      console.error('Error indexing conversation:', error);
      throw new Error('Failed to index conversation');
    }
  }

  // Rebuild index for user
  static async rebuildIndex(userId: number): Promise<void> {
    try {
      console.log(`Rebuilding index for user ${userId}...`);
      
      // Clear existing embeddings
      await pool.query('DELETE FROM embeddings WHERE user_id = $1', [userId]);
      
      // Re-index emails and contacts
      await this.indexEmails(userId);
      await this.indexContacts(userId);
      
      console.log(`Index rebuilt for user ${userId}`);
    } catch (error) {
      console.error('Error rebuilding index:', error);
      throw new Error('Failed to rebuild index');
    }
  }

  // Get embedding statistics
  static async getIndexStats(userId: number): Promise<any> {
    try {
      const result = await pool.query(
        `SELECT source, COUNT(*) as count 
         FROM embeddings 
         WHERE user_id = $1 
         GROUP BY source`,
        [userId]
      );
      
      return result.rows.reduce((acc, row) => {
        acc[row.source] = parseInt(row.count);
        return acc;
      }, {});
    } catch (error) {
      console.error('Error getting index stats:', error);
      throw new Error('Failed to get index stats');
    }
  }
} 