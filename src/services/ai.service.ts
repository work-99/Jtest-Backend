// services/ai.service.ts
import OpenAI from 'openai';
import pool from '../config/db';
import { RAGService } from './rag.service';
import { MessageModel } from '../modules/message.model';
import { GmailService } from './gmail.service';
import { getUpcomingEvents, getNextEvent } from './calendar.service';
import { searchContacts } from './hubspot.service';
import { distance } from 'fastest-levenshtein';
import type {
  ChatCompletionUserMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionMessageParam
} from 'openai/resources/chat/completions';

const hubspotService = require('./hubspot.service');
console.log('[AI] hubspotService module (top-level):', hubspotService);
console.log('[AI] hubspotService.createContact (top-level):', typeof hubspotService.createContact);

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_hubspot_contact',
      description: 'Create a new contact in HubSpot with a note about the email',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Email address of the contact' },
          name: { type: 'string', description: 'Full name of the contact' },
          note: { type: 'string', description: 'A note about the email or context' },
          phone: { type: 'string', description: 'Phone number of the contact', nullable: true }
        },
        required: ['email', 'name', 'note']
      }
    }
  }
];

export const processMessage = async (userId: string, message: string) => {
  try {
    // Use OpenAI to classify intent and extract entities
    const intentPrompt = `
You are an assistant that classifies user requests and extracts relevant entities for a CRM/chatbot.
Given the following user message, extract the intent and any relevant fields.
Message: "${message}"
Respond ONLY in JSON: { "intent": "...", "contact_name": "...", "email": "...", "instruction": "...", "other": "..." }

Possible intents:
- "schedule_appointment": When user wants to schedule a meeting/appointment with someone
- "add_contact": When user wants to add a new contact to CRM
- "query_email": When user asks about emails
- "query_calendar": When user asks about calendar/events
- "query_contacts": When user asks about contacts
- "general_question": When user asks general questions about their data (e.g. "Who mentioned their kid plays baseball?")
- "set_instruction": For ongoing/proactive instructions (e.g. 'When I create a contact...', 'When someone emails me...')
- "other": For anything else

For appointment scheduling, extract the contact name from phrases like "schedule with [name]", "appointment with [name]", "meeting with [name]", etc.
If the message is an ongoing or proactive instruction, set intent to "set_instruction" and put the full instruction in the "instruction" field. Do NOT try to extract contact_name or email for such instructions.
`;

    const intentResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: intentPrompt }
      ],
      max_tokens: 100,
      temperature: 0
    });

    console.log('Intent classification response:', intentResponse.choices[0].message.content);
    
    let intentParsed;
    try {
      // Clean the response by removing markdown code blocks if present
      let cleanResponse = intentResponse.choices[0].message.content || '{}';
      cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      console.log('Cleaned response:', cleanResponse);
      
      intentParsed = JSON.parse(cleanResponse);
      console.log('Parsed intent:', intentParsed);
    } catch (parseError) {
      console.error('Intent JSON parse error:', parseError);
      console.error('Raw intent response:', intentResponse.choices[0].message.content);
      intentParsed = { intent: 'other' };
    }

    switch (intentParsed.intent) {
      case 'schedule_appointment':
        return await handleAppointmentScheduling(userId, message);
      case 'add_contact':
        if (intentParsed.contact_name && intentParsed.email) {
          return await handleAddContact(userId, intentParsed.contact_name, intentParsed.email);
        } else {
          return { text: "I couldn't extract the contact name or email. Please try again." };
        }
      case 'query_email': {
        // Use RAG to search for relevant emails based on the query
        const searchResults = await RAGService.searchSimilar(parseInt(userId), message, 5, 'email');
        if (searchResults.length > 0) {
          let emailContent = 'Here are the most relevant emails I found:\n\n';
          searchResults.forEach((result, index) => {
            const metadata = result.metadata;
            emailContent += `${index + 1}. **Subject**: ${metadata.subject || 'No subject'}\n`;
            emailContent += `   **From**: ${metadata.from || 'Unknown'}\n`;
            emailContent += `   **Date**: ${metadata.date || 'Unknown'}\n`;
            emailContent += `   **Relevance**: ${Math.round((1 - result.similarity) * 100)}%\n`;
            emailContent += `   **Content**: ${result.content.substring(0, 300)}...\n\n`;
          });
          return { text: emailContent };
        } else {
          return { text: "I couldn't find any relevant emails matching your query." };
        }
      }
      case 'query_calendar': {
        const events = await getUpcomingEvents(userId, 5);
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
      }
      case 'query_contacts': {
        const contacts = await searchContacts(userId, '');
        if (contacts.length > 0) {
          let contactContent = 'Here are your HubSpot contacts:\n\n';
          contacts.forEach((contact, index) => {
            const firstName = contact.properties?.firstname || '';
            const lastName = contact.properties?.lastname || '';
            const email = contact.properties?.email || 'No email';
            const phone = contact.properties?.phone || 'No phone';
            contactContent += `${index + 1}. **Name**: ${firstName} ${lastName}\n`;
            contactContent += `   **Email**: ${email}\n`;
            contactContent += `   **Phone**: ${phone}\n`;
            contactContent += `   **ID**: ${contact.id}\n\n`;
          });
          return { text: contactContent };
        } else {
          return { text: "You don't have any contacts in your HubSpot CRM yet." };
        }
      }
      case 'general_question':
        return await handleGeneralQuestion(userId, message);
      case 'set_instruction':
        if (intentParsed.instruction) {
          await saveUserInstruction(userId, intentParsed.instruction);
          return { text: `Instruction saved: "${intentParsed.instruction}"` };
        } else {
          return { text: "I couldn't extract the instruction. Please try again." };
        }
      default:
        return { text: "I'm not sure how to help with that. Please try rephrasing your request." };
    }
  } catch (error) {
    console.error('Error in processMessage:', error);
    return { text: "An error occurred while processing your request." };
  }
};

const handleAppointmentScheduling = async (userId: string, message: string) => {
  try {
    console.log('Handling appointment scheduling request...');
    
    // 1. Use OpenAI to extract contact name and intent
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { 
          role: 'system', 
          content: 'You are an assistant that extracts contact names from appointment scheduling requests. Always respond with valid JSON in this exact format: {"contact_name": "Full Name"}. Extract ONLY the first and last name of the person the user wants to schedule an appointment with. Ignore any additional words like "hi", "hello", "please", etc. For example, "Schedule with John Smith hi" should extract "John Smith".' 
        },
        { 
          role: 'user', 
          content: `Extract the contact name from this appointment request: "${message}"` 
        }
      ],
      max_tokens: 50,
      temperature: 0
    });
    
    console.log('OpenAI response:', aiResponse.choices[0].message.content);
    
    let parsed;
    try {
      // Clean the response by removing markdown code blocks if present
      let cleanResponse = aiResponse.choices[0].message.content || '{}';
      cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      console.log('Cleaned response:', cleanResponse);
      
      parsed = JSON.parse(cleanResponse);
      console.log('Parsed response:', parsed);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw response:', aiResponse.choices[0].message.content);
      return { text: "Sorry, I couldn't understand the appointment request." };
    }
    
    if (!parsed.contact_name) {
      console.log('No contact_name found in parsed response:', parsed);
      return { text: "Sorry, I couldn't find the contact name in your request." };
    }
    
    const contactName = parsed.contact_name;
    console.log('Looking for contact:', contactName);
    console.log('User ID for contact search:', userId);
    // 2. Search HubSpot contacts for the name
    const contacts = await searchContacts(userId, contactName);
    console.log('Contacts returned from searchContacts:', JSON.stringify(contacts, null, 2));
    if (!contacts.length) {
      return { text: `I couldn't find a contact named "${contactName}" in HubSpot.` };
    }
    
    // Find the best matching contact with scoring
    const scoredContacts = contacts.map(contact => {
      const firstName = contact.properties?.firstname || '';
      const lastName = contact.properties?.lastname || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const email = contact.properties?.email || '';
      
      let score = 0;
      const searchName = contactName.toLowerCase();
      const contactNameLower = fullName.toLowerCase();
      
      // Exact match gets highest score
      if (contactNameLower === searchName) {
        score += 100;
      }
      
      // Contains the full search name
      if (contactNameLower.includes(searchName)) {
        score += 50;
      }
      
      // Search name contains the contact name
      if (searchName.includes(contactNameLower)) {
        score += 30;
      }
      
      // Individual token matches
      const searchTokens = searchName.split(/\s+/);
      const contactTokens = contactNameLower.split(/\s+/);
      
      searchTokens.forEach((token: string) => {
        if (contactTokens.includes(token)) {
          score += 10;
        }
        if (firstName.toLowerCase().includes(token)) {
          score += 8;
        }
        if (lastName.toLowerCase().includes(token)) {
          score += 8;
        }
      });
      
      // Bonus for having email
      if (email) {
        score += 5;
      }
      
      return { contact, score, fullName, email };
    });
    
    // Sort by score (highest first) and log all matches
    scoredContacts.sort((a, b) => b.score - a.score);
    console.log('Contact matches found (scored):', JSON.stringify(scoredContacts, null, 2));
    
    // Get the best match
    const bestMatch = scoredContacts[0];
    if (!bestMatch || bestMatch.score < 5) {
      const contactList = scoredContacts.slice(0, 5).map(match => 
        `${match.fullName} (${match.email})`
      ).join(', ');
      return { 
        text: `I found several contacts but none that clearly match "${contactName}". Found: ${contactList}. Please try a more specific name.` 
      };
    }
    
    console.log(`Selected contact: ${bestMatch.fullName} (${bestMatch.email}) with score ${bestMatch.score}`);
    const contact = bestMatch.contact;
    const contactEmail = contact.properties?.email;
    const firstName = contact.properties?.firstname || '';
    const lastName = contact.properties?.lastname || '';
    const fullName = `${firstName} ${lastName}`.trim();
    if (!contactEmail) {
      return { text: `I found the contact "${fullName}" but they don't have an email address in your CRM. Please add their email address first.` };
    }
    console.log('Found contact:', fullName, 'Email:', contactEmail, 'User ID:', userId);
    // 3. Fetch available calendar times
    const availableTimes = await getAvailableTimes(userId);
    if (!availableTimes || availableTimes.length === 0) {
      return { text: `I couldn't find any available times in your calendar for the next few days. Please check your calendar and try again.` };
    }
    console.log('Available times:', availableTimes);
    // 4. Send email invitation
    const emailSubject = `Appointment Scheduling - Available Times`;
    const emailBody = generateAppointmentEmail(fullName, availableTimes);
    const emailResult = await GmailService.sendEmail(parseInt(userId), {
      to: contactEmail,
      subject: emailSubject,
      body: emailBody
    });
    console.log('Email sent successfully:', emailResult);
    return { text: `I emailed ${fullName} (${contactEmail}) with available times.` };
  } catch (error) {
    console.error('Error in handleAppointmentScheduling:', error);
    return { text: "An error occurred while scheduling the appointment." };
  }
};

const getAvailableTimes = async (userId: string): Promise<string[]> => {
  try {
    // Get upcoming events for the next 7 days
    const events = await getUpcomingEvents(userId, 50); // Get more events to analyze
    
    // Create time slots for the next 7 days (9 AM to 5 PM)
    const availableSlots = [];
    const now = new Date();
    
    for (let day = 0; day < 7; day++) {
      const currentDate = new Date(now);
      currentDate.setDate(currentDate.getDate() + day);
      currentDate.setHours(9, 0, 0, 0); // Start at 9 AM
      
      // Skip weekends
      if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        continue;
      }
      
      // Create hourly slots from 9 AM to 5 PM
      for (let hour = 9; hour < 17; hour++) {
        const slotStart = new Date(currentDate);
        slotStart.setHours(hour, 0, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setHours(hour + 1, 0, 0, 0);
        
        // Check if this slot conflicts with any existing events
        const hasConflict = events.some(event => {
          if (!event.start || !event.end) return false;
          
          const eventStart = new Date(event.start);
          const eventEnd = new Date(event.end);
          
          return (slotStart < eventEnd && slotEnd > eventStart);
        });
        
        if (!hasConflict && slotStart > now) {
          const formattedTime = slotStart.toLocaleString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          availableSlots.push(formattedTime);
        }
      }
    }
    
    // Return first 10 available slots
    return availableSlots.slice(0, 10);
  } catch (error) {
    console.error('Error getting available times:', error);
    return [];
  }
};

const generateAppointmentEmail = (contactName: string, availableTimes: string[]): string => {
  const timeSlots = availableTimes.map((time, index) => `${index + 1}. ${time}`).join('\n');
  
  return `Dear ${contactName},

I hope this email finds you well. I'm reaching out to schedule an appointment with you.

Here are my available times for the next few days:

${timeSlots}

Please let me know which time works best for you, or if you'd prefer a different time. You can simply reply to this email with your preference.

If you have any specific topics you'd like to discuss during our meeting, please feel free to include them in your response.

I look forward to hearing from you.

Best regards,
Financial Advisor`;
};

const handleToolCalls = async (userId: string, toolCalls: any, aiMessage: any) => {
  const toolResponses = [];
  for (const toolCall of toolCalls) {
    const { name, arguments: args } = toolCall.function;
    console.log('[AI] handleToolCalls called:', name, args);
    let result;
    try {
    switch (name) {
      case 'search_emails_and_contacts':
          if (!args || typeof args.query !== 'string') {
            result = { error: 'Missing or invalid query argument for search_emails_and_contacts' };
          } else {
        result = await searchData(userId, args.query);
          }
        break;
      case 'schedule_appointment':
          if (!args || typeof args.contact_name !== 'string') {
            result = { error: 'Missing or invalid contact_name argument for schedule_appointment' };
          } else {
        result = await scheduleAppointment(userId, args.contact_name, args.preferred_times);
          }
          break;
        case 'create_hubspot_contact':
          console.log('[AI] About to call createContact:', args);
          const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
          console.log('parsedArgs:', parsedArgs);

          if (!args || typeof parsedArgs.email !== 'string' || typeof parsedArgs.name !== 'string' || typeof parsedArgs.note !== 'string') {
            result = { error: 'Missing or invalid arguments for create_hubspot_contact' };
          } else 
          {
            console.log('worksworks', parsedArgs.name, parsedArgs.email);
            const [firstname, ...lastParts] = (parsedArgs.name || '').split(' ');
            const lastname = lastParts.join(' ');
            console.log('firstname:', firstname);
            console.log('lastname:', lastname);
            try {
              result = await hubspotService.createContact(userId, {
                email: parsedArgs.email,
                firstname,
                lastname,
                phone: parsedArgs.phone || undefined
              });
              console.log('[AI] createContact result:', result);
            } catch (err) {
              console.error('[AI] createContact threw error:', err);
              throw err;
            }
          }
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
      role: 'tool' as const,
      content: JSON.stringify(result)
    });
  }
  return toolResponses;
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

export async function processProactiveEvent(
  userId: string,
  eventType: string,
  eventData: any,
  instructions?: string[]
): Promise<{ text: string | null; actionRequired: boolean; toolCalls: any[] }> {
  // Fetch instructions from DB if not provided
  let userInstructions = instructions;
  if (!userInstructions) {
    userInstructions = await getUserInstructions(userId);
  }
  const prompt = `
You are a proactive assistant for a financial advisor.

Event:
${JSON.stringify(eventData, null, 2)}

Ongoing Instructions:
${userInstructions.map(i => `- ${i}`).join('\n')}

If the sender of the email is not found in HubSpot, use the create_hubspot_contact tool to add them as a new contact, including a note about the email. Always use the available tools to take action, not just to search.
`;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: 'You are a proactive assistant for a financial advisor.' },
    { role: 'user', content: prompt }
  ];

  let toolCalls: any[] = [];
  let toolResponses: any[] = [];
  let openaiResponse: any = undefined;
  let loopCount = 0;
  const maxLoops = 5;

  while (loopCount++ < maxLoops) {
    openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto',
    });
    const aiMessage = openaiResponse.choices[0].message;
    messages.push(aiMessage);
    toolCalls = aiMessage.tool_calls || [];
    if (!toolCalls.length) break;
    toolResponses = await handleToolCalls(userId, toolCalls, aiMessage);
    for (const toolResponse of toolResponses) {
      messages.push({
        role: 'tool',
        tool_call_id: toolResponse.tool_call_id,
        content: toolResponse.content,
      });
    }
  }

  // Return the final AI message
  return {
    text: openaiResponse && openaiResponse.choices[0].message.content,
    actionRequired: false,
    toolCalls: Array.isArray(toolCalls) ? toolCalls : [],
  };
}

const handleGeneralQuestion = async (userId: string, question: string) => {
  try {
    console.log('Handling general question:', question);
    
    // Search across all data sources using RAG
    const searchResults = await RAGService.searchAll(parseInt(userId), question, 8);
    
    if (searchResults.length === 0) {
      return { text: "I couldn't find any relevant information in your emails or contacts to answer that question." };
    }
    
    // Prepare context for AI to answer the question
    let context = 'Based on the following information from your emails and contacts:\n\n';
    
    searchResults.forEach((result, index) => {
      const source = result.metadata?.source || 'unknown';
      const relevance = Math.round((1 - result.similarity) * 100);
      
      if (source === 'email') {
        const from = result.metadata?.from || 'Unknown';
        const subject = result.metadata?.subject || 'No subject';
        const date = result.metadata?.date || 'Unknown date';
        context += `${index + 1}. [EMAIL from ${from}] Subject: ${subject} (${date}) - Relevance: ${relevance}%\n`;
        context += `   Content: ${result.content.substring(0, 400)}...\n\n`;
      } else if (source === 'contact') {
        const name = result.metadata?.firstName && result.metadata?.lastName 
          ? `${result.metadata.firstName} ${result.metadata.lastName}`
          : result.metadata?.name || 'Unknown contact';
        context += `${index + 1}. [CONTACT: ${name}] - Relevance: ${relevance}%\n`;
        context += `   Info: ${result.content.substring(0, 400)}...\n\n`;
      }
    });
    
    // Use OpenAI to generate an answer based on the context
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions based on the provided context from emails and contacts. 
          Answer the user's question using only the information provided in the context. 
          If the context doesn't contain enough information to answer the question, say so.
          Be specific and reference the sources (emails/contacts) when possible.`
        },
        {
          role: 'user',
          content: `Question: ${question}\n\n${context}`
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });
    
    const answer = aiResponse.choices[0].message.content;
    return { text: answer || "I couldn't generate an answer based on the available information." };
    
  } catch (error) {
    console.error('Error handling general question:', error);
    return { text: "I encountered an error while trying to answer your question. Please try again." };
  }
};

const handleAddContact = async (userId: string, contactName: string, contactEmail: string) => {
  try {
    // Split name into first/last
    const nameParts = contactName.trim().split(/\s+/);
    const firstname = nameParts[0] || '';
    const lastname = nameParts.slice(1).join(' ');
    // Create contact in HubSpot
    const result = await hubspotService.createContact(userId, {
      email: contactEmail,
      firstname,
      lastname
    });
    if (result && result.id) {
      return { text: `Contact "${contactName}" (${contactEmail}) was successfully added to HubSpot!` };
    } else {
      return { text: `I tried to add "${contactName}" (${contactEmail}) to HubSpot, but something went wrong.` };
    }
  } catch (error) {
    console.error('Error in handleAddContact:', error);
    let errorMsg = 'An error occurred while adding the contact.';
    if (error && typeof error === 'object' && 'message' in error) {
      errorMsg = `An error occurred while adding the contact: ${(error as any).message}`;
    } else if (typeof error === 'string') {
      errorMsg = `An error occurred while adding the contact: ${error}`;
    }
    return { text: errorMsg };
  }
};

// Persistent instruction storage
export async function saveUserInstruction(userId: string, instruction: string) {
  await pool.query(
    'INSERT INTO user_instructions (user_id, instruction) VALUES ($1, $2)',
    [userId, instruction]
  );
}

export async function getUserInstructions(userId: string): Promise<string[]> {
  const res = await pool.query(
    'SELECT instruction FROM user_instructions WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  return res.rows.map(row => row.instruction);
}

console.log('Polling script started...');