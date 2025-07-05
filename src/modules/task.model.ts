import pool from '../config/db';

export interface Task {
  id: number;
  user_id: number;
  type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  data: any;
  result?: any;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTaskData {
  user_id: number;
  type: string;
  data: any;
}

export class TaskModel {
  static async create(taskData: CreateTaskData): Promise<Task> {
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

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findById(id: number): Promise<Task | null> {
    const query = 'SELECT * FROM tasks WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByUserId(userId: number, limit: number = 50): Promise<Task[]> {
    const query = `
      SELECT * FROM tasks 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }

  static async findPendingTasks(limit: number = 10): Promise<Task[]> {
    const query = `
      SELECT * FROM tasks 
      WHERE status = 'pending' 
      ORDER BY created_at ASC 
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  static async updateStatus(id: number, status: Task['status'], result?: any, errorMessage?: string): Promise<Task> {
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

    const result_query = await pool.query(query, values);
    return result_query.rows[0];
  }

  static async updateData(id: number, data: any): Promise<Task> {
    const query = `
      UPDATE tasks 
      SET data = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const values = [id, JSON.stringify(data)];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async delete(id: number): Promise<void> {
    const query = 'DELETE FROM tasks WHERE id = $1';
    await pool.query(query, [id]);
  }

  static async getTasksByType(userId: number, type: string): Promise<Task[]> {
    const query = `
      SELECT * FROM tasks 
      WHERE user_id = $1 AND type = $2
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [userId, type]);
    return result.rows;
  }

  static async getActiveTasks(userId: number): Promise<Task[]> {
    const query = `
      SELECT * FROM tasks 
      WHERE user_id = $1 AND status IN ('pending', 'in_progress')
      ORDER BY created_at ASC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  static async cleanupOldTasks(daysOld: number = 30): Promise<void> {
    const query = `
      DELETE FROM tasks 
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
      AND status IN ('completed', 'failed')
    `;
    await pool.query(query);
  }
}
