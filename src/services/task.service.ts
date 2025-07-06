// services/task.service.ts
import pool from '../config/db';
import { processMessage } from './ai.service';
import { GmailService } from './gmail.service';
import { createContact, addContactNote } from './hubspot.service';

interface Task {
  id: number;
  user_id: number;
  type: string;
  status: 'pending' | 'in_progress' | 'waiting_for_response' | 'completed' | 'failed';
  data: any;
  result?: any;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export const createTask = async (
  userId: number,
  type: string,
  data: any
): Promise<Task> => {
  const result = await pool.query(
    `INSERT INTO tasks (user_id, type, status, data)
     VALUES ($1, $2, 'pending', $3)
     RETURNING *`,
    [userId, type, JSON.stringify(data)]
  );

  return result.rows[0];
};

export const processPendingTasks = async () => {
  const { rows: tasks } = await pool.query(
    `SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 10`
  );

  for (const task of tasks) {
    try {
      // Update status to in_progress
      await pool.query(
        `UPDATE tasks SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [task.id]
      );

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
          result = await processMessage(task.user_id.toString(), task.data.message);
          break;
        default:
          result = { error: `Unknown task type: ${task.type}` };
      }

      // Update task with result
      await pool.query(
        `UPDATE tasks SET status = 'completed', result = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [JSON.stringify(result), task.id]
      );
    } catch (error) {
      console.error(`Task processing error for task ${task.id}:`, error);
      await pool.query(
        `UPDATE tasks SET status = 'failed', error_message = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [error instanceof Error ? error.message : 'Unknown error', task.id]
      );
    }
  }
};

// Task handlers for specific task types
const handleScheduleAppointment = async (task: Task) => {
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
    await pool.query(
      `UPDATE tasks SET status = 'waiting_for_response', result = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [JSON.stringify(result), task.id]
    );

    return result;
  } catch (error) {
    throw new Error(`Failed to schedule appointment: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const handleCreateHubspotContact = async (task: Task) => {
  const { email, name, phone, source } = task.data;
  
  try {
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ');
    
    const contact = await createContact(task.user_id.toString(), {
      email,
      firstname: firstName,
      lastname: lastName,
      phone
    });

    // Add note about source
    if (source) {
      await addContactNote(task.user_id.toString(), contact.id, `Contact created from ${source}`);
    }

    return {
      success: true,
      contactId: contact.id,
      message: `Contact created successfully for ${name}`
    };
  } catch (error) {
    throw new Error(`Failed to create HubSpot contact: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const handleSendFollowUpEmail = async (task: Task) => {
  const { to, subject, body, threadId } = task.data;
  
  try {
    const emailId = await GmailService.sendEmail(task.user_id, {
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
  } catch (error) {
    throw new Error(`Failed to send follow-up email: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const handleProcessNewEmail = async (task: Task) => {
  const { emailId, instructions } = task.data;
  
  try {
    // Get the email content
    const email = await GmailService.getEmail(task.user_id, emailId);
    
    // Process with AI using ongoing instructions
    const message = `New email received from ${email.from} with subject: "${email.subject}". 
    Content: ${email.body.substring(0, 500)}...
    
    Ongoing instructions: ${instructions.join(', ')}
    
    Please process this email according to the instructions.`;
    
    const result = await processMessage(task.user_id.toString(), message);
    
    return {
      success: true,
      processed: true,
      aiResponse: result.text,
      message: `Email processed successfully`
    };
  } catch (error) {
    throw new Error(`Failed to process email: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Proactive agent functions
export const triggerProactiveAgent = async (userId: number, triggerType: string, data: any) => {
  try {
    // Get ongoing instructions for this trigger type
    const { rows: instructions } = await pool.query(
      `SELECT * FROM ongoing_instructions 
       WHERE user_id = $1 AND trigger_type = $2 AND is_active = true 
       ORDER BY priority DESC`,
      [userId, triggerType]
    );

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

      const task = await createTask(userId, 'ai_processing', taskData);
      tasks.push(task);
    }

    // Process tasks immediately
    await processPendingTasks();

    return {
      success: true,
      tasksCreated: tasks.length,
      message: `Created ${tasks.length} tasks for proactive processing`
    };
  } catch (error) {
    console.error('Proactive agent error:', error);
    throw new Error(`Failed to trigger proactive agent: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const continueWaitingTasks = async () => {
  const { rows: waitingTasks } = await pool.query(
    `SELECT * FROM tasks WHERE status = 'waiting_for_response' ORDER BY created_at ASC`
  );

  for (const task of waitingTasks) {
    try {
      // Check if conditions are met to continue the task
      const shouldContinue = await checkTaskContinuationConditions(task);
      
      if (shouldContinue) {
        // Update status back to pending for processing
        await pool.query(
          `UPDATE tasks SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [task.id]
        );
      }
    } catch (error) {
      console.error(`Error checking task continuation for task ${task.id}:`, error);
    }
  }
};

const checkTaskContinuationConditions = async (task: Task): Promise<boolean> => {
  // This is a simplified check - in a real implementation, you'd check specific conditions
  // based on the task type and data
  
  switch (task.type) {
    case 'schedule_appointment':
      // Check if we received a response email about the appointment
      const { contactName } = task.data;
      const recentEmails = await GmailService.searchEmails(task.user_id, contactName, 5);
      return recentEmails.length > 0;
      
    case 'waiting_for_client_response':
      // Check if we received a response from the client
      const { clientEmail } = task.data;
      const clientEmails = await GmailService.searchEmails(task.user_id, `from:${clientEmail}`, 3);
      return clientEmails.length > 0;
      
    default:
      return false;
  }
};

// Enhanced task management functions
export const getTasksByUserId = async (userId: number, status?: string): Promise<Task[]> => {
  let query = 'SELECT * FROM tasks WHERE user_id = $1';
  const params: any[] = [userId];
  if (status) {
    query += ' AND status = $2';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
};

export const updateTaskStatus = async (taskId: number, status: Task['status'], result?: any): Promise<Task> => {
  const query = `
    UPDATE tasks 
    SET status = $2, result = $3, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
  
  const values = [taskId, status, result ? JSON.stringify(result) : null];
  const result_query = await pool.query(query, values);
  return result_query.rows[0];
};

// Run task processor every 5 minutes
setInterval(processPendingTasks, 5 * 60 * 1000);

// Run task continuation checker every 10 minutes
setInterval(continueWaitingTasks, 10 * 60 * 1000);