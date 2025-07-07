"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processMessage = void 0;
// services/ai.service.ts
const openai_1 = __importDefault(require("openai"));
const rag_service_1 = require("./rag.service");
const message_model_1 = require("../modules/message.model");
const gmail_service_1 = require("./gmail.service");
const calendar_service_1 = require("./calendar.service");
const hubspot_service_1 = require("./hubspot.service");
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });
const openai = new openai_1.default({
    apiKey: "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"
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
const processMessage = async (userId, message) => {
    try {
        console.log('Processing message for user:', userId, 'Message:', message);
        // Check if this is an appointment scheduling request
        const isAppointmentRequest = message.toLowerCase().includes('schedule') &&
            (message.toLowerCase().includes('appointment') ||
                message.toLowerCase().includes('meeting')) &&
            message.toLowerCase().includes('with');
        if (isAppointmentRequest) {
            console.log('Appointment scheduling request detected...');
            return await handleAppointmentScheduling(userId, message);
        }
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
        // Check if this is a HubSpot/contact query
        const isHubSpotQuery = message.toLowerCase().includes('contact') ||
            message.toLowerCase().includes('client') ||
            message.toLowerCase().includes('customer') ||
            message.toLowerCase().includes('hubspot') ||
            message.toLowerCase().includes('crm');
        if (isEmailQuery) {
            console.log('Email query detected, fetching emails directly...');
            try {
                const emails = await gmail_service_1.GmailService.listEmails(parseInt(userId), 5);
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
                }
                else {
                    return { text: "I couldn't find any recent emails in your inbox." };
                }
            }
            catch (emailError) {
                console.error('Error fetching emails:', emailError);
                return { text: "I'm having trouble accessing your emails right now. Please try again later." };
            }
        }
        if (isCalendarQuery) {
            console.log('Calendar query detected, fetching calendar events...');
            try {
                const events = await (0, calendar_service_1.getUpcomingEvents)(userId, 5);
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
                }
                else {
                    return { text: "You don't have any upcoming calendar events." };
                }
            }
            catch (calendarError) {
                console.error('Error fetching calendar events:', calendarError);
                return { text: "I'm having trouble accessing your calendar right now. Please try again later." };
            }
        }
        if (isHubSpotQuery) {
            console.log('HubSpot query detected, fetching contacts...');
            try {
                const contacts = await (0, hubspot_service_1.searchContacts)(userId, '');
                console.log(`Found ${contacts.length} contacts`);
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
                }
                else {
                    return { text: "You don't have any contacts in your HubSpot CRM yet." };
                }
            }
            catch (hubspotError) {
                console.error('Error fetching HubSpot contacts:', hubspotError);
                return { text: "I'm having trouble accessing your HubSpot contacts right now. Please make sure your HubSpot account is connected." };
            }
        }
        // Get relevant context from RAG
        console.log('Getting context from RAG...');
        const context = await rag_service_1.RAGService.getContextForUser(parseInt(userId), message);
        console.log('Context retrieved:', context.substring(0, 200) + '...');
        // Get recent conversation history
        console.log('Getting conversation context...');
        const recentMessages = await message_model_1.MessageModel.getConversationContext(parseInt(userId), 'default', 5);
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
            { role: 'system', content: systemPrompt },
            ...recentMessages.map(msg => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: message }
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
    }
    catch (error) {
        console.error('Error processing message:', error);
        console.error('Error stack:', error.stack);
        // Fallback response for quota exceeded or other errors
        if (error.status === 429) {
            return {
                text: `I'm currently experiencing high demand and can't process your request right now. This is likely due to API rate limits. 

For now, I can help you with basic tasks. If you're trying to schedule an appointment, I can guide you through the process manually.

Please try again later or contact support if this issue persists.`
            };
        }
        return { text: 'I apologize, but I encountered an error processing your request. Please try again.' };
    }
};
exports.processMessage = processMessage;
const handleAppointmentScheduling = async (userId, message) => {
    try {
        console.log('Handling appointment scheduling request...');
        // Extract contact name from the message
        const contactName = extractContactName(message);
        if (!contactName) {
            return { text: "I couldn't identify the contact name in your request. Please specify who you'd like to schedule an appointment with." };
        }
        console.log('Looking for contact:', contactName);
        // Find the contact in HubSpot
        const contacts = await (0, hubspot_service_1.searchContacts)(userId, contactName);
        if (!contacts || contacts.length === 0) {
            return { text: `I couldn't find a contact named "${contactName}" in your HubSpot CRM. Please make sure the contact exists or check the spelling.` };
        }
        const contact = contacts[0]; // Use the first match
        const contactEmail = contact.properties?.email;
        const firstName = contact.properties?.firstname || '';
        const lastName = contact.properties?.lastname || '';
        const fullName = `${firstName} ${lastName}`.trim();
        if (!contactEmail) {
            return { text: `I found the contact "${fullName}" but they don't have an email address in your CRM. Please add their email address first.` };
        }
        console.log('Found contact:', fullName, 'Email:', contactEmail);
        // Get available calendar times for the next 7 days
        const availableTimes = await getAvailableTimes(userId);
        if (!availableTimes || availableTimes.length === 0) {
            return { text: `I couldn't find any available times in your calendar for the next few days. Please check your calendar and try again.` };
        }
        console.log('Available times:', availableTimes);
        // Send email with available times
        const emailSubject = `Appointment Scheduling - Available Times`;
        const emailBody = generateAppointmentEmail(fullName, availableTimes);
        const emailResult = await gmail_service_1.GmailService.sendEmail(parseInt(userId), {
            to: contactEmail,
            subject: emailSubject,
            body: emailBody
        });
        console.log('Email sent successfully:', emailResult);
        return {
            text: `Perfect! I've sent an email to ${fullName} (${contactEmail}) with your available appointment times for the next few days. They can choose a time that works best for them and reply to confirm the appointment.`,
            actionRequired: true,
            data: {
                contactName: fullName,
                contactEmail,
                availableTimes,
                emailSent: true
            }
        };
    }
    catch (error) {
        console.error('Error handling appointment scheduling:', error);
        return { text: "I encountered an error while trying to schedule the appointment. Please try again or contact support if the issue persists." };
    }
};
const extractContactName = (message) => {
    // Simple extraction - look for "with [Name]"
    const withMatch = message.match(/with\s+([a-zA-Z\s]+)/i);
    if (withMatch) {
        return withMatch[1].trim();
    }
    // Look for "appointment with [Name]"
    const appointmentMatch = message.match(/appointment\s+with\s+([a-zA-Z\s]+)/i);
    if (appointmentMatch) {
        return appointmentMatch[1].trim();
    }
    // Look for "meeting with [Name]"
    const meetingMatch = message.match(/meeting\s+with\s+([a-zA-Z\s]+)/i);
    if (meetingMatch) {
        return meetingMatch[1].trim();
    }
    return null;
};
const getAvailableTimes = async (userId) => {
    try {
        // Get upcoming events for the next 7 days
        const events = await (0, calendar_service_1.getUpcomingEvents)(userId, 50); // Get more events to analyze
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
                    if (!event.start || !event.end)
                        return false;
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
    }
    catch (error) {
        console.error('Error getting available times:', error);
        return [];
    }
};
const generateAppointmentEmail = (contactName, availableTimes) => {
    const timeSlots = availableTimes.map((time, index) => `${index + 1}. ${time}`).join('\n');
    return `Dear ${contactName},

I hope this email finds you well. I'm reaching out to schedule an appointment with you.

Here are my available times for the next few days:

${timeSlots}

Please let me know which time works best for you, or if you'd prefer a different time. You can simply reply to this email with your preference.

If you have any specific topics you'd like to discuss during our meeting, please feel free to include them in your response.

I look forward to hearing from you.

Best regards,
Aki Sato
Financial Advisor`;
};
const handleToolCalls = async (userId, toolCalls, aiMessage) => {
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
        }
        catch (error) {
            console.error(`Error executing tool ${name}:`, error);
            result = { error: `Failed to execute ${name}: ${error.message}` };
        }
        toolResponses.push({
            tool_call_id: toolCall.id,
            role: 'function',
            name,
            content: JSON.stringify(result)
        });
    }
    try {
        console.log('Tool responses:', toolResponses.map(r => ({ id: r.tool_call_id, name: r.name })));
        // Create the messages array properly
        const messages = [
            { role: 'assistant', content: aiMessage.content, tool_calls: toolCalls },
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
    }
    catch (error) {
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
            }
            catch (fallbackError) {
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
const searchData = async (userId, query) => {
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
                const emails = await gmail_service_1.GmailService.listEmails(parseInt(userId), 10);
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
            }
            catch (emailError) {
                console.error('Error fetching emails:', emailError);
                return {
                    success: false,
                    error: 'Failed to fetch emails',
                    results: []
                };
            }
        }
        // For other queries, use RAG search
        const results = await rag_service_1.RAGService.searchAll(parseInt(userId), query.trim(), 10);
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
    }
    catch (error) {
        console.error('Search data error:', error);
        return {
            success: false,
            error: 'Failed to search data',
            results: []
        };
    }
};
const scheduleAppointment = async (userId, contactName, preferredTimes) => {
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
    }
    catch (error) {
        console.error('Schedule appointment error:', error);
        return { success: false, error: 'Failed to schedule appointment' };
    }
};
