// SeaRates API Integration
// Official API for FCL, LCL, Air Freight, and Railway quotes
// Subscription: Logistics Explorer - 50 API calls per month

import { supabase } from './supabase';
import { showToast } from './ui';
import { captureCustomerInfo, submitQuoteRequest } from './email-capture';

// API Configuration
const SEARATES_API_KEY = 'K-21EB16AA-B6A6-4D41-9365-5882597F9B11';
const SEARATES_BASE_URL = 'https://nlzkghwkdwzjpzdmjuil.functions.supabase.co';
const MONTHLY_LIMIT = 50;

// Port code mapping for common locations
const PORT_CODES: { [key: string]: string } = {
    // China
    'shanghai': 'CNSHA', 'shenzhen': 'CNSZX', 'ningbo': 'CNNGB', 'guangzhou': 'CNGZS',
    // USA
    'los angeles': 'USLAX', 'new york': 'USNYC', 'long beach': 'USLGB', 'oakland': 'USOAK',
    // Europe
    'rotterdam': 'NLRTM', 'hamburg': 'DEHAM', 'antwerp': 'BEANR', 'felixstowe': 'GBFXT',
    'london': 'GBLGP', 'southampton': 'GBSOU',
    // Asia
    'singapore': 'SGSIN', 'hong kong': 'HKHKG', 'busan': 'KRPUS', 'tokyo': 'JPTYO',
    // Middle East
    'dubai': 'AEDXB', 'jebel ali': 'AEJEA',
    // Default fallback
    'default': 'CNSHA'
};

interface SeaRatesQuoteRequest {
    mode: 'fcl' | 'lcl' | 'air';
    origin: {
        country: string;
        city?: string;
        port?: string;
    };
    destination: {
        country: string;
        city?: string;
        port?: string;
    };
    containers?: Array<{
        type: '20GP' | '40GP' | '40HC' | '45HC';
        quantity: number;
    }>;
    cargo?: {
        weight: number;
        volume: number;
    };
}

interface SeaRatesQuote {
    carrier: string;
    service: string;
    transitTime: string;
    price: number;
    currency: string;
    validUntil?: string;
    route?: string;
}

/**
 * Get remaining API calls for the current month
 */
async function getRemainingCalls(): Promise<number> {
    try {
        const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
        const key = `searates_calls_${currentMonth}`;
        
        const callsUsed = parseInt(localStorage.getItem(key) || '0', 10);
        return MONTHLY_LIMIT - callsUsed;
    } catch (error) {
        console.error('Error getting remaining calls:', error);
        return 0;
    }
}

/**
 * Increment API call counter
 */
async function incrementCallCounter(): Promise<void> {
    try {
        const currentMonth = new Date().toISOString().substring(0, 7);
        const key = `searates_calls_${currentMonth}`;
        
        const callsUsed = parseInt(localStorage.getItem(key) || '0', 10);
        localStorage.setItem(key, String(callsUsed + 1));
        
        const remaining = MONTHLY_LIMIT - (callsUsed + 1);
        console.log(`SeaRates API calls remaining this month: ${remaining}/${MONTHLY_LIMIT}`);
        
        if (remaining <= 5) {
            showToast(`Warning: Only ${remaining} SeaRates API calls left this month`, 'warning', 5000);
        }
    } catch (error) {
        console.error('Error incrementing call counter:', error);
    }
}

/**
 * Get nearest port code from city/country
 */
function getPortCode(location: string, country: string): string {
    const searchTerm = location.toLowerCase();
    
    // Try exact match first
    if (PORT_CODES[searchTerm]) {
        return PORT_CODES[searchTerm];
    }
    
    // Try partial match
    for (const [key, code] of Object.entries(PORT_CODES)) {
        if (searchTerm.includes(key) || key.includes(searchTerm)) {
            return code;
        }
    }
    
    // Country-based defaults
    const countryUpper = country.toUpperCase();
    if (countryUpper.includes('CN') || countryUpper.includes('CHINA')) return 'CNSHA';
    if (countryUpper.includes('US') || countryUpper.includes('USA')) return 'USLAX';
    if (countryUpper.includes('GB') || countryUpper.includes('UK')) return 'GBLGP';
    if (countryUpper.includes('DE') || countryUpper.includes('GERMANY')) return 'DEHAM';
    if (countryUpper.includes('NL') || countryUpper.includes('NETHERLANDS')) return 'NLRTM';
    
    return PORT_CODES.default;
}

/**
 * Call SeaRates API through Supabase Edge Function
 */
async function callSeaRatesAPI(request: SeaRatesQuoteRequest): Promise<SeaRatesQuote[]> {
    // Check remaining calls
    const remaining = await getRemainingCalls();
    if (remaining <= 0) {
        throw new Error('QUOTA_EXCEEDED');
    }
    
    try {
        // Determine the correct endpoint based on mode
        const endpoint = request.mode === 'air' 
            ? '/sea-rates-proxy/air/rates'
            : '/sea-rates-api-db-config/rates/search';
        
        const { data, error } = await supabase.functions.invoke('sea-rates-proxy', {
            body: {
                endpoint,
                method: 'POST',
                apiKey: SEARATES_API_KEY,
                data: {
                    ...request,
                    origin: {
                        ...request.origin,
                        port: request.origin.port || getPortCode(
                            request.origin.city || request.origin.country,
                            request.origin.country
                        )
                    },
                    destination: {
                        ...request.destination,
                        port: request.destination.port || getPortCode(
                            request.destination.city || request.destination.country,
                            request.destination.country
                        )
                    }
                }
            }
        });
        
        if (error) {
            console.error('SeaRates API error:', error);
            throw error;
        }
        
        // Increment counter on successful call
        await incrementCallCounter();
        
        // Parse and format response
        return parseSeaRatesResponse(data, request.mode);
        
    } catch (error: any) {
        console.error('SeaRates API call failed:', error);
        throw error;
    }
}

/**
 * Parse SeaRates API response into standardized format
 */
function parseSeaRatesResponse(data: any, mode: string): SeaRatesQuote[] {
    if (!data || !data.rates) {
        return [];
    }
    
    return data.rates.map((rate: any) => ({
        carrier: rate.carrier || rate.airline || 'Carrier',
        service: rate.service || 'Standard',
        transitTime: rate.transit_time || rate.transitTime || 'N/A',
        price: parseFloat(rate.total_price || rate.price || 0),
        currency: rate.currency || 'USD',
        validUntil: rate.valid_until || rate.validUntil,
        route: rate.route || `${mode.toUpperCase()} Freight`
    })).filter((quote: SeaRatesQuote) => quote.price > 0);
}

/**
 * Get FCL (Full Container Load) quotes
 */
export async function getFCLQuotes(
    origin: { country: string; city?: string },
    destination: { country: string; city?: string },
    containers: Array<{ type: '20GP' | '40GP' | '40HC' | '45HC'; quantity: number }>
): Promise<SeaRatesQuote[]> {
    try {
        const quotes = await callSeaRatesAPI({
            mode: 'fcl',
            origin,
            destination,
            containers
        });
        
        return quotes;
    } catch (error: any) {
        if (error.message === 'QUOTA_EXCEEDED') {
            showToast('Monthly API limit reached. Generating AI estimate...', 'warning', 3000);
        }
        throw error;
    }
}

/**
 * Get LCL (Less than Container Load) quotes
 */
export async function getLCLQuotes(
    origin: { country: string; city?: string },
    destination: { country: string; city?: string },
    cargo: { weight: number; volume: number }
): Promise<SeaRatesQuote[]> {
    try {
        const quotes = await callSeaRatesAPI({
            mode: 'lcl',
            origin,
            destination,
            cargo
        });
        
        return quotes;
    } catch (error: any) {
        if (error.message === 'QUOTA_EXCEEDED') {
            showToast('Monthly API limit reached. Generating AI estimate...', 'warning', 3000);
        }
        throw error;
    }
}

/**
 * Get Air Freight quotes
 */
export async function getAirFreightQuotes(
    origin: { country: string; city?: string },
    destination: { country: string; city?: string },
    cargo: { weight: number; volume: number }
): Promise<SeaRatesQuote[]> {
    try {
        const quotes = await callSeaRatesAPI({
            mode: 'air',
            origin,
            destination,
            cargo
        });
        
        return quotes;
    } catch (error: any) {
        if (error.message === 'QUOTA_EXCEEDED') {
            showToast('Monthly API limit reached. Generating AI estimate...', 'warning', 3000);
        }
        throw error;
    }
}

/**
 * Display API usage stats
 */
export async function displayAPIUsage(): Promise<void> {
    const remaining = await getRemainingCalls();
    const used = MONTHLY_LIMIT - remaining;
    
    console.log(`
    ═══════════════════════════════════════
    📊 SeaRates API Usage (Current Month)
    ═══════════════════════════════════════
    Subscription: Logistics Explorer
    Calls Used: ${used}/${MONTHLY_LIMIT}
    Calls Remaining: ${remaining}
    ═══════════════════════════════════════
    `);
    
    return;
}
