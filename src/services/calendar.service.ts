// services/calendar.service.ts
import { google } from 'googleapis';
import { pool } from '../config/db';

export const getCalendarClient = async (userId: string) => {
  const result = await pool.query(
    'SELECT access_token, refresh_token FROM user_credentials WHERE user_id = $1 AND service = $2',
    [userId, 'google']
  );

  if (!result.rows.length) {
    throw new Error('Google credentials not found');
  }

  const { access_token, refresh_token } = result.rows[0];
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token,
    refresh_token
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
};

export const scheduleEvent = async (
  userId: string,
  eventDetails: {
    summary: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    attendees?: Array<{ email: string }>;
    description?: string;
  }
) => {
  const calendar = await getCalendarClient(userId);
  const event = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: eventDetails
  });

  return event.data;
};

export const getAvailableSlots = async (
  userId: string,
  timeMin: string,
  timeMax: string,
  duration = 30
) => {
  const calendar = await getCalendarClient(userId);
  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: 'primary' }]
    }
  });

  // Process busy slots and find available time
  const busySlots = data.calendars?.primary.busy || [];
  // Implement logic to find available slots
  return findAvailableSlots(busySlots, timeMin, timeMax, duration);
};