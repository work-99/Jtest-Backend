// services/ai.service.ts
import OpenAI from 'openai';
import pool from '../config/db';
import { RAGService } from './rag.service';
import { MessageModel } from '../modules/message.model';
import { GmailService } from './gmail.service';
import { getUpcomingEvents, getNextEvent } from './calendar.service';

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

const openai = new OpenAI({
  apiKey: "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"
});

const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'search_emails_and_contacts',
      description: 'Search through emails and HubSpot contacts',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'schedule_appointment',
      description: 'Schedule a calendar appointment',
      parameters: {
        type: 'object',
        properties: {
          contact_name: { type: 'string' },
          preferred_times: { 
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['contact_name']
      }
    }
  }
];

export const processMessage = async (userId: string, message: string) => {
  try {
    console.log('Processing message for user:', userId, 'Message:', message);
    
    // Check if this is an email query first
    const isEmailQuery = message.toLowerCase().includes('email') || 
                        message.toLowerCase().includes('mail') || 
                        message.toLowerCase().includes('gmail') ||
                        message.toLowerCase().includes('inbox') ||
                        message.toLowerCase().includes('recent');
    
    // Check if this is a calendar query
    const isCalendarQuery = message.toLowerCase().includes('calendar') || 
                           message.toLowerCase().includes('meeting') || 
                           message.toLowerCase().includes('event') ||
                           message.toLowerCase().includes('appointment') ||
                           message.toLowerCase().includes('schedule') ||
                           message.toLowerCase().includes('next');
    
    if (isEmailQuery) {
      console.log('Email query detected, fetching emails directly...');
      try {
        const emails = await GmailService.listEmails(parseInt(userId), 5);
        console.log(`Found ${emails.length} emails`);
        
        if (emails.length > 0) {
          let emailContent = 'Here are your recent emails:\n\n';
          emails.forEach((email, index) => {
            emailContent += `${index + 1}. **Subject**: ${email.subject}\n`;
            emailContent += `   **From**: ${email.from}\n`;
            emailContent += `   **Date**: ${email.date}\n`;
            emailContent += `   **Content**: ${email.snippet || email.body.substring(0, 200) + '...'}\n\n`;
          });
          
          return { text: emailContent };
        } else {
          return { text: "I couldn't find any recent emails in your inbox." };
        }
      } catch (emailError) {
        console.error('Error fetching emails:', emailError);
        return { text: "I'm having trouble accessing your emails right now. Please try again later." };
      }
    }
    
    if (isCalendarQuery) {
      console.log('Calendar query detected, fetching calendar events...');
      try {
        const events = await getUpcomingEvents(userId, 5);
        console.log(`Found ${events.length} calendar events`);
        
        if (events.length > 0) {
          let calendarContent = 'Here are your upcoming calendar events:\n\n';
          events.forEach((event, index) => {
            const startDate = event.start ? new Date(event.start).toLocaleString() : 'No start time';
            calendarContent += `${index + 1}. **Event**: ${event.summary}\n`;
            calendarContent += `   **Start**: ${startDate}\n`;
            if (event.location) {
              calendarContent += `   **Location**: ${event.location}\n`;
            }
            if (event.description) {
              calendarContent += `   **Description**: ${event.description.substring(0, 200)}...\n`;
            }
            calendarContent += '\n';
          });
          
          return { text: calendarContent };
        } else {
          return { text: "You don't have any upcoming calendar events." };
        }
      } catch (calendarError) {
        console.error('Error fetching calendar events:', calendarError);
        return { text: "I'm having trouble accessing your calendar right now. Please try again later." };
      }
    }
    
    // Get relevant context from RAG
    console.log('Getting context from RAG...');
    const context = await RAGService.getContextForUser(parseInt(userId), message);
    console.log('Context retrieved:', context.substring(0, 200) + '...');
    
    // Get recent conversation history
    console.log('Getting conversation context...');
    const recentMessages = await MessageModel.getConversationContext(parseInt(userId), 'default', 5);
    console.log('Recent messages count:', recentMessages.length);
    
    const systemPrompt = `You are a financial advisor assistant. You have access to the user's emails, calendar, and CRM. 
    
    Current context from user's data:
    ${context}
    
    Instructions:
    1. Use the provided context to answer questions about clients
    2. When asked to perform actions, use the available tools
    3. Be helpful, professional, and accurate
    4. If you don't have enough information, ask for clarification`;
    
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...recentMessages.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user' as const, content: message }
    ];

    console.log('Calling OpenAI API...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto'
    });

    const choice = response.choices[0];
    const aiMessage = choice.message;
    const toolCalls = choice.message.tool_calls;
    
    console.log('OpenAI response received, tool calls:', toolCalls?.length || 0);
    
    if (toolCalls && toolCalls.length > 0) {
      return handleToolCalls(userId, toolCalls, aiMessage);
    }

    return { text: aiMessage.content };
  } catch (error) {
    console.error('Error processing message:', error);
    console.error('Error stack:', (error as Error).stack);
    
    // Fallback response for quota exceeded or other errors
    if ((error as any).status === 429) {
      return {
        text: `I'm currently experiencing high demand and can't process your request right now. This is likely due to API rate limits. 

For now, I can help you with basic tasks. If you're trying to schedule an appointment, I can guide you through the process manually.

Please try again later or contact support if this issue persists.`
      };
    }
    
    return { text: 'I apologize, but I encountered an error processing your request. Please try again.' };
  }
};

const handleToolCalls = async (userId: string, toolCalls: any, aiMessage: any) => {
  const toolResponses = [];
  
  for (const toolCall of toolCalls) {
    const { name, arguments: args } = toolCall.function;
    let result;
    
    try {
      switch (name) {
        case 'search_emails_and_contacts':
          result = await searchData(userId, args.query);
          break;
        case 'schedule_appointment':
          result = await scheduleAppointment(userId, args.contact_name, args.preferred_times);
          break;
        default:
          result = { error: `Unknown tool: ${name}` };
      }
    } catch (error: any) {
      console.error(`Error executing tool ${name}:`, error);
      result = { error: `Failed to execute ${name}: ${error.message}` };
    }
    
    toolResponses.push({
      tool_call_id: toolCall.id,
      role: 'function' as const,
      name,
      content: JSON.stringify(result)
    });
  }

  try {
    console.log('Tool responses:', toolResponses.map(r => ({ id: r.tool_call_id, name: r.name })));
    
    // Create the messages array properly
    const messages = [
      { role: 'assistant' as const, content: aiMessage.content, tool_calls: toolCalls },
      ...toolResponses
    ];
    
    console.log('Sending messages to OpenAI:', messages.length);
    
    // Send tool responses back to OpenAI
    const secondResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages
    });

    return { 
      text: secondResponse.choices[0].message.content,
      actionRequired: toolResponses.some(r => r.name === 'schedule_appointment'),
      toolCalls: toolCalls
    };
  } catch (error: any) {
    console.error('Error in second OpenAI call:', error);
    console.error('Error details:', error.message);
    
    // If the error is about tool calls, try a simpler approach
    if (error.message && error.message.includes('tool_calls')) {
      console.log('Attempting fallback without tool calls...');
      try {
        const fallbackResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are a helpful financial advisor assistant. Provide a simple, helpful response.' },
            { role: 'user', content: 'The user asked about their data. Please provide a helpful response based on what you know.' }
          ]
        });
        
        return {
          text: fallbackResponse.choices[0].message.content,
          actionRequired: false,
          toolCalls: []
        };
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
    
    // Final fallback response
    return {
      text: "I found some information but encountered an issue processing it. Let me provide a simple response based on what I found.",
      actionRequired: false,
      toolCalls: []
    };
  }
};

const searchData = async (userId: string, query: string) => {
  try {
    console.log('Searching data for query:', query);
    
    // Check if query is about emails
    const isEmailQuery = query.toLowerCase().includes('email') || 
                        query.toLowerCase().includes('mail') || 
                        query.toLowerCase().includes('gmail') ||
                        query.toLowerCase().includes('inbox');
    
    if (isEmailQuery) {
      console.log('Email query detected, fetching recent emails...');
      try {
        const emails = await GmailService.listEmails(parseInt(userId), 10);
        console.log(`Found ${emails.length} emails`);
        
        return {
          success: true,
          type: 'emails',
          results: emails.map(email => ({
            id: email.id,
            subject: email.subject,
            from: email.from,
            date: email.date,
            snippet: email.snippet,
            body: email.body.substring(0, 500) + '...'
          }))
        };
      } catch (emailError) {
        console.error('Error fetching emails:', emailError);
        return {
          success: false,
          error: 'Failed to fetch emails',
          results: []
        };
      }
    }
    
    // For other queries, use RAG search
    const results = await RAGService.searchAll(parseInt(userId), query.trim(), 10);
    return {
      success: true,
      type: 'rag',
      results: results.map(r => ({
        id: r.id,
        content: r.content.substring(0, 500) + '...',
        metadata: r.metadata,
        similarity: r.similarity
      }))
    };
  } catch (error) {
    console.error('Search data error:', error);
    return { 
      success: false, 
      error: 'Failed to search data',
      results: []
    };
  }
};

const scheduleAppointment = async (userId: string, contactName: string, preferredTimes?: string[]) => {
  try {
    // TODO: Implement actual appointment scheduling
    // This would integrate with Google Calendar and send emails
    return {
      success: true,
      message: `Appointment scheduling request received for ${contactName}`,
      actionRequired: true,
      data: {
        contactName,
        preferredTimes,
        status: 'pending_confirmation'
      }
    };
  } catch (error) {
    console.error('Schedule appointment error:', error);
    return { success: false, error: 'Failed to schedule appointment' };
  }
};