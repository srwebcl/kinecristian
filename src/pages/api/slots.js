
import { google } from 'googleapis';

const calendar = google.calendar('v3');
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

export const GET = async ({ request }) => {
    const url = new URL(request.url);
    const dateStr = url.searchParams.get('date');

    if (!dateStr) {
        return new Response(JSON.stringify({ error: 'Date is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: './service-account.json',
            scopes: SCOPES,
        });

        const authClient = await auth.getClient();

        // Define working hours (e.g., 9 AM to 6 PM)
        const workStartHour = 9;
        const workEndHour = 18;

        const selectedDate = new Date(dateStr);
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(workStartHour, 0, 0, 0);

        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(workEndHour, 0, 0, 0);

        // Fetch events from Google Calendar
        const response = await calendar.events.list({
            auth: authClient,
            calendarId: process.env.CALENDAR_ID,
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items || [];

        // Generate all possible slots
        const allSlots = [];
        for (let hour = workStartHour; hour < workEndHour; hour++) {
            // Using logic to exclude lunch time if needed, or just all hours
            allSlots.push(`${hour.toString().padStart(2, '0')}:00`);
        }

        // Filter out occupied slots
        const freeSlots = allSlots.filter(slotTime => {
            const slotHour = parseInt(slotTime.split(':')[0], 10);

            // Check if any event overlaps with this hour
            const isOccupied = events.some(event => {
                const eventStart = new Date(event.start.dateTime || event.start.date);
                const eventEnd = new Date(event.end.dateTime || event.end.date);

                // Simplified check: strictly checks if the event *starts* at this hour 
                // or covers the entire hour. 
                // Ideally we should check strict overlap logic.
                // Let's assume hourly slots for simplicity as per original demo
                const slotStart = new Date(selectedDate);
                slotStart.setHours(slotHour, 0, 0, 0);

                const slotEnd = new Date(slotStart);
                slotEnd.setHours(slotHour + 1, 0, 0, 0);

                return (eventStart < slotEnd && eventEnd > slotStart);
            });

            return !isOccupied;
        });

        // Map to format expected by frontend
        const slotsWithOptions = freeSlots.map(time => ({
            time,
            available: true
        }));

        return new Response(JSON.stringify(slotsWithOptions), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error fetching calendar:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch slots', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
