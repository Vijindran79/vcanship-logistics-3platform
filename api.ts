// This file has been completely refactored for a secure, backend-driven architecture.
// All Gemini API calls are now proxied through Supabase Edge Functions.

import { State, setState, type Quote, type Address, ApiResponse } from './state';
import { showToast, showUsageLimitModal, updateLookupCounterUI } from './ui';
import { supabase } from './supabase';

/**
 * Checks if the user has remaining AI lookups and decrements the counter.
 * This is called BEFORE making a request to the backend.
 * Shows a modal if the limit is reached.
 * @returns {boolean} - True if the lookup can proceed, false otherwise.
 */
export function checkAndDecrementLookup(): boolean {
    if (State.subscriptionTier === 'pro') {
        return true; // Pro users have unlimited lookups.
    }
    
    if (!State.isLoggedIn) { // Guest user
        let guestLookups = parseInt(localStorage.getItem('vcanship_guest_lookups') || '2', 10);
        if (guestLookups > 0) {
            guestLookups--;
            localStorage.setItem('vcanship_guest_lookups', String(guestLookups));
            updateLookupCounterUI();
            return true;
        } else {
            showUsageLimitModal('guest');
            return false;
        }
    } else { // Free logged-in user
        if (State.aiLookupsRemaining > 0) {
            const newCount = State.aiLookupsRemaining - 1;
            setState({ aiLookupsRemaining: newCount });
            // In a real app, this would be persisted to the backend.
            localStorage.setItem('vcanship_free_lookups', String(newCount));
            updateLookupCounterUI();
            return true;
        } else {
            showUsageLimitModal('free');
            return false;
        }
    }
}

/**
 * A generic handler for Supabase function invocation errors.
 * It logs the error and shows a user-friendly toast message.
 * @param error - The error object from a Supabase function call.
 * @param context - A string describing the context of the error (e.g., "address validation").
 */
function handleSupabaseError(error: any, context: string) {
    console.error(`Supabase function error (${context}):`, error);
    
    let message = `An error occurred during ${context}. Please try again.`;
    if (error.message.includes('QUOTA_EXCEEDED')) {
        message = "API quota has been exceeded. Please try again later.";
    } else if (error.message.includes('NetworkError')) {
        message = "A network error occurred. Please check your connection.";
    }
    
    showToast(message, "error");
}


/**
 * Validates an address by calling a secure Supabase Edge Function.
 * @param address The address string to validate.
 * @returns A validated address object or null on failure.
 */
export async function validateAddress(address: string): Promise<any | null> {
    if (!checkAndDecrementLookup()) return null;

    try {
        const { data, error } = await supabase.functions.invoke('validate-address', {
            body: { address_string: address },
        });

        if (error) {
            handleSupabaseError(error, "address validation");
            return null;
        }
        return data; // Assuming the function returns the validated address structure
    } catch (e) {
        handleSupabaseError(e, "address validation");
        return null;
    }
}

/**
 * Generic function to invoke a Gemini-powered Supabase Edge Function.
 * @param functionName The name of the Supabase Edge Function to call.
 * @param payload The data to send to the function.
 * @returns The data from the function or throws an error.
 */
async function invokeAiFunction(functionName: string, payload: object): Promise<any> {
    if (!checkAndDecrementLookup()) {
        throw new Error("Usage limit reached.");
    }

    try {
        const { data, error } = await supabase.functions.invoke(functionName, {
            body: payload,
        });

        if (error) {
            throw error;
        }
        
        // The backend function might return a JSON string, which we parse here.
        if (typeof data === 'string') {
             try {
                return JSON.parse(data);
             } catch (e) {
                // If it's not JSON, return the raw string.
                return data;
             }
        }
        return data;

    } catch (error) {
        handleSupabaseError(error, `AI function ${functionName}`);
        throw error;
    }
}

/**
 * Fetches HS Code suggestions via the backend.
 */
export async function getHsCodeSuggestions(description: string): Promise<{ code: string; description: string }[]> {
    try {
        const results = await invokeAiFunction('get-hs-code', { description });
        return results.suggestions || [];
    } catch (error) {
        // Don't show a toast for this, as it's a non-critical suggestion feature.
        console.warn("Could not fetch HS code suggestions:", error);
        return [];
    }
}