
import { CalendarEvent } from '../types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export const listEvents = async (accessToken: string, timeMin?: string, timeMax?: string): Promise<{ success: boolean; events?: CalendarEvent[]; message?: string }> => {
    try {
        const min = timeMin || new Date().toISOString();
        // Default to 7 days if not specified
        const max = timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const url = `${CALENDAR_API_BASE}/calendars/primary/events?timeMin=${encodeURIComponent(min)}&timeMax=${encodeURIComponent(max)}&singleEvents=true&orderBy=startTime`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            if (error.error.code === 401) {
                return { success: false, message: 'UNAUTHENTICATED' };
            }
            throw new Error(error.error.message);
        }

        const data = await response.json();
        return { success: true, events: data.items };
    } catch (error: any) {
        console.error("List Calendar Events Error:", error);
        return { success: false, message: error.message || "Failed to fetch events." };
    }
};

export const createEvent = async (accessToken: string, event: { summary: string, description?: string, location?: string, start: string, end: string }): Promise<{ success: boolean; eventLink?: string; message?: string }> => {
    try {
        const body = {
            summary: event.summary,
            description: event.description,
            location: event.location,
            start: {
                dateTime: event.start,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            end: {
                dateTime: event.end,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
        };

        const response = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
             if (error.error.code === 401) {
                return { success: false, message: 'UNAUTHENTICATED' };
            }
            throw new Error(error.error.message);
        }

        const data = await response.json();
        return { success: true, eventLink: data.htmlLink };
    } catch (error: any) {
        console.error("Create Calendar Event Error:", error);
        return { success: false, message: error.message || "Failed to create event." };
    }
};
