"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTaskStatus = exports.getTasksByUserId = exports.continueWaitingTasks = exports.triggerProactiveAgent = exports.processPendingTasks = exports.createTask = void 0;
// services/task.service.ts
const db_1 = __importDefault(require("../config/db"));
const ai_service_1 = require("./ai.service");
const gmail_service_1 = require("./gmail.service");
const hubspot_service_1 = require("./hubspot.service");
const createTask = async (userId, type, data) => {
    const result = await db_1.default.query(`INSERT INTO tasks (user_id, type, status, data)
     VALUES ($1, $2, 'pending', $3)
     RETURNING *`, [userId, type, JSON.stringify(data)]);
    return result.rows[0];
};
exports.createTask = createTask;
const processPendingTasks = async () => {
    const { rows: tasks } = await db_1.default.query(`SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 10`);
    for (const task of tasks) {
        try {
            // Update status to in_progress
            await db_1.default.query(`UPDATE tasks SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [task.id]);
            let result;
            switch (task.type) {
                case 'schedule_appointment':
                    result = await handleScheduleAppointment(task);
                    break;
                case 'create_hubspot_contact':
                    result = await handleCreateHubspotContact(task);
                    break;
                case 'send_follow_up_email':
                    result = await handleSendFollowUpEmail(task);
                    break;
                case 'process_new_email':
                    result = await handleProcessNewEmail(task);
                    break;
                case 'ai_processing':
                    // Use the new proactive event processor
                    const { triggerType, instruction, data } = task.data;
                    result = await require('./ai.service').processProactiveEvent(task.user_id.toString(), triggerType, data, [instruction]);
                    // Defensive: if result is an array, wrap in object
                    if (Array.isArray(result)) {
                        result = { text: JSON.stringify(result), actionRequired: false, toolCalls: [] };
                    }
                    break;
                default:
                    result = { error: `Unknown task type: ${task.type}` };
            }
            // Update task with result
            await db_1.default.query(`UPDATE tasks SET status = 'completed', result = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [JSON.stringify(result), task.id]);
        }
        catch (error) {
            console.error(`Task processing error for task ${task.id}:`, error);
            await db_1.default.query(`UPDATE tasks SET status = 'failed', error_message = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [error instanceof Error ? error.message : 'Unknown error', task.id]);
        }
    }
};
exports.processPendingTasks = processPendingTasks;
// Task handlers for specific task types
const handleScheduleAppointment = async (task) => {
    const { contactName, preferredTimes, email } = task.data;
    try {
        // For now, we'll create a task that waits for confirmation
        // In a real implementation, you'd integrate with Google Calendar
        const result = {
            success: true,
            message: `Appointment scheduling initiated for ${contactName}`,
            status: 'waiting_for_confirmation',
            data: { contactName, preferredTimes, email }
        };
        // Update task to waiting for response
        await db_1.default.query(`UPDATE tasks SET status = 'waiting_for_response', result = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [JSON.stringify(result), task.id]);
        return result;
    }
    catch (error) {
        throw new Error(`Failed to schedule appointment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
const handleCreateHubspotContact = async (task) => {
    const { email, name, phone, source } = task.data;
    try {
        const [firstName, ...lastNameParts] = name.split(' ');
        const lastName = lastNameParts.join(' ');
        const contact = await (0, hubspot_service_1.createContact)(task.user_id.toString(), {
            email,
            firstname: firstName,
            lastname: lastName,
            phone
        });
        return {
            success: true,
            contactId: contact.id,
            message: `Contact created successfully for ${name}`
        };
    }
    catch (error) {
        throw new Error(`Failed to create HubSpot contact: ${error instanceof Error ? error.message : String(error)}`);
    }
};
const handleSendFollowUpEmail = async (task) => {
    const { to, subject, body, threadId } = task.data;
    try {
        const emailId = await gmail_service_1.GmailService.sendEmail(task.user_id, {
            to,
            subject,
            body,
            threadId
        });
        return {
            success: true,
            emailId,
            message: `Follow-up email sent successfully to ${to}`
        };
    }
    catch (error) {
        throw new Error(`Failed to send follow-up email: ${error instanceof Error ? error.message : String(error)}`);
    }
};
const handleProcessNewEmail = async (task) => {
    const { emailId, instructions } = task.data;
    try {
        // Get the email content
        const email = await gmail_service_1.GmailService.getEmail(task.user_id, emailId);
        // Process with AI using ongoing instructions
        const message = `New email received from ${email.from} with subject: "${email.subject}". 
    Content: ${email.body.substring(0, 500)}...
    
    Ongoing instructions: ${instructions.join(', ')}
    
    Please process this email according to the instructions.`;
        const result = await (0, ai_service_1.processMessage)(task.user_id.toString(), message);
        // Defensive: if result is an array, wrap in object
        const safeResult = Array.isArray(result) ? { text: JSON.stringify(result) } : result;
        return {
            success: true,
            processed: true,
            aiResponse: safeResult.text,
            message: `Email processed successfully`
        };
    }
    catch (error) {
        throw new Error(`Failed to process email: ${error instanceof Error ? error.message : String(error)}`);
    }
};
// Proactive agent functions
const triggerProactiveAgent = async (userId, triggerType, data) => {
    try {
        // Get ongoing instructions for this trigger type
        const { rows: instructions } = await db_1.default.query(`SELECT * FROM ongoing_instructions 
       WHERE user_id = $1 AND trigger_type = $2 AND is_active = true 
       ORDER BY priority DESC`, [userId, triggerType]);
        if (instructions.length === 0) {
            return { message: 'No active instructions for this trigger' };
        }
        // Create tasks for each instruction
        const tasks = [];
        for (const instruction of instructions) {
            const taskData = {
                triggerType,
                instruction: instruction.instruction,
                data,
                timestamp: new Date()
            };
            const task = await (0, exports.createTask)(userId, 'ai_processing', taskData);
            tasks.push(task);
        }
        // Process tasks immediately
        await (0, exports.processPendingTasks)();
        return {
            success: true,
            tasksCreated: tasks.length,
            message: `Created ${tasks.length} tasks for proactive processing`
        };
    }
    catch (error) {
        console.error('Proactive agent error:', error);
        throw new Error(`Failed to trigger proactive agent: ${error instanceof Error ? error.message : String(error)}`);
    }
};
exports.triggerProactiveAgent = triggerProactiveAgent;
const continueWaitingTasks = async () => {
    const { rows: waitingTasks } = await db_1.default.query(`SELECT * FROM tasks WHERE status = 'waiting_for_response' ORDER BY created_at ASC`);
    for (const task of waitingTasks) {
        try {
            // Check if conditions are met to continue the task
            const shouldContinue = await checkTaskContinuationConditions(task);
            if (shouldContinue) {
                // Update status back to pending for processing
                await db_1.default.query(`UPDATE tasks SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [task.id]);
            }
        }
        catch (error) {
            console.error(`Error checking task continuation for task ${task.id}:`, error);
        }
    }
};
exports.continueWaitingTasks = continueWaitingTasks;
const checkTaskContinuationConditions = async (task) => {
    // This is a simplified check - in a real implementation, you'd check specific conditions
    // based on the task type and data
    switch (task.type) {
        case 'schedule_appointment':
            // Check if we received a response email about the appointment
            const { contactName } = task.data;
            const recentEmails = await gmail_service_1.GmailService.searchEmails(task.user_id, contactName, 5);
            return recentEmails.length > 0;
        case 'waiting_for_client_response':
            // Check if we received a response from the client
            const { clientEmail } = task.data;
            const clientEmails = await gmail_service_1.GmailService.searchEmails(task.user_id, `from:${clientEmail}`, 3);
            return clientEmails.length > 0;
        default:
            return false;
    }
};
// Enhanced task management functions
const getTasksByUserId = async (userId, status) => {
    let query = 'SELECT * FROM tasks WHERE user_id = $1';
    const params = [userId];
    if (status) {
        query += ' AND status = $2';
        params.push(status);
    }
    query += ' ORDER BY created_at DESC';
    const result = await db_1.default.query(query, params);
    return result.rows;
};
exports.getTasksByUserId = getTasksByUserId;
const updateTaskStatus = async (taskId, status, result) => {
    const query = `
    UPDATE tasks 
    SET status = $2, result = $3, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
    const values = [taskId, status, result ? JSON.stringify(result) : null];
    const result_query = await db_1.default.query(query, values);
    return result_query.rows[0];
};
exports.updateTaskStatus = updateTaskStatus;
// Run task processor every 5 minutes
setInterval(exports.processPendingTasks, 5 * 60 * 1000);
// Run task continuation checker every 10 minutes
setInterval(exports.continueWaitingTasks, 10 * 60 * 1000);
