"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNextEvent = exports.getUpcomingEvents = exports.getAvailableSlots = exports.scheduleEvent = exports.getCalendarClient = void 0;
// services/calendar.service.ts
const googleapis_1 = require("googleapis");
const db_1 = __importDefault(require("../config/db"));
const getCalendarClient = async (userId) => {
    const result = await db_1.default.query('SELECT access_token, refresh_token FROM user_credentials WHERE user_id = $1 AND service = $2', [userId, 'google']);
    if (!result.rows.length) {
        throw new Error('Google credentials not found');
    }
    const { access_token, refresh_token } = result.rows[0];
    const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
    oauth2Client.setCredentials({
        access_token,
        refresh_token
    });
    return googleapis_1.google.calendar({ version: 'v3', auth: oauth2Client });
};
exports.getCalendarClient = getCalendarClient;
const scheduleEvent = async (userId, eventDetails) => {
    const calendar = await (0, exports.getCalendarClient)(userId);
    const event = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: eventDetails
    });
    return event.data;
};
exports.scheduleEvent = scheduleEvent;
const getAvailableSlots = async (userId, timeMin, timeMax, duration = 30) => {
    const calendar = await (0, exports.getCalendarClient)(userId);
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
exports.getAvailableSlots = getAvailableSlots;
// Helper function to find available time slots
function findAvailableSlots(busySlots, timeMin, timeMax, duration) {
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
const getUpcomingEvents = async (userId, maxResults = 10) => {
    try {
        const calendar = await (0, exports.getCalendarClient)(userId);
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
    }
    catch (error) {
        console.error('Error fetching calendar events:', error);
        throw new Error('Failed to fetch calendar events');
    }
};
exports.getUpcomingEvents = getUpcomingEvents;
// Get next meeting/event
const getNextEvent = async (userId) => {
    try {
        const events = await (0, exports.getUpcomingEvents)(userId, 1);
        return events.length > 0 ? events[0] : null;
    }
    catch (error) {
        console.error('Error fetching next event:', error);
        throw new Error('Failed to fetch next event');
    }
};
exports.getNextEvent = getNextEvent;
