"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailService = void 0;
const googleapis_1 = require("googleapis");
const db_1 = __importDefault(require("../config/db"));
const rag_service_1 = require("./rag.service");
class GmailService {
    static async getGmailClient(userId) {
        const result = await db_1.default.query('SELECT access_token, refresh_token FROM user_credentials WHERE user_id = $1 AND service = $2', [userId, 'google']);
        if (!result.rows.length) {
            throw new Error('Google credentials not found');
        }
        const credentials = result.rows[0];
        const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
        oauth2Client.setCredentials({
            access_token: credentials.access_token,
            refresh_token: credentials.refresh_token
        });
        return googleapis_1.google.gmail({ version: 'v1', auth: oauth2Client });
    }
    static async listEmails(userId, maxResults = 50, query) {
        try {
            const gmail = await this.getGmailClient(userId);
            const response = await gmail.users.messages.list({
                userId: 'me',
                maxResults,
                ...(query ? { q: query } : {})
            });
            const messages = (response.data.messages || []).filter((msg) => typeof msg.id === 'string');
            const emailPromises = messages.map(async (message) => {
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
                    await rag_service_1.RAGService.storeEmbedding(userId, emailContent, {
                        source: 'email',
                        emailId: email.id,
                        from: email.from,
                        subject: email.subject,
                        date: email.date
                    }, 'email');
                }
                catch (embeddingError) {
                    console.warn('Failed to store embedding for email:', email.id, embeddingError);
                    // Continue without storing embedding
                }
                return email;
            });
            return await Promise.all(emailPromises);
        }
        catch (error) {
            console.error('Error listing emails:', error);
            throw new Error('Failed to list emails');
        }
    }
    static async getEmail(userId, emailId) {
        try {
            const gmail = await this.getGmailClient(userId);
            const response = await gmail.users.messages.get({
                userId: 'me',
                id: emailId,
                format: 'full'
            });
            const email = this.parseEmailMessage(response.data);
            // Store embedding for RAG
            await rag_service_1.RAGService.storeEmbedding(userId, `From: ${email.from}\nSubject: ${email.subject}\nBody: ${email.body}`, {
                source: 'email',
                emailId: email.id,
                from: email.from,
                subject: email.subject,
                date: email.date
            }, 'email');
            return email;
        }
        catch (error) {
            console.error('Error getting email:', error);
            throw new Error('Failed to get email');
        }
    }
    static async sendEmail(userId, emailData) {
        try {
            const gmail = await this.getGmailClient(userId);
            const message = this.createEmailMessage(emailData);
            const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
            const params = {
                userId: 'me',
                requestBody: {
                    raw: encodedMessage
                }
            };
            if (emailData.threadId) {
                params.requestBody.threadId = emailData.threadId;
            }
            const response = await gmail.users.messages.send(params);
            return response.data.id;
        }
        catch (error) {
            console.error('Error sending email:', error);
            throw new Error('Failed to send email');
        }
    }
    static async replyToEmail(userId, threadId, subject, body) {
        try {
            const gmail = await this.getGmailClient(userId);
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
            return response.data.id;
        }
        catch (error) {
            console.error('Error replying to email:', error);
            throw new Error('Failed to reply to email');
        }
    }
    static async searchEmails(userId, query, maxResults = 20) {
        try {
            const gmail = await this.getGmailClient(userId);
            const response = await gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults
            });
            const messages = response.data.messages || [];
            const emailPromises = messages.map(async (message) => {
                const email = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id
                });
                return this.parseEmailMessage(email.data);
            });
            return await Promise.all(emailPromises);
        }
        catch (error) {
            console.error('Error searching emails:', error);
            throw new Error('Failed to search emails');
        }
    }
    static async getThread(userId, threadId) {
        try {
            const gmail = await this.getGmailClient(userId);
            const response = await gmail.users.threads.get({
                userId: 'me',
                id: threadId,
                format: 'full'
            });
            const messages = response.data.messages || [];
            return messages.map(message => this.parseEmailMessage(message));
        }
        catch (error) {
            console.error('Error getting thread:', error);
            throw new Error('Failed to get thread');
        }
    }
    static parseEmailMessage(message) {
        const headers = message.payload?.headers || [];
        const subject = headers.find((h) => h.name === 'Subject')?.value || '';
        const from = headers.find((h) => h.name === 'From')?.value || '';
        const to = headers.find((h) => h.name === 'To')?.value || '';
        const date = headers.find((h) => h.name === 'Date')?.value || '';
        let body = '';
        if (message.payload?.body?.data) {
            body = Buffer.from(message.payload.body.data, 'base64').toString();
        }
        else if (message.payload?.parts) {
            const textPart = message.payload.parts.find((part) => part.mimeType === 'text/plain' || part.mimeType === 'text/html');
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
    static createEmailMessage(emailData) {
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
    static async setupWebhook(userId, topic = 'https://www.googleapis.com/auth/gmail.readonly') {
        try {
            const gmail = await this.getGmailClient(userId);
            // Note: Gmail doesn't support traditional webhooks like other Google APIs
            // This would typically be implemented using Gmail API push notifications
            // or polling for new messages
            console.log(`Webhook setup requested for user ${userId} with topic ${topic}`);
        }
        catch (error) {
            console.error('Error setting up webhook:', error);
            throw new Error('Failed to setup webhook');
        }
    }
    static async refreshAccessToken(userId) {
        try {
            const result = await db_1.default.query('SELECT refresh_token FROM user_credentials WHERE user_id = $1 AND service = $2', [userId, 'google']);
            if (!result.rows.length) {
                throw new Error('Refresh token not found');
            }
            const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
            oauth2Client.setCredentials({
                refresh_token: result.rows[0].refresh_token
            });
            const { credentials } = await oauth2Client.refreshAccessToken();
            await db_1.default.query(`UPDATE user_credentials 
         SET access_token = $1, expires_at = $2, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3 AND service = $4`, [credentials.access_token, credentials.expiry_date, userId, 'google']);
        }
        catch (error) {
            console.error('Error refreshing access token:', error);
            throw new Error('Failed to refresh access token');
        }
    }
}
exports.GmailService = GmailService;
