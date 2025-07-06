// services/calendar.service.ts
import { google } from 'googleapis';
import pool from '../config/db';

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

// Helper function to find available time slots
function findAvailableSlots(busySlots: any[], timeMin: string, timeMax: string, duration: number) {
  // Simple implementation - return time slots when not busy
  const slots = [];
  const start = new Date(timeMin);
  const end = new Date(timeMax);
  
  // For now, return some mock available slots
  for (let i = 0; i < 5; i++) {
    const slotStart = new Date(start.getTime() + i * 60 * 60 * 1000); // 1 hour intervals
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
    
    if (slotEnd <= end) {
      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString()
      });
    }
  }
  
  return slots;
}

// Get upcoming calendar events
export const getUpcomingEvents = async (userId: string, maxResults: number = 10) => {
  try {
    const calendar = await getCalendarClient(userId);
    const now = new Date();
    const timeMin = now.toISOString();
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin,
      maxResults: maxResults,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items || [];
    return events.map(event => ({
      id: event.id,
      summary: event.summary || 'No title',
      description: event.description || '',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      attendees: event.attendees || [],
      location: event.location || '',
      htmlLink: event.htmlLink
    }));
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw new Error('Failed to fetch calendar events');
  }
};

// Get next meeting/event
export const getNextEvent = async (userId: string) => {
  try {
    const events = await getUpcomingEvents(userId, 1);
    return events.length > 0 ? events[0] : null;
  } catch (error) {
    console.error('Error fetching next event:', error);
    throw new Error('Failed to fetch next event');
  }
};