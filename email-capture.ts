// Email Capture System for All Services
// This module handles submitting quote requests and customer info to your backend

import { supabase } from './supabase';
import { showToast } from './ui';

export interface CustomerInfo {
    name: string;
    email: string;
    phone?: string;
}

export interface QuoteRequestData {
    serviceType: string;
    customerInfo: CustomerInfo;
    shipmentDetails: any;
    aiEstimate?: any;
}

/**
 * Submits a quote request to the backend and sends you an email notification
 * This ensures you never lose a customer, even if partner APIs aren't ready
 */
export async function submitQuoteRequest(data: QuoteRequestData): Promise<boolean> {
    try {
        const { data: response, error } = await supabase.functions.invoke('submit-quote-request', {
            body: {
                serviceType: data.serviceType,
                customerInfo: data.customerInfo,
                shipmentDetails: data.shipmentDetails,
                aiEstimate: data.aiEstimate || null,
                timestamp: new Date().toISOString()
            }
        });

        if (error) {
            console.error('Error submitting quote request:', error);
            showToast('Unable to submit request. Please try again or contact support.', 'error');
            return false;
        }

        console.log('Quote request submitted successfully:', response);
        showToast('Request submitted! We\'ll email you a confirmed quote within 24 hours.', 'success', 5000);
        return true;

    } catch (error) {
        console.error('Quote request submission failed:', error);
        showToast('Unable to submit request. Please try again.', 'error');
        return false;
    }
}

/**
 * Captures customer contact info before showing quotes
 * Returns the customer info if successfully captured, null otherwise
 */
export async function captureCustomerInfo(serviceType: string): Promise<CustomerInfo | null> {
    return new Promise((resolve) => {
        // Create modal HTML
        const modalHTML = `
            <div class="modal active" id="customer-info-modal" style="z-index: 10000;">
                <div class="modal-content" style="max-width: 500px;">
                    <button class="close-btn" id="close-customer-modal">&times;</button>
                    <h3>Get Your Quote</h3>
                    <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">
                        Enter your contact details to receive your ${serviceType} quote. 
                        We'll also email you a confirmed rate from our partners.
                    </p>
                    <form id="customer-info-form">
                        <div class="input-wrapper">
                            <label for="customer-name">Full Name *</label>
                            <input type="text" id="customer-name" required placeholder="John Smith">
                        </div>
                        <div class="input-wrapper">
                            <label for="customer-email">Email Address *</label>
                            <input type="email" id="customer-email" required placeholder="john@example.com">
                        </div>
                        <div class="input-wrapper">
                            <label for="customer-phone">Phone Number (Optional)</label>
                            <input type="tel" id="customer-phone" placeholder="+1 234 567 8900">
                        </div>
                        <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                            <button type="button" class="secondary-btn" id="cancel-customer-btn" style="flex: 1;">Cancel</button>
                            <button type="submit" class="primary-btn" style="flex: 1;">Get Quote</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Insert modal into DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);

        const modal = document.getElementById('customer-info-modal');
        const form = document.getElementById('customer-info-form') as HTMLFormElement;
        const closeBtn = document.getElementById('close-customer-modal');
        const cancelBtn = document.getElementById('cancel-customer-btn');

        const cleanup = () => {
            modal?.remove();
            modalContainer.remove();
        };

        const handleClose = () => {
            cleanup();
            resolve(null);
        };

        closeBtn?.addEventListener('click', handleClose);
        cancelBtn?.addEventListener('click', handleClose);

        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = (document.getElementById('customer-name') as HTMLInputElement).value.trim();
            const email = (document.getElementById('customer-email') as HTMLInputElement).value.trim();
            const phone = (document.getElementById('customer-phone') as HTMLInputElement).value.trim();

            if (!name || !email) {
                showToast('Please enter your name and email', 'error');
                return;
            }

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showToast('Please enter a valid email address', 'error');
                return;
            }

            cleanup();
            resolve({
                name,
                email,
                phone: phone || undefined
            });
        });
    });
}
