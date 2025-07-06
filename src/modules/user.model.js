"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const db_1 = __importDefault(require("../config/db"));
class UserModel {
    static async create(userData) {
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
        const result = await db_1.default.query(query, values);
        return result.rows[0];
    }
    static async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await db_1.default.query(query, [email]);
        return result.rows[0] || null;
    }
    static async findById(id) {
        const query = 'SELECT * FROM users WHERE id = $1';
        const result = await db_1.default.query(query, [id]);
        return result.rows[0] || null;
    }
    static async findByProviderId(provider, providerId) {
        const query = 'SELECT * FROM users WHERE provider = $1 AND provider_id = $2';
        const result = await db_1.default.query(query, [provider, providerId]);
        return result.rows[0] || null;
    }
    static async update(id, updates) {
        const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`);
        const query = `
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
        const values = [id, ...Object.values(updates)];
        const result = await db_1.default.query(query, values);
        return result.rows[0];
    }
    static async delete(id) {
        const query = 'DELETE FROM users WHERE id = $1';
        await db_1.default.query(query, [id]);
    }
    static async getConnectedServices(userId) {
        const query = 'SELECT service FROM user_credentials WHERE user_id = $1';
        const result = await db_1.default.query(query, [userId]);
        const services = {
            gmail: false,
            calendar: false,
            hubspot: false
        };
        result.rows.forEach((row) => {
            if (row.service === 'google') {
                services.gmail = true;
                services.calendar = true;
            }
            else if (row.service === 'hubspot') {
                services.hubspot = true;
            }
        });
        return services;
    }
    static async hasValidCredentials(userId, service) {
        const query = `
      SELECT access_token, expires_at 
      FROM user_credentials 
      WHERE user_id = $1 AND service = $2
    `;
        const result = await db_1.default.query(query, [userId, service]);
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
exports.UserModel = UserModel;
