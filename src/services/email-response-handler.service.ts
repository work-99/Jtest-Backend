import { GmailService } from './gmail.service';
import { searchContacts, addContactNote } from './hubspot.service';
import { createCalendarEvent, getAvailableTimes } from './calendar.service';
import { processProactiveEvent } from './ai.service';
import { webSocketService } from './websocket.service';
import pool from '../config/db';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class EmailResponseHandler {
  
  // Process email responses for appointment scheduling
  static async processAppointmentResponse(userId: string, emailId: string, threadId: string) {
    try {
      // Get the email content
      const email = await GmailService.getEmail(parseInt(userId), emailId);
      
      // Analyze the response using AI
      const analysis = await this.analyzeAppointmentResponse(email.body);
      
      if (analysis.intent === 'accept_appointment') {
        await this.handleAppointmentAcceptance(userId, email, analysis);
      } else if (analysis.intent === 'decline_appointment') {
        await this.handleAppointmentDecline(userId, email, analysis);
      } else if (analysis.intent === 'request_different_time') {
        await this.handleTimeRequest(userId, email, analysis);
      } else {
        // Generic response - just acknowledge
        await this.sendAcknowledgment(userId, email, analysis);
      }
      
      // Update task status
      await this.updateAppointmentTask(userId, threadId, analysis.intent);
      
      // Send real-time update
      webSocketService.sendNotification(userId, {
        type: 'success',
        message: `Appointment response processed: ${analysis.intent}`,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Error processing appointment response:', error);
      throw error;
    }
  }
  
  // Analyze email response using AI
  private static async analyzeAppointmentResponse(emailBody: string) {
    const prompt = `
Analyze this email response to an appointment scheduling request. Determine the intent and extract relevant information.

Email: "${emailBody}"

Respond in JSON format:
{
  "intent": "accept_appointment|decline_appointment|request_different_time|other",
  "preferred_time": "time if mentioned",
  "reason": "reason for decline or request",
  "contact_name": "name if mentioned",
  "confidence": 0.9
}

Focus on:
- Whether they're accepting, declining, or requesting different times
- Any specific times they mention
- Their name if not already known
- Reasons for decline or time change
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0
    });

    try {
      const content = response.choices[0].message.content || '{}';
      return JSON.parse(content.replace(/```json\s*/g, '').replace(/```\s*/g, ''));
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return { intent: 'other', confidence: 0.5 };
    }
  }
  
  // Handle appointment acceptance
  private static async handleAppointmentAcceptance(userId: string, email: any, analysis: any) {
    try {
      // Find the appointment task
      const task = await this.findAppointmentTask(userId, email.threadId);
      if (!task) {
        throw new Error('Appointment task not found');
      }
      
      const taskData = task.data;
      const contactName = taskData.contactName;
      const subject = taskData.subject || 'Meeting';
      
      // Create calendar event
      const eventTime = this.parseTimeFromResponse(analysis.preferred_time, taskData.availableTimes);
      if (!eventTime) {
        throw new Error('Could not determine event time');
      }
      
      const event = await createCalendarEvent(userId, {
        summary: `${subject} with ${contactName}`,
        description: `Appointment scheduled via email response`,
        startTime: eventTime.start,
        endTime: eventTime.end,
        attendees: [email.from]
      });
      
      // Send confirmation email
      const confirmationBody = this.generateConfirmationEmail(contactName, eventTime, subject);
      await GmailService.sendEmail(parseInt(userId), {
        to: email.from,
        subject: `Confirmed: ${subject}`,
        body: confirmationBody,
        threadId: email.threadId
      });
      
      // Add note to HubSpot contact
      const contacts = await searchContacts(userId, contactName);
      if (contacts.length > 0) {
        const contact = contacts[0];
        await addContactNote(userId, contact.id, 
          `Appointment confirmed for ${subject} on ${eventTime.start}. Scheduled via email response.`
        );
      }
      
      console.log(`Appointment confirmed for ${contactName}`);
      
    } catch (error) {
      console.error('Error handling appointment acceptance:', error);
      throw error;
    }
  }
  
  // Handle appointment decline
  private static async handleAppointmentDecline(userId: string, email: any, analysis: any) {
    try {
      const task = await this.findAppointmentTask(userId, email.threadId);
      if (!task) {
        throw new Error('Appointment task not found');
      }
      
      const taskData = task.data;
      const contactName = taskData.contactName;
      
      // Send acknowledgment
      const declineBody = this.generateDeclineAcknowledgment(contactName, analysis.reason);
      await GmailService.sendEmail(parseInt(userId), {
        to: email.from,
        subject: 'Re: Appointment Scheduling',
        body: declineBody,
        threadId: email.threadId
      });
      
      // Add note to HubSpot
      const contacts = await searchContacts(userId, contactName);
      if (contacts.length > 0) {
        const contact = contacts[0];
        await addContactNote(userId, contact.id, 
          `Appointment declined. Reason: ${analysis.reason || 'Not specified'}`
        );
      }
      
    } catch (error) {
      console.error('Error handling appointment decline:', error);
      throw error;
    }
  }
  
  // Handle time change request
  private static async handleTimeRequest(userId: string, email: any, analysis: any) {
    try {
      const task = await this.findAppointmentTask(userId, email.threadId);
      if (!task) {
        throw new Error('Appointment task not found');
      }
      
      const taskData = task.data;
      const contactName = taskData.contactName;
      
      // Get new available times
      const newAvailableTimes = await getAvailableTimes(userId, new Date().toISOString().split('T')[0], taskData.duration || 60);
      
      // Send new times
      const newTimesBody = this.generateNewTimesEmail(contactName, newAvailableTimes, analysis.reason);
      await GmailService.sendEmail(parseInt(userId), {
        to: email.from,
        subject: 'Re: Appointment Scheduling - New Available Times',
        body: newTimesBody,
        threadId: email.threadId
      });
      
      // Update task with new times
      await pool.query(
        `UPDATE tasks SET data = $1 WHERE id = $2`,
        [JSON.stringify({ ...taskData, availableTimes: newAvailableTimes }), task.id]
      );
      
    } catch (error) {
      console.error('Error handling time request:', error);
      throw error;
    }
  }
  
  // Send generic acknowledgment
  private static async sendAcknowledgment(userId: string, email: any, analysis: any) {
    const acknowledgmentBody = `Thank you for your response. I'll review it and get back to you shortly.`;
    
    await GmailService.sendEmail(parseInt(userId), {
      to: email.from,
      subject: 'Re: Appointment Scheduling',
      body: acknowledgmentBody,
      threadId: email.threadId
    });
  }
  
  // Helper methods
  private static async findAppointmentTask(userId: string, threadId: string) {
    const result = await pool.query(
      `SELECT * FROM tasks WHERE user_id = $1 AND type = 'appointment_scheduling' AND data->>'emailId' = $2`,
      [userId, threadId]
    );
    return result.rows[0];
  }
  
  private static async updateAppointmentTask(userId: string, threadId: string, status: string) {
    await pool.query(
      `UPDATE tasks SET status = 'completed', result = $1 WHERE user_id = $1 AND type = 'appointment_scheduling' AND data->>'emailId' = $2`,
      [userId, JSON.stringify({ responseStatus: status }), threadId]
    );
  }
  
  private static parseTimeFromResponse(preferredTime: string, availableTimes: string[]) {
    if (!preferredTime) return null;
    
    // Simple time parsing - in production, use a more robust library
    const time = preferredTime.toLowerCase();
    const availableTime = availableTimes.find(t => 
      t.toLowerCase().includes(time) || time.includes(t.toLowerCase())
    );
    
    if (availableTime) {
      const date = new Date();
      const [timeStr, period] = availableTime.split(' ');
      const [hours, minutes] = timeStr.split(':').map(Number);
      
      let hour = hours;
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      
      date.setHours(hour, minutes, 0, 0);
      const endDate = new Date(date.getTime() + 60 * 60 * 1000); // 1 hour later
      
      return {
        start: date.toISOString(),
        end: endDate.toISOString()
      };
    }
    
    return null;
  }
  
  private static generateConfirmationEmail(contactName: string, eventTime: any, subject: string) {
    const startTime = new Date(eventTime.start).toLocaleString();
    
    return `Dear ${contactName},

Great! I'm confirming our appointment for ${subject}.

Meeting Details:
- Date & Time: ${startTime}
- Duration: 1 hour

I've added this to my calendar and will send you a calendar invitation shortly.

Looking forward to our meeting!

Best regards,
Your Financial Advisor`;
  }
  
  private static generateDeclineAcknowledgment(contactName: string, reason: string) {
    return `Dear ${contactName},

Thank you for letting me know. I understand that the proposed times don't work for you${reason ? ` due to ${reason}` : ''}.

Please feel free to reach out when you have more availability, and I'll be happy to schedule a meeting at a time that works better for you.

Best regards,
Your Financial Advisor`;
  }
  
  private static generateNewTimesEmail(contactName: string, availableTimes: string[], reason: string) {
    const timesList = availableTimes.map(time => `- ${time}`).join('\n');
    
    return `Dear ${contactName},

I understand that the previous times didn't work for you${reason ? ` due to ${reason}` : ''}. Here are some new available times:

${timesList}

Please let me know which of these times works for you, or if you'd prefer a different date.

Best regards,
Your Financial Advisor`;
  }
} 