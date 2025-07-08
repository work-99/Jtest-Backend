import { searchContacts } from './hubspot.service';
import { getUserInstructions } from './ai.service';
import { GmailService } from './gmail.service';
import pool from '../config/db';

const POLL_INTERVAL_MS = 30000; // 30 seconds
let lastProcessedContactIds: Record<string, string | null> = {};

async function getAllHubspotUserIds(): Promise<string[]> {
  const { rows } = await pool.query(
    "SELECT DISTINCT user_id FROM user_credentials WHERE service = 'hubspot'"
  );
  return rows.map(r => r.user_id.toString());
}

async function pollContacts() {
  const userIds = await getAllHubspotUserIds();
  for (const userId of userIds) {
    const contacts = await searchContacts(userId, '');
    if (!contacts.length) continue;
    const latestContact = contacts[0]; // Assuming sorted newest first
    if (latestContact.id === lastProcessedContactIds[userId]) continue;

    // Fetch instructions
    const instructions = await getUserInstructions(userId);
    const hasThankYou = instructions.some(instr =>
      instr.toLowerCase().includes('when i create a contact') &&
      instr.toLowerCase().includes('send them an email')
    );

    if (hasThankYou && latestContact.properties?.email) {
      // Send thank you email
      await GmailService.sendEmail(Number(userId), {
        to: latestContact.properties.email,
        subject: 'Thank you for being a client!',
        body: `Dear ${latestContact.properties.firstname || ''},\n\nThank you for being a client!\n\nBest regards,\nYour Advisor`
      });
      console.log(`[${userId}] Sent thank you email to new contact: ${latestContact.properties.email}`);
    }

    lastProcessedContactIds[userId] = latestContact.id;
  }
}

export function startContactPolling() {
  console.log('Contact polling started...');
  setInterval(() => {
    pollContacts().catch(err => console.error('Contact polling error:', err));
  }, POLL_INTERVAL_MS);
} 