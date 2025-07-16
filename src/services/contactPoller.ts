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
  try {
    const userIds = await getAllHubspotUserIds();
    console.log(`[ContactPoller] Checking ${userIds.length} users for new contacts...`);
    
    for (const userId of userIds) {
      try {
        console.log(`[ContactPoller] Checking user ${userId}...`);
        
        // Get contacts sorted by creation date (newest first)
        const contacts = await searchContacts(userId, '');
        if (!contacts.length) {
          console.log(`[ContactPoller] No contacts found for user ${userId}`);
          continue;
        }
        
        // Sort contacts by creation date to ensure newest first
        const sortedContacts = contacts.sort((a, b) => {
          const dateA = new Date(a.properties?.createdate || 0);
          const dateB = new Date(b.properties?.createdate || 0);
          return dateB.getTime() - dateA.getTime();
        });
        
        const latestContact = sortedContacts[0];
        console.log(`[ContactPoller] Latest contact for user ${userId}: ${latestContact.id} (${latestContact.properties?.email})`);
        
        // Check if we've already processed this contact
        if (latestContact.id === lastProcessedContactIds[userId]) {
          console.log(`[ContactPoller] Contact ${latestContact.id} already processed for user ${userId}`);
          continue;
        }
        
        // Check if this is a new contact (created in the last hour)
        const contactCreatedAt = new Date(latestContact.properties?.createdate || 0);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        if (contactCreatedAt < oneHourAgo) {
          console.log(`[ContactPoller] Contact ${latestContact.id} is not new (created: ${contactCreatedAt})`);
          lastProcessedContactIds[userId] = latestContact.id;
          continue;
        }
        
        console.log(`[ContactPoller] New contact detected: ${latestContact.id} for user ${userId}`);
        
        // Fetch instructions
        const instructions = await getUserInstructions(userId);
        console.log(`[ContactPoller] Found ${instructions.length} instructions for user ${userId}`);
        
        // More flexible instruction matching
        const hasThankYou = instructions.some(instr => {
          const lowerInstr = instr.toLowerCase();
          return (
            (lowerInstr.includes('create a contact') || lowerInstr.includes('new contact')) &&
            (lowerInstr.includes('send') || lowerInstr.includes('email')) &&
            (lowerInstr.includes('thank') || lowerInstr.includes('client'))
          );
        });
        
        console.log(`[ContactPoller] Has thank you instruction: ${hasThankYou}`);
        
        if (hasThankYou && latestContact.properties?.email) {
          console.log(`[ContactPoller] Sending thank you email to ${latestContact.properties.email}`);
          
          // Send thank you email
          await GmailService.sendEmail(Number(userId), {
            to: latestContact.properties.email,
            subject: 'Thank you for being a client!',
            body: `Dear ${latestContact.properties.firstname || 'there'},\n\nThank you for being a client! We're excited to work with you.\n\nBest regards,\nYour Financial Advisor`
          });
          
          console.log(`[ContactPoller] ✅ Sent thank you email to new contact: ${latestContact.properties.email}`);
          
          // Also trigger proactive agent for additional processing
          try {
            const { processProactiveEvent } = await import('./ai.service');
            const eventData = {
              contactId: latestContact.id,
              contactName: `${latestContact.properties?.firstname || ''} ${latestContact.properties?.lastname || ''}`.trim(),
              email: latestContact.properties?.email,
              phone: latestContact.properties?.phone,
              company: latestContact.properties?.company
            };
            
            const result = await processProactiveEvent(userId, 'new_contact', eventData, instructions);
            console.log(`[ContactPoller] Proactive agent result:`, result);
          } catch (proactiveError) {
            console.error(`[ContactPoller] Proactive agent error:`, proactiveError);
          }
        } else {
          console.log(`[ContactPoller] No thank you instruction found or no email address for contact ${latestContact.id}`);
        }
        
        // Mark this contact as processed
        lastProcessedContactIds[userId] = latestContact.id;
        
      } catch (userError) {
        console.error(`[ContactPoller] Error processing user ${userId}:`, userError);
      }
    }
  } catch (error) {
    console.error('[ContactPoller] General polling error:', error);
  }
}

export function startContactPolling() {
  console.log('🔄 Contact polling started...');
  setInterval(() => {
    pollContacts().catch(err => console.error('Contact polling error:', err));
  }, POLL_INTERVAL_MS);
} 