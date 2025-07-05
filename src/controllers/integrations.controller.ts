// controllers/integrations.controller.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { processMessage } from '../services/ai.service';

// Gmail webhook (push notification or polling)
export const handleGmailWebhook = async (req: Request, res: Response) => {
  try {
    // Example: Google push notification header
    const userId = req.headers['x-goog-channel-id'] as string;
    const messageId = req.headers['x-goog-resource-id'] as string;
    // In a real implementation, fetch the new email using Gmail API

    // Check for ongoing instructions
    const { rows: instructions } = await pool.query(
      `SELECT * FROM ongoing_instructions WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    if (instructions.length) {
      const message = `New email received (ID: ${messageId}). Check if any instructions apply.`;
      await processMessage(userId, message);
    }
    res.status(200).send();
  } catch (error) {
    console.error('Gmail webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// HubSpot webhook (or polling)
export const handleHubspotWebhook = async (req: Request, res: Response) => {
  try {
    const { objectId, eventType, userId } = req.body;
    if (eventType === 'contact.creation') {
      const { rows: instructions } = await pool.query(
        `SELECT * FROM ongoing_instructions WHERE user_id = $1 AND trigger_type = 'contact_creation' AND is_active = true`,
        [userId]
      );
      if (instructions.length) {
        const message = `New contact created in HubSpot (ID: ${objectId}). Follow instructions.`;
        await processMessage(userId, message);
      }
    }
    res.status(200).send();
  } catch (error) {
    console.error('HubSpot webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};