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
    return;
  const userIds = await getAllGmailUserIds();
  for (const userId of userIds) {
    const emails = await GmailService.listEmails(Number(userId), 1);
    if (emails.length === 0) continue;
    const email = emails[0];
    if (email.id === lastProcessedEmailIds[userId]) {
      // Already processed this email, do nothing
      continue;
    }
    // Process new email
    const contacts = await searchContacts(userId, email.from);
    const isInHubSpot = contacts.some(
      c => c.properties?.email?.toLowerCase() === email.from.toLowerCase()
    );
    if (!isInHubSpot) {
      const instructions = await getUserInstructions(userId);
      const eventData = {
        from: email.from,
        subject: email.subject,
        body: email.body,
        date: email.date
      };
      const result = await processProactiveEvent(userId, 'new_email', eventData, instructions);
      console.log(`[${userId}] Proactive agent result:`, result);
    }
    // Update last processed email ID after processing
    lastProcessedEmailIds[userId] = email.id;
  }
}

export function startEmailPolling() {
  console.log('Email polling started...');
  setInterval(() => {
    poll().catch(err => console.error('Polling error:', err));
  }, POLL_INTERVAL_MS);
} 