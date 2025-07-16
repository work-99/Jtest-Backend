// services/ai.service.ts
import OpenAI from 'openai';
import pool from '../config/db';
import { RAGService } from './rag.service';
import { MessageModel } from '../modules/message.model';
import { GmailService } from './gmail.service';
import { getUpcomingEvents, getNextEvent } from './calendar.service';
import { searchContacts } from './hubspot.service';
import { distance } from 'fastest-levenshtein';
import { toolRegistry } from './tool-registry.service';
import { webSocketService } from './websocket.service';
import type {
  ChatCompletionUserMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionMessageParam
} from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const processMessage = async (userId: string, message: string) => {
  try {
    // Get user's ongoing instructions for context
    const userInstructions = await getUserInstructions(userId);
    
    // Get conversation history for context
    const conversationHistory = await MessageModel.getRecentConversations(parseInt(userId), 10);
    
    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(userInstructions, conversationHistory);
    
    // Get tool definitions from registry
    const tools = toolRegistry.getToolDefinitions();
    
    // Check if this is a tool-specific request and force tool usage
    const forceToolUsage = shouldForceToolUsage(message);
    
    // Create messages array
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    // Process with OpenAI using tool calling
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: forceToolUsage ? 'auto' : 'auto',
      max_tokens: 2000,
      temperature: 0.7
    });

    const aiMessage = response.choices[0].message;
    let finalResponse = aiMessage.content || '';
    let toolCalls: any[] = [];
    let actionRequired = false;

    // Handle tool calls if any
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      toolCalls = aiMessage.tool_calls;
      actionRequired = true;
      
      // Execute each tool call
      const toolResults = [];
      for (const toolCall of aiMessage.tool_calls) {
        try {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          console.log(`Executing tool: ${toolName} with args:`, toolArgs);
          
          const result = await toolRegistry.executeTool(toolName, userId, toolArgs);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool' as const,
            content: JSON.stringify(result)
          });
          
          console.log(`Tool ${toolName} result:`, result);
        } catch (error) {
          console.error(`Error executing tool ${toolCall.function.name}:`, error);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool' as const,
            content: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })
          });
        }
      }

      // If we have tool results, make another call to get the final response
      if (toolResults.length > 0) {
        const followUpMessages = [...messages, aiMessage, ...toolResults];
        
        const followUpResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: followUpMessages,
          max_tokens: 1000,
          temperature: 0.7
        });

        finalResponse = followUpResponse.choices[0].message.content || '';
      }
    } else if (forceToolUsage) {
      // If we expected tool usage but didn't get any, try to force it
      console.log('Expected tool usage but none received, attempting to force...');
      const forcedResult = await forceToolExecution(userId, message);
      if (forcedResult) {
        finalResponse = forcedResult.text;
        actionRequired = forcedResult.actionRequired;
        toolCalls = forcedResult.toolCalls;
      }
    }

    // Send real-time update if user is online
    if (webSocketService.isUserOnline(userId)) {
      webSocketService.sendChatMessage(userId, {
        role: 'assistant',
        content: finalResponse,
        toolCalls,
        actionRequired
      });
    }

    return {
      text: finalResponse,
      actionRequired,
      toolCalls
    };
  } catch (error) {
    console.error('Error in processMessage:', error);
    return { 
      text: "An error occurred while processing your request. Please try again.",
      actionRequired: false,
      toolCalls: []
    };
  }
};

function buildSystemPrompt(userInstructions: string[], conversationHistory: any[]): string {
  let prompt = `You are an AI assistant for a financial advisor. You have access to various tools to help manage clients, schedule appointments, and handle communications.

IMPORTANT: You MUST use tools when appropriate. Do not ask for information that you can get through tools.

Your capabilities include:
- Searching through emails and contacts using RAG
- Creating and managing HubSpot contacts
- Scheduling calendar events
- Sending emails
- Creating tasks
- Managing appointments

Available tools:
${toolRegistry.getAllTools().map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

CRITICAL INSTRUCTIONS:
1. When a user asks to schedule an appointment, ALWAYS use the schedule_appointment tool immediately
2. When a user asks to search for information, ALWAYS use the search_emails_and_contacts tool
3. When a user asks to create a contact, ALWAYS use the create_hubspot_contact tool
4. When a user asks to send an email, ALWAYS use the send_email tool
5. Do NOT ask for additional information unless absolutely necessary
6. Use tools proactively to gather information and take action

Examples:
- "Schedule an appointment with John" → Use schedule_appointment tool
- "Who mentioned baseball?" → Use search_emails_and_contacts tool
- "Create a contact for jane@example.com" → Use create_hubspot_contact tool
- "Send an email to john@example.com" → Use send_email tool

`;

  if (userInstructions.length > 0) {
    prompt += `\nOngoing instructions to follow:\n${userInstructions.map(instruction => `- ${instruction}`).join('\n')}\n`;
  }

  if (conversationHistory.length > 0) {
    prompt += `\nRecent conversation context:\n`;
    conversationHistory.forEach(conv => {
      if (conv.messages && conv.messages.length > 0) {
        const lastMessage = conv.messages[conv.messages.length - 1];
        prompt += `- ${lastMessage.role}: ${lastMessage.content.substring(0, 100)}...\n`;
      }
    });
  }

  prompt += `\nRemember: ALWAYS use tools when appropriate. Do not ask for information you can get through tools. Be proactive and take action directly.`;

  return prompt;
}

// Enhanced proactive event processing
export async function processProactiveEvent(
  userId: string,
  eventType: string,
  eventData: any,
  instructions?: string[]
): Promise<{ text: string | null; actionRequired: boolean; toolCalls: any[] }> {
  try {
    // Get user instructions if not provided
  let userInstructions = instructions;
  if (!userInstructions) {
    userInstructions = await getUserInstructions(userId);
  }

    // Build proactive prompt
    const prompt = `You are a proactive AI assistant. An event has occurred that may require action:

Event Type: ${eventType}
Event Data: ${JSON.stringify(eventData, null, 2)}

Ongoing Instructions:
${userInstructions.map(i => `- ${i}`).join('\n')}

Based on the event and ongoing instructions, determine if any action is needed. Use the appropriate tools to take action.`;

    const tools = toolRegistry.getToolDefinitions();

  const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: `Process this ${eventType} event and take appropriate action if needed.` }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 1000,
      temperature: 0.7
    });

    const aiMessage = response.choices[0].message;
    let finalResponse = aiMessage.content || '';
    let toolCalls: any[] = [];
    let actionRequired = false;

    // Handle tool calls
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      toolCalls = aiMessage.tool_calls;
      actionRequired = true;
      
      const toolResults = [];
      for (const toolCall of aiMessage.tool_calls) {
        try {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          console.log(`Proactive tool execution: ${toolName}`, toolArgs);
          
          const result = await toolRegistry.executeTool(toolName, userId, toolArgs);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool' as const,
            content: JSON.stringify(result)
          });
        } catch (error) {
          console.error(`Error in proactive tool execution:`, error);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool' as const,
            content: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })
      });
    }
  }

      // Get final response
      if (toolResults.length > 0) {
        const followUpMessages = [...messages, aiMessage, ...toolResults];
        
        const followUpResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
          messages: followUpMessages,
      max_tokens: 500,
          temperature: 0.7
        });

        finalResponse = followUpResponse.choices[0].message.content || '';
      }
    }

    // Send proactive update if user is online
    if (webSocketService.isUserOnline(userId)) {
      webSocketService.sendProactiveUpdate(userId, {
        eventType,
        eventData,
        response: finalResponse,
        actionRequired,
        toolCalls
      });
    }

    return {
      text: finalResponse,
      actionRequired,
      toolCalls
    };
  } catch (error) {
    console.error('Error in processProactiveEvent:', error);
    return {
      text: null,
      actionRequired: false,
      toolCalls: []
    };
  }
}

// Save user instruction
export async function saveUserInstruction(userId: string, instruction: string) {
  await pool.query(
    'INSERT INTO user_instructions (user_id, instruction) VALUES ($1, $2)',
    [userId, instruction]
  );
}

// Get user instructions
export async function getUserInstructions(userId: string): Promise<string[]> {
  const result = await pool.query(
    'SELECT instruction FROM user_instructions WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows.map(row => row.instruction);
}

// Helper function to determine if we should force tool usage
function shouldForceToolUsage(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Appointment scheduling patterns
  if (lowerMessage.includes('schedule') && (lowerMessage.includes('appointment') || lowerMessage.includes('meeting'))) {
    return true;
  }
  
  // Search patterns
  if (lowerMessage.includes('who') || lowerMessage.includes('find') || lowerMessage.includes('search')) {
    return true;
  }
  
  // Contact creation patterns
  if (lowerMessage.includes('create') && lowerMessage.includes('contact')) {
    return true;
  }
  
  // Email sending patterns
  if (lowerMessage.includes('send') && lowerMessage.includes('email')) {
    return true;
  }
  
  return false;
}

// Force tool execution for specific patterns
async function forceToolExecution(userId: string, message: string) {
  const lowerMessage = message.toLowerCase();
  
  try {
    // Appointment scheduling
    if (lowerMessage.includes('schedule') && (lowerMessage.includes('appointment') || lowerMessage.includes('meeting'))) {
      // Extract contact name
      const contactMatch = message.match(/with\s+([A-Za-z\s]+)/i);
      if (contactMatch) {
        const contactName = contactMatch[1].trim();
        console.log(`Forcing appointment scheduling for: ${contactName}`);
        
        const result = await toolRegistry.executeTool('schedule_appointment', userId, {
          contact_name: contactName
        });
        
        return {
          text: result.success ? result.message : `Failed to schedule appointment: ${result.error}`,
          actionRequired: result.success,
          toolCalls: [{
            function: { name: 'schedule_appointment', arguments: JSON.stringify({ contact_name: contactName }) }
          }]
        };
      }
    }
    
    // Search queries
    if (lowerMessage.includes('who') || lowerMessage.includes('find') || lowerMessage.includes('search')) {
      console.log(`Forcing search for: ${message}`);
      
      const result = await toolRegistry.executeTool('search_emails_and_contacts', userId, {
        query: message
      });
      
      return {
        text: result.success ? `Here's what I found:\n${result.results.map((r: any) => `- ${r.content.substring(0, 200)}...`).join('\n')}` : 'Search failed',
        actionRequired: false,
        toolCalls: [{
          function: { name: 'search_emails_and_contacts', arguments: JSON.stringify({ query: message }) }
        }]
      };
    }
    
  } catch (error) {
    console.error('Error in forced tool execution:', error);
  }
  
  return null;
}