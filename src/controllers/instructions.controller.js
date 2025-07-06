"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInstruction = exports.updateInstruction = exports.addInstruction = exports.listInstructions = void 0;
const db_1 = __importDefault(require("../config/db"));
const listInstructions = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    const { rows } = await db_1.default.query('SELECT * FROM ongoing_instructions WHERE user_id = $1', [userId]);
    res.json({ instructions: rows });
};
exports.listInstructions = listInstructions;
const addInstruction = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    const { instruction, trigger_type, priority } = req.body;
    if (!instruction) {
        res.status(400).json({ error: 'Instruction required' });
        return;
    }
    const { rows } = await db_1.default.query(`INSERT INTO ongoing_instructions (user_id, instruction, trigger_type, priority) VALUES ($1, $2, $3, $4) RETURNING *`, [userId, instruction, trigger_type || null, priority || 1]);
    res.status(201).json({ instruction: rows[0] });
};
exports.addInstruction = addInstruction;
const updateInstruction = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    const { id } = req.params;
    const { instruction, trigger_type, is_active, priority } = req.body;
    const { rows } = await db_1.default.query(`UPDATE ongoing_instructions SET instruction = $1, trigger_type = $2, is_active = $3, priority = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND user_id = $6 RETURNING *`, [instruction, trigger_type, is_active, priority, id, userId]);
    if (!rows[0]) {
        res.status(404).json({ error: 'Instruction not found' });
        return;
    }
    res.json({ instruction: rows[0] });
};
exports.updateInstruction = updateInstruction;
const deleteInstruction = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    const { id } = req.params;
    await db_1.default.query('DELETE FROM ongoing_instructions WHERE id = $1 AND user_id = $2', [id, userId]);
    res.json({ success: true });
};
exports.deleteInstruction = deleteInstruction;
