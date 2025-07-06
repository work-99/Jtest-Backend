"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskModel = void 0;
const db_1 = __importDefault(require("../config/db"));
class TaskModel {
    static async create(taskData) {
        const query = `
      INSERT INTO tasks (user_id, type, status, data)
      VALUES ($1, $2, 'pending', $3)
      RETURNING *
    `;
        const values = [
            taskData.user_id,
            taskData.type,
            JSON.stringify(taskData.data)
        ];
        const result = await db_1.default.query(query, values);
        return result.rows[0];
    }
    static async findById(id) {
        const query = 'SELECT * FROM tasks WHERE id = $1';
        const result = await db_1.default.query(query, [id]);
        return result.rows[0] || null;
    }
    static async findByUserId(userId, limit = 50) {
        const query = `
      SELECT * FROM tasks 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
        const result = await db_1.default.query(query, [userId, limit]);
        return result.rows;
    }
    static async findPendingTasks(limit = 10) {
        const query = `
      SELECT * FROM tasks 
      WHERE status = 'pending' 
      ORDER BY created_at ASC 
      LIMIT $1
    `;
        const result = await db_1.default.query(query, [limit]);
        return result.rows;
    }
    static async updateStatus(id, status, result, errorMessage) {
        const query = `
      UPDATE tasks 
      SET status = $2, 
          result = $3, 
          error_message = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
        const values = [
            id,
            status,
            result ? JSON.stringify(result) : null,
            errorMessage
        ];
        const result_query = await db_1.default.query(query, values);
        return result_query.rows[0];
    }
    static async updateData(id, data) {
        const query = `
      UPDATE tasks 
      SET data = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
        const values = [id, JSON.stringify(data)];
        const result = await db_1.default.query(query, values);
        return result.rows[0];
    }
    static async delete(id) {
        const query = 'DELETE FROM tasks WHERE id = $1';
        await db_1.default.query(query, [id]);
    }
    static async getTasksByType(userId, type) {
        const query = `
      SELECT * FROM tasks 
      WHERE user_id = $1 AND type = $2
      ORDER BY created_at DESC
    `;
        const result = await db_1.default.query(query, [userId, type]);
        return result.rows;
    }
    static async getActiveTasks(userId) {
        const query = `
      SELECT * FROM tasks 
      WHERE user_id = $1 AND status IN ('pending', 'in_progress')
      ORDER BY created_at ASC
    `;
        const result = await db_1.default.query(query, [userId]);
        return result.rows;
    }
    static async cleanupOldTasks(daysOld = 30) {
        const query = `
      DELETE FROM tasks 
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
      AND status IN ('completed', 'failed')
    `;
        await db_1.default.query(query);
    }
}
exports.TaskModel = TaskModel;
