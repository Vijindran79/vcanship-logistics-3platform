// shippo-api.ts
// Shippo API Integration for Parcel Shipping
// Provides real carrier rates from USPS, FedEx, UPS, DHL

import { supabase } from './supabase';
import { showToast } from './ui';

// Shippo API configuration
const SHIPPO_BASE_URL = 'https://api.goshippo.com';

export interface ShippoAddress {
    name: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
    email?: string;
}

export interface ShippoParcel {
    length: number;  // inches
    width: number;   // inches
    height: number;  // inches
    weight: number;  // pounds
    distance_unit: 'in';
    mass_unit: 'lb';
}

export interface ShippoRate {
    object_id: string;
    carrier: string;
    service: string;
    servicelevel_name: string;
    amount: string;
    currency: string;
    estimated_days: number;
    duration_terms: string;
    provider: string;
    provider_image_75: string;
    provider_image_200: string;
}

export interface ShippoLabel {
    tracking_number: string;
    label_url: string;
    commercial_invoice_url?: string;
    carrier: string;
    service: string;
    eta: string;
}

/**
 * Call Shippo API through Supabase Edge Function
 */
async function callShippoAPI(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    try {
        const { data: response, error } = await supabase.functions.invoke('shippo-proxy', {
            body: {
                endpoint,
                method,
                data
            }
        });
        
        if (error) {
            console.error('Shippo API error:', error);
            throw error;
        }
        
        return response;
        
    } catch (error: any) {
        console.error('Shippo API call failed:', error);
        throw error;
    }
}

/**
 * Get real-time shipping rates from multiple carriers
 */
export async function getParcelRates(
    fromAddress: ShippoAddress,
    toAddress: ShippoAddress,
    parcel: ShippoParcel
): Promise<ShippoRate[]> {
    try {
        // Create shipment to get rates
        const shipmentData = {
            address_from: fromAddress,
            address_to: toAddress,
            parcels: [parcel],
            async: false
        };
        
        const shipment = await callShippoAPI('/shipments/', 'POST', shipmentData);
        
        if (!shipment || !shipment.rates) {
            throw new Error('No rates returned from Shippo');
        }
        
        // Filter out invalid rates and sort by price
        const validRates = shipment.rates
            .filter((rate: any) => 
                rate.available === true && 
                parseFloat(rate.amount) > 0
            )
            .sort((a: any, b: any) => 
                parseFloat(a.amount) - parseFloat(b.amount)
            );
        
        console.log(`📦 Shippo: Found ${validRates.length} rates from carriers`);
        
        return validRates;
        
    } catch (error: any) {
        console.error('Failed to get parcel rates:', error);
        throw error;
    }
}

/**
 * Purchase shipping label
 */
export async function purchaseLabel(rateId: string): Promise<ShippoLabel> {
    try {
        const transaction = await callShippoAPI('/transactions/', 'POST', {
            rate: rateId,
            label_file_type: 'PDF',
            async: false
        });
        
        if (!transaction || transaction.status !== 'SUCCESS') {
            throw new Error('Failed to purchase label');
        }
        
        const label: ShippoLabel = {
            tracking_number: transaction.tracking_number,
            label_url: transaction.label_url,
            commercial_invoice_url: transaction.commercial_invoice_url,
            carrier: transaction.carrier_account.carrier,
            service: transaction.servicelevel.name,
            eta: transaction.eta
        };
        
        console.log(`✅ Label purchased: ${label.tracking_number}`);
        
        return label;
        
    } catch (error: any) {
        console.error('Failed to purchase label:', error);
        throw error;
    }
}

/**
 * Track shipment by tracking number
 */
export async function trackShipment(
    carrier: string,
    trackingNumber: string
): Promise<any> {
    try {
        const carrierCode = getCarrierCode(carrier);
        const tracking = await callShippoAPI(
            `/tracks/${carrierCode}/${trackingNumber}`,
            'GET'
        );
        
        return tracking;
        
    } catch (error: any) {
        console.error('Failed to track shipment:', error);
        throw error;
    }
}

/**
 * Validate address
 */
export async function validateAddress(address: ShippoAddress): Promise<{
    is_valid: boolean;
    messages: string[];
    validated_address?: ShippoAddress;
}> {
    try {
        const result = await callShippoAPI('/addresses/', 'POST', {
            ...address,
            validate: true
        });
        
        return {
            is_valid: result.validation_results?.is_valid || false,
            messages: result.validation_results?.messages || [],
            validated_address: result.validation_results?.is_valid ? result : undefined
        };
        
    } catch (error: any) {
        console.error('Address validation failed:', error);
        return {
            is_valid: false,
            messages: ['Address validation service unavailable']
        };
    }
}

/**
 * Get carrier code for tracking
 */
function getCarrierCode(carrier: string): string {
    const carrierMap: { [key: string]: string } = {
        'usps': 'usps',
        'fedex': 'fedex',
        'ups': 'ups',
        'dhl': 'dhl_express',
        'dhl express': 'dhl_express',
        'canada post': 'canada_post'
    };
    
    const normalized = carrier.toLowerCase();
    return carrierMap[normalized] || normalized;
}

/**
 * Convert dimensions from CM to Inches
 */
export function cmToInches(cm: number): number {
    return cm / 2.54;
}

/**
 * Convert weight from KG to Pounds
 */
export function kgToPounds(kg: number): number {
    return kg * 2.20462;
}

/**
 * Format Shippo rate for display
 */
export function formatRate(rate: ShippoRate): {
    carrier: string;
    service: string;
    price: number;
    currency: string;
    days: string;
    logo: string;
} {
    return {
        carrier: rate.provider || rate.carrier,
        service: rate.servicelevel_name || rate.service,
        price: parseFloat(rate.amount),
        currency: rate.currency,
        days: rate.estimated_days 
            ? `${rate.estimated_days} ${rate.estimated_days === 1 ? 'day' : 'days'}`
            : rate.duration_terms || 'N/A',
        logo: rate.provider_image_200 || rate.provider_image_75 || ''
    };
}

/**
 * Display Shippo service status
 */
export function displayShippoStatus(): void {
    console.log(`
    ═══════════════════════════════════════
    📦 Shippo API Status
    ═══════════════════════════════════════
    Service: Parcel Shipping
    Carriers: USPS, FedEx, UPS, DHL
    Features: 
      ✓ Real-time rate shopping
      ✓ Label generation
      ✓ Tracking integration
      ✓ Address validation
    Status: Active
    ═══════════════════════════════════════
    `);
}
