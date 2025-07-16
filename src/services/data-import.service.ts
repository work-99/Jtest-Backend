import { GmailService } from './gmail.service';
import { searchContacts } from './hubspot.service';
import { RAGService } from './rag.service';
import pool from '../config/db';

export class DataImportService {
  
  // Import all Gmail emails for a user
  static async importGmailEmails(userId: number, maxEmails: number = 1000): Promise<void> {
    try {
      console.log(`Starting Gmail import for user ${userId}...`);
      
      // Get all emails from Gmail
      const emails = await GmailService.listEmails(userId, maxEmails);
      console.log(`Found ${emails.length} emails to import`);
      
      let importedCount = 0;
      let skippedCount = 0;
      
      for (const email of emails) {
        try {
          // Check if already imported
          const existing = await pool.query(
            'SELECT id FROM embeddings WHERE user_id = $1 AND source = $2 AND metadata->>\'emailId\' = $3',
            [userId, 'email', email.id]
          );
          
          if (existing.rows.length > 0) {
            skippedCount++;
            continue;
          }
          
          // Prepare content for embedding
          const content = this.prepareEmailContent(email);
          
          // Prepare metadata
          const metadata = {
            emailId: email.id,
            from: email.from,
            to: email.to || '',
            subject: email.subject,
            date: email.date,
            threadId: email.threadId || '',
            snippet: email.snippet || ''
          };
          
          // Store embedding
          await RAGService.storeEmbedding(userId, content, metadata, 'email');
          importedCount++;
          
          if (importedCount % 50 === 0) {
            console.log(`Imported ${importedCount} emails...`);
          }
          
        } catch (error) {
          console.error(`Error importing email ${email.id}:`, error);
        }
      }
      
      console.log(`✓ Gmail import complete: ${importedCount} imported, ${skippedCount} skipped`);
      
    } catch (error) {
      console.error('Error importing Gmail emails:', error);
      throw error;
    }
  }
  
  // Import all HubSpot contacts for a user
  static async importHubSpotContacts(userId: number): Promise<void> {
    try {
      console.log(`Starting HubSpot contacts import for user ${userId}...`);
      
      // Get all contacts from HubSpot
      const contacts = await searchContacts(userId.toString(), '');
      console.log(`Found ${contacts.length} contacts to import`);
      
      let importedCount = 0;
      let skippedCount = 0;
      
      for (const contact of contacts) {
        try {
          // Check if already imported
          const existing = await pool.query(
            'SELECT id FROM embeddings WHERE user_id = $1 AND source = $2 AND metadata->>\'contactId\' = $3',
            [userId, 'contact', contact.id]
          );
          
          if (existing.rows.length > 0) {
            skippedCount++;
            continue;
          }
          
          // Prepare content for embedding
          const content = this.prepareContactContent(contact);
          
          // Prepare metadata
          const metadata = {
            contactId: contact.id,
            email: contact.properties?.email || '',
            firstName: contact.properties?.firstname || '',
            lastName: contact.properties?.lastname || '',
            phone: contact.properties?.phone || '',
            company: contact.properties?.company || '',
            jobTitle: contact.properties?.jobtitle || '',
            address: contact.properties?.address || '',
            city: contact.properties?.city || '',
            state: contact.properties?.state || '',
            zip: contact.properties?.zip || '',
            country: contact.properties?.country || '',
            website: contact.properties?.website || '',
            lifecycleStage: contact.properties?.lifecyclestage || '',
            leadStatus: contact.properties?.hs_lead_status || '',
            allProperties: contact.properties
          };
          
          // Store embedding
          await RAGService.storeEmbedding(userId, content, metadata, 'contact');
          importedCount++;
          
          if (importedCount % 20 === 0) {
            console.log(`Imported ${importedCount} contacts...`);
          }
          
        } catch (error) {
          console.error(`Error importing contact ${contact.id}:`, error);
        }
      }
      
      console.log(`✓ HubSpot contacts import complete: ${importedCount} imported, ${skippedCount} skipped`);
      
    } catch (error) {
      console.error('Error importing HubSpot contacts:', error);
      throw error;
    }
  }
  
  // Import all data for a user (emails + contacts)
  static async importAllData(userId: number, maxEmails: number = 1000): Promise<void> {
    try {
      console.log(`Starting full data import for user ${userId}...`);
      
      // Import emails first
      await this.importGmailEmails(userId, maxEmails);
      
      // Import contacts
      await this.importHubSpotContacts(userId);
      
      console.log(`✓ Full data import complete for user ${userId}`);
      
    } catch (error) {
      console.error('Error importing all data:', error);
      throw error;
    }
  }
  
  // Prepare email content for embedding
  private static prepareEmailContent(email: any): string {
    const parts = [];
    
    // Add sender info
    if (email.from) {
      parts.push(`From: ${email.from}`);
    }
    
    // Add recipient info
    if (email.to) {
      parts.push(`To: ${email.to}`);
    }
    
    // Add subject
    if (email.subject) {
      parts.push(`Subject: ${email.subject}`);
    }
    
    // Add date
    if (email.date) {
      parts.push(`Date: ${email.date}`);
    }
    
    // Add body content
    if (email.body) {
      // Clean up the body text
      let body = email.body
        .replace(/<[^>]*>/g, ' ') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      parts.push(`Content: ${body}`);
    }
    
    // Add snippet if available
    if (email.snippet && email.snippet !== email.body) {
      parts.push(`Summary: ${email.snippet}`);
    }
    
    return parts.join('\n');
  }
  
  // Prepare contact content for embedding
  private static prepareContactContent(contact: any): string {
    const parts = [];
    
    // Add name
    const firstName = contact.properties?.firstname || '';
    const lastName = contact.properties?.lastname || '';
    if (firstName || lastName) {
      parts.push(`Name: ${firstName} ${lastName}`.trim());
    }
    
    // Add email
    if (contact.properties?.email) {
      parts.push(`Email: ${contact.properties.email}`);
    }
    
    // Add phone
    if (contact.properties?.phone) {
      parts.push(`Phone: ${contact.properties.phone}`);
    }
    
    // Add company
    if (contact.properties?.company) {
      parts.push(`Company: ${contact.properties.company}`);
    }
    
    // Add job title
    if (contact.properties?.jobtitle) {
      parts.push(`Job Title: ${contact.properties.jobtitle}`);
    }
    
    // Add address
    const addressParts = [];
    if (contact.properties?.address) addressParts.push(contact.properties.address);
    if (contact.properties?.city) addressParts.push(contact.properties.city);
    if (contact.properties?.state) addressParts.push(contact.properties.state);
    if (contact.properties?.zip) addressParts.push(contact.properties.zip);
    if (contact.properties?.country) addressParts.push(contact.properties.country);
    
    if (addressParts.length > 0) {
      parts.push(`Address: ${addressParts.join(', ')}`);
    }
    
    // Add website
    if (contact.properties?.website) {
      parts.push(`Website: ${contact.properties.website}`);
    }
    
    // Add lifecycle stage
    if (contact.properties?.lifecyclestage) {
      parts.push(`Lifecycle Stage: ${contact.properties.lifecyclestage}`);
    }
    
    // Add lead status
    if (contact.properties?.hs_lead_status) {
      parts.push(`Lead Status: ${contact.properties.hs_lead_status}`);
    }
    

    
    return parts.join('\n');
  }
  
  // Get import statistics for a user
  static async getImportStats(userId: number): Promise<any> {
    try {
      const result = await pool.query(`
        SELECT 
          source,
          COUNT(*) as count,
          MIN(created_at) as oldest_record,
          MAX(created_at) as newest_record
        FROM embeddings 
        WHERE user_id = $1 
        GROUP BY source
      `, [userId]);
      
      return result.rows;
    } catch (error) {
      console.error('Error getting import stats:', error);
      throw error;
    }
  }
  
  // Clear all embeddings for a user
  static async clearUserData(userId: number): Promise<void> {
    try {
      await pool.query('DELETE FROM embeddings WHERE user_id = $1', [userId]);
      console.log(`✓ Cleared all embeddings for user ${userId}`);
    } catch (error) {
      console.error('Error clearing user data:', error);
      throw error;
    }
  }
} 