import pool from '../config/db';

export interface User {
  id: number;
  email: string;
  name: string;
  avatar?: string;
  provider: string;
  provider_id: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  name: string;
  avatar?: string;
  provider: string;
  provider_id: string;
  role?: string;
}

export class UserModel {
  static async create(userData: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO users (email, name, avatar, provider, provider_id, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      userData.email,
      userData.name,
      userData.avatar,
      userData.provider,
      userData.provider_id,
      userData.role || 'advisor'
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByProviderId(provider: string, providerId: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE provider = $1 AND provider_id = $2';
    const result = await pool.query(query, [provider, providerId]);
    return result.rows[0] || null;
  }

  static async update(id: number, updates: Partial<User>): Promise<User> {
    const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`);
    const query = `
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const values = [id, ...Object.values(updates)];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async delete(id: number): Promise<void> {
    const query = 'DELETE FROM users WHERE id = $1';
    await pool.query(query, [id]);
  }

  static async getConnectedServices(userId: number): Promise<{ [key: string]: boolean }> {
    const query = 'SELECT service FROM user_credentials WHERE user_id = $1';
    const result = await pool.query(query, [userId]);
    
    const services = {
      gmail: false,
      calendar: false,
      hubspot: false
    };

    result.rows.forEach((row: { service: string }) => {
      if (row.service === 'google') {
        services.gmail = true;
        services.calendar = true;
      } else if (row.service === 'hubspot') {
        services.hubspot = true;
      }
    });

    return services;
  }

  static async hasValidCredentials(userId: number, service: string): Promise<boolean> {
    const query = `
      SELECT access_token, expires_at 
      FROM user_credentials 
      WHERE user_id = $1 AND service = $2
    `;
    
    const result = await pool.query(query, [userId, service]);
    
    if (!result.rows[0]) {
      return false;
    }

    const credential = result.rows[0];
    if (!credential.expires_at) {
      return true; // No expiration
    }

    return new Date(credential.expires_at) > new Date();
  }
}
