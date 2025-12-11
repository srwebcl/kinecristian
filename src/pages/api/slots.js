export const prerender = false;

import { google } from 'googleapis';
import { Resend } from 'resend';
import path from 'path';

// --- CONFIGURACIÓN ---
const SCOPES_READ = ['https://www.googleapis.com/auth/calendar.readonly'];
const SCOPES_WRITE = ['https://www.googleapis.com/auth/calendar.events'];

// Función segura para leer variables de entorno
const getEnvVar = (key, optional = false) => {
    const value = import.meta.env[key] || process.env[key];
    if (!value && !optional) throw new Error(`Falta la variable ${key} en el archivo .env`);
    return value;
};

// --- MÉTODO GET: Leer horarios disponibles ---
export const GET = async ({ url }) => {
    const dateStr = url.searchParams.get('date');

    if (!dateStr) {
        return new Response(JSON.stringify({ error: 'Falta la fecha' }), { status: 400 });
    }

    try {
        const credentialsEnv = getEnvVar('GOOGLE_SERVICE_ACCOUNT', true); // Optional env var
        let authOptions = { scopes: SCOPES_READ };

        console.log("Debug: Checking credentials...");

        if (credentialsEnv) {
            console.log("Debug: Found GOOGLE_SERVICE_ACCOUNT env var.");
            try {
                authOptions.credentials = JSON.parse(credentialsEnv);
                console.log("Debug: Successfully parsed credentials from env.");
            } catch (e) {
                console.error("Debug Error: Failed to parse GOOGLE_SERVICE_ACCOUNT", e);
                throw new Error("Invalid JSON in GOOGLE_SERVICE_ACCOUNT env var");
            }
        } else {
            console.log("Debug: GOOGLE_SERVICE_ACCOUNT env var NOT found.");
        }

        if (!authOptions.credentials) {
            console.log("Debug: Fallback to local file /service-account.json");
            // Development / Fallback: Use local file
            // Only try to resolve file if we didn't get credentials from ENV
            const keyFile = path.resolve('./service-account.json');
            authOptions.keyFile = keyFile;
            // Note: This likely fails on Vercel if the file isn't included or found
        }

        const auth = new google.auth.GoogleAuth(authOptions);

        const authClient = await auth.getClient();
        console.log("Debug: Auth client created successfully.");
        const calendar = google.calendar({ version: 'v3', auth: authClient });
        const calendarId = getEnvVar('CALENDAR_ID');
        console.log("Debug: Using Calendar ID:", calendarId ? "Found" : "Missing");

        // Horario: 9:00 a 18:00
        const workStartHour = 9;
        const workEndHour = 18;

        const selectedDate = new Date(dateStr);
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(workStartHour, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(workEndHour, 0, 0, 0);

        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items || [];

        const allSlots = [];
        for (let hour = workStartHour; hour < workEndHour; hour++) {
            allSlots.push(`${hour.toString().padStart(2, '0')}:00`);
        }

        const freeSlots = allSlots.filter(slotTime => {
            const slotHour = parseInt(slotTime.split(':')[0], 10);
            const slotStart = new Date(selectedDate);
            slotStart.setHours(slotHour, 0, 0, 0);
            const slotEnd = new Date(slotStart);
            slotEnd.setHours(slotHour + 1, 0, 0, 0);

            return !events.some(event => {
                const start = new Date(event.start.dateTime || event.start.date);
                const end = new Date(event.end.dateTime || event.end.date);
                return (start < slotEnd && end > slotStart);
            });
        });

        return new Response(JSON.stringify(freeSlots.map(time => ({ time, available: true }))), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error GET:', error);
        return new Response(JSON.stringify({
            error: 'Server Error',
            details: error.message,
            stack: error.stack // Proceed with caution showing stack, but needed for debug
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// --- MÉTODO POST: Guardar y Notificar ---
export const POST = async ({ request }) => {
    try {
        const data = await request.json();
        const { date, time, name, phone, reason, email, address } = data;

        if (!date || !time || !name) {
            return new Response(JSON.stringify({ error: 'Faltan datos obligatorios' }), { status: 400 });
        }

        // 1. Configuración Google Calendar
        const credentialsEnv = getEnvVar('GOOGLE_SERVICE_ACCOUNT', true);
        let authOptions = { scopes: SCOPES_WRITE };

        if (credentialsEnv) {
            try {
                authOptions.credentials = JSON.parse(credentialsEnv);
            } catch (e) {
                console.error("Error parsing GOOGLE_SERVICE_ACCOUNT", e);
            }
        }

        if (!authOptions.credentials) {
            const keyFile = path.resolve('./service-account.json');
            authOptions.keyFile = keyFile;
        }

        const auth = new google.auth.GoogleAuth(authOptions);

        const authClient = await auth.getClient();
        const calendar = google.calendar({ version: 'v3', auth: authClient });
        const calendarId = getEnvVar('CALENDAR_ID');

        // 2. Preparar Fechas
        const [hour, minute] = time.split(':');
        const startDateTime = new Date(date);
        startDateTime.setHours(parseInt(hour), parseInt(minute), 0);
        const endDateTime = new Date(startDateTime);
        endDateTime.setHours(startDateTime.getHours() + 1); // Duración 1 hora

        // 3. Crear Evento en Google (Con dirección para Maps)
        const event = {
            summary: `Kine: ${name}`,
            location: address, // Esto activa el mapa en Google Calendar
            description: `Paciente: ${name}\nTeléfono: ${phone}\nMotivo: ${reason}\nDir: ${address}\nEmail: ${email}\n\nReservado desde la web.`,
            start: { dateTime: startDateTime.toISOString(), timeZone: 'America/Santiago' },
            end: { dateTime: endDateTime.toISOString(), timeZone: 'America/Santiago' },
        };

        const insertResponse = await calendar.events.insert({
            calendarId: calendarId,
            resource: event,
        });

        // 4. Enviar Notificación por Correo (Resend)
        try {
            const resendApiKey = getEnvVar('RESEND_API_KEY');
            const resend = new Resend(resendApiKey);

            const fechaLegible = new Date(date).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

            // Enlaces Inteligentes
            const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
            const waLinkPatient = `https://wa.me/${phone.replace(/\+/g, '').replace(/\s/g, '')}`;
            const kineWaLink = "https://wa.me/56972881781"; // Tu número nuevo

            // A) EMAIL AL PROFESIONAL (Dashboard Técnico)
            await resend.emails.send({
                from: 'Agenda Kine <no-reply@send.kinecristian.cl>',
                to: ['contacto@kinecristian.cl'],
                subject: `🔔 NUEVA CITA: ${name} - ${time} hrs`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                        <div style="background-color: #0f172a; padding: 20px; text-align: center; border-bottom: 4px solid #57e2e5;">
                            <h2 style="color: #ffffff; margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">Nueva Reserva Agendada</h2>
                        </div>
                        <div style="padding: 25px;">
                            <div style="text-align: center; margin-bottom: 25px;">
                                <h1 style="margin: 0; color: #0f4c75; font-size: 24px;">${name}</h1>
                                <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;">Paciente</p>
                            </div>
                            <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; border: 1px solid #cbd5e1;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr><td style="padding: 8px 0; color: #475569; font-weight: bold; width: 80px;">📅 Cuándo:</td><td style="padding: 8px 0; color: #334155;">${fechaLegible} a las <strong>${time} hrs</strong></td></tr>
                                    <tr><td style="padding: 8px 0; color: #475569; font-weight: bold;">🩺 Motivo:</td><td style="padding: 8px 0; color: #334155;">${reason}</td></tr>
                                    <tr><td style="padding: 8px 0; color: #475569; font-weight: bold; vertical-align: top;">📍 Dónde:</td><td style="padding: 8px 0; color: #334155;">${address}<br><a href="${mapsLink}" style="color: #0f4c75; font-size: 12px; font-weight: bold; text-decoration: none; display: inline-block; margin-top: 4px;">🗺️ Ver en Google Maps →</a></td></tr>
                                </table>
                            </div>
                            <div style="margin-top: 25px; text-align: center;">
                                <a href="${waLinkPatient}" style="display: inline-block; background-color: #25d366; color: white; padding: 12px 24px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">💬 WhatsApp al Paciente</a>
                            </div>
                            <div style="margin-top: 15px; text-align: center;">
                                <a href="tel:${phone}" style="color: #64748b; text-decoration: none; font-size: 14px;">📞 Llamar: ${phone}</a>
                            </div>
                        </div>
                    </div>
                `
            });

            // B) EMAIL AL PACIENTE (Bienvenida y Precio)
            if (email) {
                await resend.emails.send({
                    from: 'Kine Cristian <no-reply@send.kinecristian.cl>',
                    to: [email],
                    subject: `Confirmación de Reserva - ${fechaLegible}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                            <div style="background-color: #0f172a; padding: 20px; text-align: center;">
                                <h2 style="color: #fff; margin: 0;">Reserva Confirmada</h2>
                            </div>
                            <div style="padding: 30px;">
                                <p>Hola <strong>${name}</strong>,</p>
                                <p>Tu sesión de kinesiología a domicilio ha sido reservada con éxito. Aquí están los detalles:</p>
                                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #57e2e5;">
                                    <p style="margin: 5px 0;"><strong>📅 Fecha:</strong> ${fechaLegible}</p>
                                    <p style="margin: 5px 0;"><strong>⏰ Hora:</strong> ${time} hrs</p>
                                    <p style="margin: 5px 0;"><strong>📍 Dirección:</strong> ${address}</p>
                                    <p style="margin: 5px 0;"><strong>💰 Valor Sesión:</strong> $25.000 / $30.000 (Según evaluación)</p>
                                </div>
                                <h3>Información Importante:</h3>
                                <ul>
                                    <li>El kinesiólogo llegará a la dirección indicada.</li>
                                    <li><strong>Formas de Pago:</strong> Transferencia o Efectivo al finalizar.</li>
                                </ul>
                                <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
                                <p style="font-size: 12px; color: #64748b; text-align: center;">
                                    ¿Dudas o necesitas reprogramar? <br/>
                                    <a href="${kineWaLink}" style="color: #0f4c75; font-weight: bold;">Contáctanos al WhatsApp: +56 9 7288 1781</a>
                                </p>
                            </div>
                        </div>
                    `
                });
            }

        } catch (emailError) {
            console.error("⚠️ La reserva se creó, pero falló el correo:", emailError);
        }

        return new Response(JSON.stringify({ success: true, id: insertResponse.data.id }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('❌ Error POST:', error);
        return new Response(JSON.stringify({
            error: 'Error al procesar reserva',
            details: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};