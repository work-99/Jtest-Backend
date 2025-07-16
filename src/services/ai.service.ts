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
      tool_choice: 'auto',
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

Your capabilities include:
- Searching through emails and contacts using RAG
- Creating and managing HubSpot contacts
- Scheduling calendar events
- Sending emails
- Creating tasks
- Managing appointments

Available tools:
${toolRegistry.getAllTools().map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

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

  prompt += `\nAlways use the appropriate tools when needed. Be proactive and helpful. If a user asks about scheduling an appointment, use the schedule_appointment tool. If they ask about searching for information, use the search_emails_and_contacts tool.`;

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