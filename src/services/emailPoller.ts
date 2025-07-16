import { GmailService } from './gmail.service';
import { searchContacts } from './hubspot.service';
import { processProactiveEvent, getUserInstructions } from './ai.service';
import pool from '../config/db';

const POLL_INTERVAL_MS = 30000; // 30 seconds

let lastProcessedEmailIds: Record<string, string | null> = {};

async function getAllGmailUserIds(): Promise<string[]> {
  const { rows } = await pool.query(
    "SELECT DISTINCT user_id FROM user_credentials WHERE service = 'google'"
  );
  return rows.map(r => r.user_id.toString());
}

async function poll() {
  const userIds = await getAllGmailUserIds();
  for (const userId of userIds) {
    try {
      console.log(`[EmailPoller] Checking user ${userId}...`);
      
      const emails = await GmailService.listEmails(Number(userId), 10); // Check 10 most recent emails
      if (emails.length === 0) {
        console.log(`[EmailPoller] No emails found for user ${userId}`);
        continue;
      }
      
      // Process each email that hasn't been processed yet
      let processedAny = false;
      for (const email of emails) {
        if (email.id === lastProcessedEmailIds[userId]) {
          // Already processed this email, stop processing older emails
          console.log(`[EmailPoller] Email ${email.id} already processed for user ${userId}, stopping`);
          break;
        }
        
        console.log(`[EmailPoller] Processing email for user ${userId}: ${email.subject} (ID: ${email.id})`);
        
        // Process new email
        // Extract email address from Gmail format (e.g., "Name <email@domain.com>" -> "email@domain.com")
        const emailMatch = email.from.match(/<(.+?)>/);
        const emailAddress = emailMatch ? emailMatch[1] : email.from;
        
        const contacts = await searchContacts(userId, emailAddress);
        const isInHubSpot = contacts.some(
          c => c.properties?.email?.toLowerCase() === emailAddress.toLowerCase()
        );
        
        if (!isInHubSpot) {
          console.log(`[EmailPoller] Contact not found for ${emailAddress}, triggering proactive agent`);
          const instructions = await getUserInstructions(userId);
          const eventData = {
            from: emailAddress,
            subject: email.subject,
            body: email.body,
            date: email.date
          };
          const result = await processProactiveEvent(userId, 'new_email', eventData, instructions);
          console.log(`[EmailPoller] Proactive agent result for user ${userId}:`, result);
        } else {
          console.log(`[EmailPoller] Contact already exists for ${emailAddress}`);
        }
        
        processedAny = true;
      }
      
      // Update last processed email ID to the most recent one
      if (processedAny) {
        lastProcessedEmailIds[userId] = emails[0].id;
      }
      
    } catch (error) {
      console.error(`[EmailPoller] Error processing user ${userId}:`, error);
      
      // If it's an authentication error, log it but don't stop processing other users
      if (error instanceof Error && error.message && error.message.includes('authentication expired')) {
        console.log(`[EmailPoller] User ${userId} needs to re-authenticate with Google`);
      }
      
      // Continue with next user instead of stopping the entire poll
      continue;
    }
  }
}

export function startEmailPolling() {
  console.log('Email polling started...');
  setInterval(() => {
    poll().catch(err => {
      console.error('[EmailPoller] General polling error:', err);
      // Don't let errors stop the polling - it will retry on next interval
    });
  }, POLL_INTERVAL_MS);
} 