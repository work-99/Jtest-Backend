"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateHubspot = exports.authenticateGoogle = exports.authenticateJwt = void 0;
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const passport_jwt_1 = require("passport-jwt");
const passport_oauth2_1 = __importDefault(require("passport-oauth2"));
const db_1 = __importDefault(require("./db"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
// JWT configuration
const jwtOptions = {
    jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
    issuer: process.env.JWT_ISSUER || 'financial-advisor-api',
    audience: process.env.JWT_AUDIENCE || 'financial-advisor-app',
};
// Passport Google OAuth Strategy
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    passReqToCallback: true,
    scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/gmail.modify',
    ],
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        // Check if user exists in database
        const { rows } = await db_1.default.query('SELECT * FROM users WHERE email = $1', [profile.emails?.[0].value]);
        let user = rows[0];
        if (!user) {
            // Create new user if doesn't exist
            const { rows: newUser } = await db_1.default.query(`INSERT INTO users 
             (email, name, avatar, provider, provider_id) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`, [
                profile.emails?.[0].value,
                profile.displayName,
                profile.photos?.[0].value,
                'google',
                profile.id,
            ]);
            user = newUser[0];
        }
        // Store Google tokens
        await db_1.default.query(`INSERT INTO user_credentials 
           (user_id, service, access_token, refresh_token, expires_at) 
           VALUES ($1, 'google', $2, $3, $4) 
           ON CONFLICT (user_id, service) 
           DO UPDATE SET 
             access_token = EXCLUDED.access_token,
             refresh_token = EXCLUDED.refresh_token,
             expires_at = EXCLUDED.expires_at`, [
            user.id,
            accessToken,
            refreshToken,
            new Date(Date.now() + 3600 * 1000), // 1 hour expiration
        ]);
        // Create JWT token
        const token = jsonwebtoken_1.default.sign({
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        }, jwtOptions.secretOrKey, {
            expiresIn: '7d',
            issuer: jwtOptions.issuer,
            audience: jwtOptions.audience,
        });
        return done(null, { ...user, token });
    }
    catch (error) {
        return done(error);
    }
}));
// Passport HubSpot OAuth Strategy
passport_1.default.use('hubspot', new passport_oauth2_1.default({
    clientID: process.env.HUBSPOT_CLIENT_ID,
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
    callbackURL: process.env.HUBSPOT_CALLBACK_URL,
    authorizationURL: 'https://app.hubspot.com/oauth/authorize',
    tokenURL: 'https://api.hubapi.com/oauth/v1/token',
    scope: ['contacts', 'timeline', 'automation'],
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Get user from request (set in auth middleware)
        const user = profile.user;
        // Store HubSpot tokens
        await db_1.default.query(`INSERT INTO user_credentials 
           (user_id, service, access_token, refresh_token) 
           VALUES ($1, 'hubspot', $2, $3) 
           ON CONFLICT (user_id, service) 
           DO UPDATE SET 
             access_token = EXCLUDED.access_token,
             refresh_token = EXCLUDED.refresh_token`, [user.id, accessToken, refreshToken]);
        return done(null, { ...user, hubspotConnected: true });
    }
    catch (error) {
        return done(error);
    }
}));
// Passport JWT Strategy
passport_1.default.use(new passport_jwt_1.Strategy(jwtOptions, async (payload, done) => {
    try {
        const { rows } = await db_1.default.query('SELECT * FROM users WHERE id = $1', [
            payload.sub,
        ]);
        if (!rows[0]) {
            return done(null, false);
        }
        const user = {
            id: rows[0].id,
            email: rows[0].email,
            name: rows[0].name,
            role: rows[0].role,
        };
        return done(null, user);
    }
    catch (error) {
        return done(error);
    }
}));
// Serialize/Deserialize user for session
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
passport_1.default.deserializeUser(async (id, done) => {
    try {
        const { rows } = await db_1.default.query('SELECT * FROM users WHERE id = $1', [id]);
        done(null, rows[0]);
    }
    catch (error) {
        done(error);
    }
});
// Helper middleware for JWT auth
exports.authenticateJwt = passport_1.default.authenticate('jwt', { session: false });
// Helper middleware for Google auth
exports.authenticateGoogle = passport_1.default.authenticate('google', {
    session: false,
    scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/gmail.modify',
    ],
});
// Helper middleware for HubSpot auth
exports.authenticateHubspot = passport_1.default.authenticate('hubspot', {
    session: false,
});
exports.default = passport_1.default;
