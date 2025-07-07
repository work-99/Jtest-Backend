import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import OAuth2Strategy from 'passport-oauth2';
import pool from './db';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';

config();

// Interface for User type
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

// JWT configuration
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET!,
  issuer: process.env.JWT_ISSUER || 'financial-advisor-api',
  audience: process.env.JWT_AUDIENCE || 'financial-advisor-app',
};

// Passport Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      passReqToCallback: true,
      scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.send',
      ],
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists in database
        const { rows } = await pool.query(
          'SELECT * FROM users WHERE email = $1',
          [profile.emails?.[0].value]
        );

        let user = rows[0];

        if (!user) {
          // Create new user if doesn't exist
          const { rows: newUser } = await pool.query(
            `INSERT INTO users 
             (email, name, avatar, provider, provider_id) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [
              profile.emails?.[0].value,
              profile.displayName,
              profile.photos?.[0].value,
              'google',
              profile.id,
            ]
          );
          user = newUser[0];
        }

        // Store Google tokens
        await pool.query(
          `INSERT INTO user_credentials 
           (user_id, service, access_token, refresh_token, expires_at) 
           VALUES ($1, 'google', $2, $3, $4) 
           ON CONFLICT (user_id, service) 
           DO UPDATE SET 
             access_token = EXCLUDED.access_token,
             refresh_token = EXCLUDED.refresh_token,
             expires_at = EXCLUDED.expires_at`,
          [
            user.id,
            accessToken,
            refreshToken,
            new Date(Date.now() + 3600 * 1000), // 1 hour expiration
          ]
        );

        // Create JWT token
        const token = jwt.sign(
          {
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          jwtOptions.secretOrKey,
          {
            expiresIn: '7d',
            issuer: jwtOptions.issuer,
            audience: jwtOptions.audience,
          }
        );

        return done(null, { ...user, token });
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

// Passport HubSpot OAuth Strategy - COMMENTED OUT (using custom routes instead)
// passport.use(
//   'hubspot',
//   new OAuth2Strategy(
//     {
//       clientID: process.env.HUBSPOT_CLIENT_ID!,
//       clientSecret: process.env.HUBSPOT_CLIENT_SECRET!,
//       callbackURL: process.env.HUBSPOT_CALLBACK_URL!,
//       authorizationURL: 'https://app.hubspot.com/oauth/authorize',
//       tokenURL: 'https://api.hubapi.com/oauth/v1/token',
//       scope: ['contacts', 'timeline', 'automation'],
//     },
//     async (accessToken: string, refreshToken: string, profile: any, done: any) => {
//       try {
//         // Get user from request (set in auth middleware)
//         const user = (profile as any).user;

//         // Store HubSpot tokens
//         await pool.query(
//           `INSERT INTO user_credentials 
//            (user_id, service, access_token, refresh_token) 
//            VALUES ($1, 'hubspot', $2, $3) 
//            ON CONFLICT (user_id, service) 
//            DO UPDATE SET 
//              access_token = EXCLUDED.access_token,
//              refresh_token = EXCLUDED.refresh_token`,
//           [user.id, accessToken, refreshToken]
//         );

//         return done(null, { ...user, hubspotConnected: true });
//       } catch (error) {
//         return done(error as Error);
//       }
//     }
//   )
// );

// Passport JWT Strategy
passport.use(
  new JwtStrategy(jwtOptions, async (payload: any, done: any) => {
    try {
      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [
        payload.sub,
      ]);

      if (!rows[0]) {
        return done(null, false);
      }

      const user: User = {
        id: rows[0].id,
        email: rows[0].email,
        name: rows[0].name,
        role: rows[0].role,
      };

      return done(null, user);
    } catch (error) {
      return done(error as Error);
    }
  })
);

// Serialize/Deserialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, rows[0]);
  } catch (error) {
    done(error as Error);
  }
});

// Helper middleware for JWT auth
export const authenticateJwt = passport.authenticate('jwt', { session: false });

// Helper middleware for Google auth
export const authenticateGoogle = passport.authenticate('google', {
  session: false,
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
  ],
});

// Helper middleware for HubSpot auth - COMMENTED OUT (using custom routes instead)
// export const authenticateHubspot = passport.authenticate('hubspot', {
//   session: false,
// });

export default passport;