// api-config.ts
// Centralized API keys and configuration

export const API_CONFIG = {
    // Geoapify API keys (for address autocomplete, geocoding, maps)
    GEOAPIFY: {
        API_KEY: 'b0b098c3980140a9a8f6895c34f1bb29',
        AUTOCOMPLETE_URL: 'https://api.geoapify.com/v1/geocode/autocomplete',
        GEOCODING_URL: 'https://api.geoapify.com/v1/geocode/search',
        STATIC_MAPS_URL: 'https://maps.geoapify.com/v1/staticmap'
    },

    // Supabase configuration (Edge Functions are deployed here)
    SUPABASE: {
        URL: 'https://nlzkghwkdwzjpzdmjuil.supabase.co',
        ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5semtnaHdrZHd6anB6ZG1qdWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3OTYxNzcsImV4cCI6MjA3MDM3MjE3N30.umFzkfIP3Ws5hmXxoEdxrU0V6XyyNZUtapr7411C9N8'
    },

    // Shippo API (via Supabase Edge Function)
    SHIPPO: {
        EDGE_FUNCTION: 'shippo-proxy',
        // API key stored securely in Supabase secrets as SHIPPO_LIVE_API_KEY
    },

    // SeaRates API (via Supabase Edge Function)
    SEARATES: {
        EDGE_FUNCTION: 'sea-rates-proxy',
        // API key stored securely in Supabase secrets as SEARATES_API_KEY
    }
};

/**
 * Get address autocomplete suggestions using Geoapify
 * @param query - The search query (partial address)
 * @param type - Filter by type: 'city', 'postcode', 'street', 'amenity'
 * @returns Array of address suggestions
 */
export async function getAddressAutocomplete(query: string, type?: string): Promise<any[]> {
    if (!query || query.length < 3) {
        return [];
    }

    try {
        const params = new URLSearchParams({
            text: query,
            apiKey: API_CONFIG.GEOAPIFY.API_KEY,
            limit: '5'
        });

        if (type) {
            params.append('type', type);
        }

        const response = await fetch(`${API_CONFIG.GEOAPIFY.AUTOCOMPLETE_URL}?${params}`);
        const data = await response.json();

        if (!response.ok) {
            console.error('Geoapify autocomplete error:', data);
            return [];
        }

        return data.features || [];
    } catch (error) {
        console.error('Address autocomplete failed:', error);
        return [];
    }
}

/**
 * Geocode an address to get coordinates using Geoapify
 * @param address - Full address string
 * @returns Geocoding result with coordinates
 */
export async function geocodeAddress(address: string): Promise<any | null> {
    if (!address) {
        return null;
    }

    try {
        const params = new URLSearchParams({
            text: address,
            apiKey: API_CONFIG.GEOAPIFY.API_KEY,
            limit: '1'
        });

        const response = await fetch(`${API_CONFIG.GEOAPIFY.GEOCODING_URL}?${params}`);
        const data = await response.json();

        if (!response.ok || !data.features || data.features.length === 0) {
            console.error('Geoapify geocoding error:', data);
            return null;
        }

        return data.features[0];
    } catch (error) {
        console.error('Geocoding failed:', error);
        return null;
    }
}

/**
 * Format Geoapify autocomplete result for display
 * @param feature - Geoapify feature object
 * @returns Formatted address object
 */
export function formatGeoapifyAddress(feature: any): {
    street: string;
    city: string;
    postcode: string;
    country: string;
    state?: string;
    formatted: string;
} {
    const props = feature.properties || {};
    
    return {
        street: props.street || props.address_line1 || '',
        city: props.city || '',
        postcode: props.postcode || '',
        country: props.country || '',
        state: props.state || props.county || '',
        formatted: props.formatted || feature.properties?.name || ''
    };
}
