import { GmailService } from './gmail.service';
import { searchContacts, createContact } from './hubspot.service';
import { getUpcomingEvents, createCalendarEvent, getAvailableTimes } from './calendar.service';
import { RAGService } from './rag.service';
import pool from '../config/db';

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  execute: (userId: string, params: any) => Promise<any>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  private registerDefaultTools() {
    // Search tools
    this.registerTool({
      name: 'search_emails_and_contacts',
      description: 'Search through emails and HubSpot contacts using RAG',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Maximum number of results', default: 5 }
        },
        required: ['query']
      },
      execute: async (userId: string, params: any) => {
        const results = await RAGService.searchAll(parseInt(userId), params.query, params.limit || 5);
        return {
          success: true,
          results: results.map(r => ({
            content: r.content,
            source: r.metadata?.source || 'unknown',
            similarity: 1 - r.similarity,
            metadata: r.metadata
          }))
        };
      }
    });

    // Contact management tools
    this.registerTool({
      name: 'create_hubspot_contact',
      description: 'Create a new contact in HubSpot',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Email address of the contact' },
          name: { type: 'string', description: 'Full name of the contact' },
          phone: { type: 'string', description: 'Phone number of the contact' }
        },
        required: ['email', 'name']
      },
      execute: async (userId: string, params: any) => {
        const [firstName, ...lastNameParts] = params.name.split(' ');
        const lastName = lastNameParts.join(' ');
        
        const contact = await createContact(userId, {
          email: params.email,
          firstname: firstName,
          lastname: lastName,
          phone: params.phone
        });

        return {
          success: true,
          contactId: contact.id,
          message: `Contact created successfully for ${params.name}`
        };
      }
    });

    this.registerTool({
      name: 'search_hubspot_contacts',
      description: 'Search for contacts in HubSpot',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (name, email, etc.)' },
          limit: { type: 'number', description: 'Maximum number of results', default: 10 }
        },
        required: ['query']
      },
      execute: async (userId: string, params: any) => {
        const contacts = await searchContacts(userId, params.query);
        return {
          success: true,
          contacts: contacts.slice(0, params.limit || 10).map(c => ({
            id: c.id,
            name: `${c.properties?.firstname || ''} ${c.properties?.lastname || ''}`.trim(),
            email: c.properties?.email,
            phone: c.properties?.phone,
            company: c.properties?.company
          }))
        };
      }
    });

    // Calendar tools
    this.registerTool({
      name: 'get_calendar_availability',
      description: 'Get available calendar times for scheduling',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          duration: { type: 'number', description: 'Duration in minutes', default: 60 }
        },
        required: ['date']
      },
      execute: async (userId: string, params: any) => {
        const availableTimes = await getAvailableTimes(userId, params.date, params.duration || 60);
        return {
          success: true,
          availableTimes,
          date: params.date,
          duration: params.duration || 60
        };
      }
    });

    this.registerTool({
      name: 'create_calendar_event',
      description: 'Create a calendar event',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Event title' },
          description: { type: 'string', description: 'Event description' },
          startTime: { type: 'string', description: 'Start time (ISO string)' },
          endTime: { type: 'string', description: 'End time (ISO string)' },
          attendees: { type: 'array', items: { type: 'string' }, description: 'List of attendee emails' },
          location: { type: 'string', description: 'Event location' }
        },
        required: ['summary', 'startTime', 'endTime']
      },
      execute: async (userId: string, params: any) => {
        const event = await createCalendarEvent(userId, {
          summary: params.summary,
          description: params.description,
          startTime: params.startTime,
          endTime: params.endTime,
          attendees: params.attendees || [],
          location: params.location
        });

        return {
          success: true,
          eventId: event.id,
          message: `Calendar event created: ${params.summary}`
        };
      }
    });

    // Email tools
    this.registerTool({
      name: 'send_email',
      description: 'Send an email using Gmail',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body content' },
          threadId: { type: 'string', description: 'Gmail thread ID for replies' }
        },
        required: ['to', 'subject', 'body']
      },
      execute: async (userId: string, params: any) => {
        const emailId = await GmailService.sendEmail(parseInt(userId), {
          to: params.to,
          subject: params.subject,
          body: params.body,
          threadId: params.threadId
        });

        return {
          success: true,
          emailId,
          message: `Email sent successfully to ${params.to}`
        };
      }
    });

    this.registerTool({
      name: 'search_emails',
      description: 'Search for emails in Gmail',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Maximum number of results', default: 10 }
        },
        required: ['query']
      },
      execute: async (userId: string, params: any) => {
        const emails = await GmailService.searchEmails(parseInt(userId), params.query, params.limit || 10);
        return {
          success: true,
          emails: emails.map(e => ({
            id: e.id,
            subject: e.subject,
            from: e.from,
            date: e.date,
            snippet: e.snippet
          }))
        };
      }
    });

    // Task management tools
    this.registerTool({
      name: 'create_task',
      description: 'Create a new task',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Task type' },
          data: { type: 'object', description: 'Task data' },
          priority: { type: 'string', description: 'Task priority', enum: ['low', 'medium', 'high'] }
        },
        required: ['type', 'data']
      },
      execute: async (userId: string, params: any) => {
        const result = await pool.query(
          `INSERT INTO tasks (user_id, type, status, data, priority)
           VALUES ($1, $2, 'pending', $3, $4)
           RETURNING *`,
          [userId, params.type, JSON.stringify(params.data), params.priority || 'medium']
        );

        return {
          success: true,
          taskId: result.rows[0].id,
          message: `Task created: ${params.type}`
        };
      }
    });

    // Appointment scheduling tool
    this.registerTool({
      name: 'schedule_appointment',
      description: 'Schedule an appointment with a contact',
      parameters: {
        type: 'object',
        properties: {
          contact_name: { type: 'string', description: 'Name of the contact' },
          preferred_times: { type: 'array', items: { type: 'string' }, description: 'Preferred meeting times' },
          duration: { type: 'number', description: 'Duration in minutes', default: 60 },
          subject: { type: 'string', description: 'Meeting subject' }
        },
        required: ['contact_name']
      },
      execute: async (userId: string, params: any) => {
        // This is a complex tool that orchestrates multiple actions
        // We'll implement the full workflow here
        return await this.executeAppointmentScheduling(userId, params);
      }
    });
  }

  private async executeAppointmentScheduling(userId: string, params: any) {
    try {
      // 1. Search for contact in HubSpot
      const contacts = await searchContacts(userId, params.contact_name);
      let contact = contacts.find(c => 
        c.properties?.firstname?.toLowerCase().includes(params.contact_name.toLowerCase()) ||
        c.properties?.lastname?.toLowerCase().includes(params.contact_name.toLowerCase()) ||
        `${c.properties?.firstname || ''} ${c.properties?.lastname || ''}`.toLowerCase().includes(params.contact_name.toLowerCase())
      );

      if (!contact) {
        return {
          success: false,
          error: `Contact "${params.contact_name}" not found in HubSpot. Please create the contact first.`
        };
      }

      // 2. Get available times
      const availableTimes = await getAvailableTimes(userId, new Date().toISOString().split('T')[0], params.duration || 60);

      // 3. Send email with available times
      const emailBody = this.generateAppointmentEmail(params.contact_name, availableTimes, params.subject);
      const emailId = await GmailService.sendEmail(parseInt(userId), {
        to: contact.properties?.email || '',
        subject: `Appointment Scheduling - ${params.subject || 'Meeting Request'}`,
        body: emailBody
      });

      // 4. Create task to monitor for response
      await pool.query(
        `INSERT INTO tasks (user_id, type, status, data)
         VALUES ($1, 'appointment_scheduling', 'waiting_for_response', $2)
         RETURNING *`,
        [userId, JSON.stringify({
          contactId: contact.id,
          contactName: params.contact_name,
          contactEmail: contact.properties?.email,
          emailId,
          availableTimes,
          duration: params.duration || 60,
          subject: params.subject,
          createdAt: new Date()
        })]
      );

      return {
        success: true,
        message: `Appointment scheduling initiated for ${params.contact_name}. Email sent with available times.`,
        contactId: contact.id,
        emailId
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to schedule appointment: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private generateAppointmentEmail(contactName: string, availableTimes: string[], subject?: string): string {
    const timesList = availableTimes.map(time => `- ${time}`).join('\n');
    
    return `Dear ${contactName},

I hope this email finds you well. I would like to schedule a meeting with you${subject ? ` to discuss ${subject}` : ''}.

Here are some available times that work for me:

${timesList}

Please let me know which time works best for you, or if you'd prefer a different time. I'm flexible and happy to accommodate your schedule.

Looking forward to our meeting!

Best regards,
Your Financial Advisor`;
  }

  registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolDefinitions() {
    return this.getAllTools().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  async executeTool(toolName: string, userId: string, params: any) {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    return await tool.execute(userId, params);
  }
}

export const toolRegistry = new ToolRegistry(); 