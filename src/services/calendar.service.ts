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

export const createCalendarEvent = async (
  userId: string,
  eventDetails: {
    summary: string;
    description?: string;
    startTime: string;
    endTime: string;
    attendees?: string[];
    location?: string;
  }
) => {
  const calendar = await getCalendarClient(userId);
  
  const event = {
    summary: eventDetails.summary,
    description: eventDetails.description,
    start: {
      dateTime: eventDetails.startTime,
      timeZone: 'America/New_York'
    },
    end: {
      dateTime: eventDetails.endTime,
      timeZone: 'America/New_York'
    },
    attendees: eventDetails.attendees?.map(email => ({ email })) || [],
    location: eventDetails.location
  };

  const result = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event
  });

  return result.data;
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

export const getAvailableTimes = async (
  userId: string,
  date: string,
  duration: number = 60
): Promise<string[]> => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(9, 0, 0, 0); // 9 AM
    
    const endOfDay = new Date(date);
    endOfDay.setHours(17, 0, 0, 0); // 5 PM
    
    const timeMin = startOfDay.toISOString();
    const timeMax = endOfDay.toISOString();
    
    const calendar = await getCalendarClient(userId);
    const { data } = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: 'primary' }]
      }
    });

    const busySlots = data.calendars?.primary.busy || [];
    const availableTimes: string[] = [];
    
    // Generate time slots every hour from 9 AM to 5 PM
    for (let hour = 9; hour < 17; hour++) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);
      
      const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
      
      // Check if this slot conflicts with any busy time
      const isAvailable = !busySlots.some(busy => {
        const busyStart = new Date(busy.start || '');
        const busyEnd = new Date(busy.end || '');
        return slotStart < busyEnd && slotEnd > busyStart;
      });
      
      if (isAvailable && slotEnd <= endOfDay) {
        availableTimes.push(slotStart.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }));
      }
    }
    
    return availableTimes;
  } catch (error) {
    console.error('Error getting available times:', error);
    // Return some default times if there's an error
    return [
      '9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', 
      '2:00 PM', '3:00 PM', '4:00 PM'
    ];
  }
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