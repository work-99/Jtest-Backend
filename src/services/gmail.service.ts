import { google, gmail_v1 } from 'googleapis';
import pool from '../config/db';
import { RAGService } from './rag.service';

export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  from: string;
  to: string;
  date: string;
  body: string;
  labels: string[];
}

export interface SendEmailData {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

export class GmailService {
  static async getGmailClient(userId: number) {
    const result = await pool.query(
      'SELECT access_token, refresh_token FROM user_credentials WHERE user_id = $1 AND service = $2',
      [userId, 'google']
    );

    if (!result.rows.length) {
      throw new Error('Google credentials not found');
    }

    const credentials = result.rows[0];
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  // Helper method to execute Gmail API calls with automatic token refresh
  static async executeWithTokenRefresh<T>(
    userId: number, 
    operation: (gmail: gmail_v1.Gmail) => Promise<T>
  ): Promise<T> {
    try {
      const gmail = await this.getGmailClient(userId);
      return await operation(gmail);
    } catch (error: any) {
      // Check if it's an authentication error (401)
      if (error.code === 401 || 
          (error.response && error.response.status === 401) ||
          (error.message && error.message.includes('unauthorized'))) {
        console.log(`[Gmail] Token expired for user ${userId}, refreshing...`);
        
        try {
          // Refresh the access token
          await this.refreshAccessToken(userId);
          
          // Retry the operation with fresh token
          const gmail = await this.getGmailClient(userId);
          return await operation(gmail);
        } catch (refreshError) {
          console.error('[Gmail] Failed to refresh token:', refreshError);
          throw new Error('Google authentication expired. Please re-authenticate by calling /api/auth/google/reauthenticate');
        }
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  static async listEmails(userId: number, maxResults: number = 50, query?: string): Promise<EmailMessage[]> {
    return this.executeWithTokenRefresh(userId, async (gmail) => {
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        ...(query ? { q: query } : {})
      });
      const messages = (response.data.messages || []).filter((msg: gmail_v1.Schema$Message) => typeof msg.id === 'string') as { id: string }[];
      const emailPromises = messages.map(async (message: { id: string }) => {
        const emailResponse = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });
        const email = this.parseEmailMessage(emailResponse.data);
        
        // Truncate email content to avoid token limit issues
        const truncatedBody = email.body.length > 2000 ? email.body.substring(0, 2000) + '...' : email.body;
        const emailContent = `From: ${email.from}\nSubject: ${email.subject}\nBody: ${truncatedBody}`;
        
        try {
          await RAGService.storeEmbedding(
            userId,
            emailContent,
            {
              source: 'email',
              emailId: email.id,
              from: email.from,
              subject: email.subject,
              date: email.date
            },
            'email'
          );
        } catch (embeddingError) {
          console.warn('Failed to store embedding for email:', email.id, embeddingError);
          // Continue without storing embedding
        }
        
        return email;
      });
      return await Promise.all(emailPromises);
    });
  }

  static async getEmail(userId: number, emailId: string): Promise<EmailMessage> {
    return this.executeWithTokenRefresh(userId, async (gmail) => {
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: emailId,
        format: 'full'
      });
      const email = this.parseEmailMessage(response.data);
      // Store embedding for RAG
      await RAGService.storeEmbedding(
        userId,
        `From: ${email.from}\nSubject: ${email.subject}\nBody: ${email.body}`,
        {
          source: 'email',
          emailId: email.id,
          from: email.from,
          subject: email.subject,
          date: email.date
        },
        'email'
      );
      return email;
    });
  }

  static async sendEmail(userId: number, emailData: SendEmailData): Promise<string> {
    return this.executeWithTokenRefresh(userId, async (gmail) => {
      const message = this.createEmailMessage(emailData);
      const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

      const params: any = {
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      };

      if (emailData.threadId) {
        params.requestBody.threadId = emailData.threadId;
      }

      const response = await gmail.users.messages.send(params);
      
      return response.data.id!;
    });
  }

  static async replyToEmail(userId: number, threadId: string, subject: string, body: string): Promise<string> {
    return this.executeWithTokenRefresh(userId, async (gmail) => {
      const message = this.createEmailMessage({
        to: '', // Will be extracted from original email
        subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
        body,
        threadId
      });

      const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId
        }
      });

      return response.data.id!;
    });
  }

  static async searchEmails(userId: number, query: string, maxResults: number = 20): Promise<EmailMessage[]> {
    return this.executeWithTokenRefresh(userId, async (gmail) => {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults
      });

      const messages = response.data.messages || [];
      const emailPromises = messages.map(async (message) => {
        const email = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full'
        });

        return this.parseEmailMessage(email.data);
      });

      return await Promise.all(emailPromises);
    });
  }

  static async getThread(userId: number, threadId: string): Promise<EmailMessage[]> {
    return this.executeWithTokenRefresh(userId, async (gmail) => {
      const response = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full'
      });

      const messages = response.data.messages || [];
      return messages.map(message => this.parseEmailMessage(message));
    });
  }

  private static parseEmailMessage(message: any): EmailMessage {
    const headers = message.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const to = headers.find((h: any) => h.name === 'To')?.value || '';
    const date = headers.find((h: any) => h.name === 'Date')?.value || '';

    let body = '';
    if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString();
    } else if (message.payload?.parts) {
      const textPart = message.payload.parts.find((part: any) => 
        part.mimeType === 'text/plain' || part.mimeType === 'text/html'
      );
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString();
      }
    }

    return {
      id: message.id,
      threadId: message.threadId,
      subject,
      snippet: message.snippet || '',
      from,
      to,
      date,
      body,
      labels: message.labelIds || []
    };
  }

  private static createEmailMessage(emailData: SendEmailData): string {
    const boundary = 'boundary_' + Math.random().toString(36).substring(2);
    const date = new Date().toUTCString();
    
    const message = [
      `From: me`,
      `To: ${emailData.to}`,
      `Subject: ${emailData.subject}`,
      `Date: ${date}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      emailData.body,
      ``,
      `--${boundary}--`
    ].join('\r\n');

    return message;
  }

  static async setupWebhook(userId: number, topic: string = 'https://www.googleapis.com/auth/gmail.readonly'): Promise<void> {
    try {
      const gmail = await this.getGmailClient(userId);
      
      // Note: Gmail doesn't support traditional webhooks like other Google APIs
      // This would typically be implemented using Gmail API push notifications
      // or polling for new messages
      
      console.log(`Webhook setup requested for user ${userId} with topic ${topic}`);
    } catch (error) {
      console.error('Error setting up webhook:', error);
      throw new Error('Failed to setup webhook');
    }
  }

  static async refreshAccessToken(userId: number): Promise<void> {
    try {
      const result = await pool.query(
        'SELECT refresh_token FROM user_credentials WHERE user_id = $1 AND service = $2',
        [userId, 'google']
      );

      if (!result.rows.length) {
        throw new Error('Refresh token not found');
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      oauth2Client.setCredentials({
        refresh_token: result.rows[0].refresh_token
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      
      await pool.query(
        `UPDATE user_credentials 
         SET access_token = $1, expires_at = $2, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3 AND service = $4`,
        [credentials.access_token, credentials.expiry_date, userId, 'google']
      );
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }
} 