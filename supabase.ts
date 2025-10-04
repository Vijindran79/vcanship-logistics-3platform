// supabase.ts
import { createClient, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { State, setState } from './state';

// --- Supabase Client Initialization ---

const SUPABASE_URL = 'https://nlzkghwkdwzjpzdmjuil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5semtnaHdrZHd6anB6ZG1qdWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3OTYxNzcsImV4cCI6MjA3MDM3MjE3N30.umFzkfIP3Ws5hmXxoEdxrU0V6XyyNZUtapr7411C9N8';

// Initialize the client with auth configuration
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});


// --- Database Interaction Functions ---

interface ShipmentLogData {
    service: string;
    tracking_id: string;
    origin: string;
    destination: string;
    cost: number;
    currency: string;
    user_email?: string | null;
}

/**
 * Logs a completed shipment to the Supabase 'shipments' table.
 * @param data - The details of the shipment to log.
 */
export async function logShipment(data: ShipmentLogData): Promise<void> {
    try {
        const { error } = await supabase
            .from('shipments')
            .insert({
                id: uuidv4(), // Generate a unique ID for the shipment
                service: data.service,
                tracking_id: data.tracking_id,
                origin: data.origin,
                destination: data.destination,
                cost: data.cost,
                currency: data.currency,
                user_email: State.currentUser?.email || null, // Associate with logged-in user
            });

        if (error) {
            throw error;
        }

        console.log(`Shipment ${data.tracking_id} successfully logged to Supabase.`);
    } catch (error) {
        console.error("Error logging shipment to Supabase:", error);
        // We don't show a toast here to avoid interrupting the user's success flow.
        // The error is logged for debugging purposes.
    }
}
