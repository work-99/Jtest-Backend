import { Request, Response } from 'express';
import pool from '../config/db';

export const listInstructions = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const { rows } = await pool.query('SELECT * FROM ongoing_instructions WHERE user_id = $1', [userId]);
  res.json({ instructions: rows });
};

export const addInstruction = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const { instruction, trigger_type, priority } = req.body;
  if (!instruction) return res.status(400).json({ error: 'Instruction required' });
  const { rows } = await pool.query(
    `INSERT INTO ongoing_instructions (user_id, instruction, trigger_type, priority) VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, instruction, trigger_type || null, priority || 1]
  );
  res.status(201).json({ instruction: rows[0] });
};

export const updateInstruction = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const { id } = req.params;
  const { instruction, trigger_type, is_active, priority } = req.body;
  const { rows } = await pool.query(
    `UPDATE ongoing_instructions SET instruction = $1, trigger_type = $2, is_active = $3, priority = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND user_id = $6 RETURNING *`,
    [instruction, trigger_type, is_active, priority, id, userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Instruction not found' });
  res.json({ instruction: rows[0] });
};

export const deleteInstruction = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const { id } = req.params;
  await pool.query('DELETE FROM ongoing_instructions WHERE id = $1 AND user_id = $2', [id, userId]);
  res.json({ success: true });
}; 