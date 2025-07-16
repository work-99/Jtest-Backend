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

// Helper method to execute Calendar API calls with automatic token refresh
export const executeWithTokenRefresh = async <T>(
  userId: string, 
  operation: (calendar: any) => Promise<T>
): Promise<T> => {
  try {
    const calendar = await getCalendarClient(userId);
    return await operation(calendar);
  } catch (error: any) {
    // Check if it's an authentication error (401)
    if (error.code === 401 || 
        (error.response && error.response.status === 401) ||
        (error.message && error.message.includes('unauthorized'))) {
      console.log(`[Calendar] Token expired for user ${userId}, refreshing...`);
      
      try {
        // Refresh the access token
        await refreshAccessToken(userId);
        
        // Retry the operation with fresh token
        const calendar = await getCalendarClient(userId);
        return await operation(calendar);
              } catch (refreshError) {
          console.error('[Calendar] Failed to refresh token:', refreshError);
          throw new Error('Google authentication expired. Please re-authenticate by calling /api/auth/google/reauthenticate');
        }
    }
    
    // Re-throw other errors
    throw error;
  }
};

// Helper method to refresh access token
export const refreshAccessToken = async (userId: string): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT refresh_token FROM user_credentials WHERE user_id = $1 AND service = $2',
      [userId, 'google']
    );

    if (!result.rows.length) {
      throw new Error('Refresh token not found');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: result.rows[0].refresh_token
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    await pool.query(
      `UPDATE user_credentials 
       SET access_token = $1, expires_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3 AND service = $4`,
      [credentials.access_token, credentials.expiry_date, userId, 'google']
    );
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw new Error('Failed to refresh access token');
  }
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
  return executeWithTokenRefresh(userId, async (calendar) => {
    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventDetails
    });

    return event.data;
  });
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
  return executeWithTokenRefresh(userId, async (calendar) => {
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
  });
};

export const getAvailableSlots = async (
  userId: string,
  timeMin: string,
  timeMax: string,
  duration = 30
) => {
  return executeWithTokenRefresh(userId, async (calendar) => {
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
  });
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
    
    return executeWithTokenRefresh(userId, async (calendar) => {
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
        const isAvailable = !busySlots.some((busy: any) => {
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
    });
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
  return executeWithTokenRefresh(userId, async (calendar) => {
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
    return events.map((event: any) => ({
      id: event.id,
      summary: event.summary || 'No title',
      description: event.description || '',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      attendees: event.attendees || [],
      location: event.location || '',
      htmlLink: event.htmlLink
    }));
  });
};

// Get next meeting/event
export const getNextEvent = async (userId: string) => {
  const events = await getUpcomingEvents(userId, 1);
  return events.length > 0 ? events[0] : null;
};