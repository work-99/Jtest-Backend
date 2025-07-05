// services/ai.service.ts
import OpenAI from 'openai';
import pool from '../config/db';
import { RAGService } from './rag.service';
import { MessageModel } from '../modules/message.model';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const tools = [
  {
    type: 'function',
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
    type: 'function',
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
    // Get relevant context from RAG
    const context = await RAGService.getContextForUser(parseInt(userId), message);
    
    // Get recent conversation history
    const recentMessages = await MessageModel.getConversationContext(parseInt(userId), 'default', 5);
    
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

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages,
      tools,
      tool_choice: 'auto'
    });

    const { message: aiMessage, tool_calls } = response.choices[0];
    
    if (tool_calls && tool_calls.length > 0) {
      return handleToolCalls(userId, tool_calls, aiMessage);
    }

    return { text: aiMessage.content };
  } catch (error) {
    console.error('Error processing message:', error);
    return { text: 'I apologize, but I encountered an error processing your request. Please try again.' };
  }
};

const handleToolCalls = async (userId: string, toolCalls: any, aiMessage: any) => {
  const toolResponses = [];
  
  for (const toolCall of toolCalls) {
    const { name, arguments: args } = toolCall.function;
    let result;
    
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
    
    toolResponses.push({
      tool_call_id: toolCall.id,
      role: 'tool',
      name,
      content: JSON.stringify(result)
    });
  }

  // Send tool responses back to OpenAI
  const secondResponse = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      { role: 'assistant', content: aiMessage.content, tool_calls: toolCalls },
      ...toolResponses
    ]
  });

  return { 
    text: secondResponse.choices[0].message.content,
    actionRequired: toolResponses.some(r => r.name === 'schedule_appointment'),
    toolCalls: toolCalls
  };
};

const searchData = async (userId: string, query: string) => {
  try {
    const results = await RAGService.searchAll(parseInt(userId), query, 10);
    return {
      success: true,
      results: results.map(r => ({
        id: r.id,
        content: r.content.substring(0, 500) + '...',
        metadata: r.metadata,
        similarity: r.similarity
      }))
    };
  } catch (error) {
    console.error('Search data error:', error);
    return { success: false, error: 'Failed to search data' };
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