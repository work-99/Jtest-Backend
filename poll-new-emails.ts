import { GmailService } from './src/services/gmail.service';
import { searchContacts } from './src/services/hubspot.service';
import { processProactiveEvent } from './src/services/ai.service';
import pool from './src/config/db';

const USER_ID = 2; // <-- Replace with your actual user ID

async function getOngoingInstructions(userId: string) {
  const { rows } = await pool.query(
    `SELECT instruction FROM ongoing_instructions WHERE user_id = $1 AND is_active = true`,
    [userId]
  );
  return rows.map(r => r.instruction);
}

async function poll() {
  // Get the latest 5 emails
  const emails = await GmailService.listEmails(USER_ID, 1);

  for (const email of emails) {
    // Check if sender is in HubSpot
    const contacts = await searchContacts(USER_ID.toString(), email.from);
    const isInHubSpot = contacts.some(
      c => c.properties?.email?.toLowerCase() === email.from.toLowerCase()
    );
    if (!isInHubSpot) {
      // Get ongoing instructions
      const instructions = await getOngoingInstructions(USER_ID.toString());
      // Call the proactive agent
      const eventData = {
        from: email.from,
        subject: email.subject,
        body: email.body,
        date: email.date
      };
      const result = await processProactiveEvent(USER_ID.toString(), 'new_email', eventData, instructions);
      console.log('Proactive agent result:', result);
    }
  }
}

poll().catch(console.error); 