import { searchContacts } from './hubspot.service';
import { getUserInstructions } from './ai.service';
import { GmailService } from './gmail.service';
import pool from '../config/db';

const POLL_INTERVAL_MS = 30000; // 30 seconds
let lastProcessedContactIds: Record<string, string | null> = {};
let processedContactsInSession: Set<string> = new Set(); // Track contacts processed in current session

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
        
        // Check if we've already processed this contact (multiple checks to prevent duplicates)
        const contactKey = `${userId}-${latestContact.id}`;
        if (latestContact.id === lastProcessedContactIds[userId] || processedContactsInSession.has(contactKey)) {
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
          // Check database to see if we've already sent a thank you email to this contact
          const { rows } = await pool.query(
            'SELECT id FROM thank_you_emails WHERE user_id = $1 AND contact_id = $2',
            [userId, latestContact.id]
          );
          
          if (rows.length > 0) {
            console.log(`[ContactPoller] Already sent thank you email to contact ${latestContact.id} (${latestContact.properties.email})`);
            lastProcessedContactIds[userId] = latestContact.id;
            processedContactsInSession.add(contactKey);
            continue;
          }
          
          // Additional check: prevent sending multiple thank you emails to the same email address
          const emailKey = `${userId}-${latestContact.properties.email.toLowerCase()}`;
          if (processedContactsInSession.has(emailKey)) {
            console.log(`[ContactPoller] Already sent thank you email to ${latestContact.properties.email} in this session`);
            lastProcessedContactIds[userId] = latestContact.id;
            processedContactsInSession.add(contactKey);
            continue;
          }
          
          console.log(`[ContactPoller] Sending thank you email to ${latestContact.properties.email}`);
          
          // Send thank you email
          await GmailService.sendEmail(Number(userId), {
            to: latestContact.properties.email,
            subject: 'Thank you for being a client!',
            body: `Dear ${latestContact.properties.firstname || 'there'},\n\nThank you for being a client! We're excited to work with you.\n\nBest regards,\nYour Financial Advisor`
          });
          
          console.log(`[ContactPoller] ✅ Sent thank you email to new contact: ${latestContact.properties.email}`);
          
          // Record the sent email in database
          await pool.query(
            'INSERT INTO thank_you_emails (user_id, contact_id, email_address) VALUES ($1, $2, $3)',
            [userId, latestContact.id, latestContact.properties.email]
          );
          
          // Mark this email as processed
          processedContactsInSession.add(emailKey);
          
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
        
        // Mark this contact as processed (multiple tracking mechanisms)
        lastProcessedContactIds[userId] = latestContact.id;
        processedContactsInSession.add(contactKey);
        
      } catch (userError) {
        console.error(`[ContactPoller] Error processing user ${userId}:`, userError);
        
        // If it's an authentication error, log it but don't stop processing other users
        if (userError instanceof Error && userError.message && userError.message.includes('authentication expired')) {
          console.log(`[ContactPoller] User ${userId} needs to re-authenticate with Google`);
        }
        
        // Continue with next user instead of stopping the entire poll
        continue;
      }
    }
  } catch (error) {
    console.error('[ContactPoller] General polling error:', error);
  }
}

export function startContactPolling() {
  console.log('🔄 Contact polling started...');
  setInterval(() => {
    pollContacts().catch(err => {
      console.error('[ContactPoller] General polling error:', err);
      // Don't let errors stop the polling - it will retry on next interval
    });
  }, POLL_INTERVAL_MS);
} 