import { jsPDF } from 'jspdf';
import { State, setState, type Quote, type Address, resetParcelState, type DropOffLocation, ApiResponse } from './state';
import { getHsCodeSuggestions, checkAndDecrementLookup } from './api';
import { showToast, switchPage, updateProgressBar, toggleLoading, showAuthModal } from './ui';
import { DOMElements } from './dom';
import { createQuoteCard } from './components';
import { t } from './i18n';
import { attachDynamicPostcodeValidation } from './validation';
import { MARKUP_CONFIG } from './pricing';
import { Type } from '@google/genai';
import { 
    getParcelRates, 
    formatRate, 
    cmToInches, 
    kgToPounds, 
    displayShippoStatus,
    type ShippoAddress,
    type ShippoParcel 
} from './shippo-api';

let currentQuotes: Quote[] = [];

/**
 * Convert full country name to ISO 2-letter code
 */
function getCountryCode(country: string): string {
    const countryMap: { [key: string]: string } = {
        'united states': 'US',
        'usa': 'US',
        'united kingdom': 'GB',
        'uk': 'GB',
        'canada': 'CA',
        'australia': 'AU',
        'germany': 'DE',
        'france': 'FR',
        'italy': 'IT',
        'spain': 'ES',
        'netherlands': 'NL',
        'belgium': 'BE',
        'switzerland': 'CH',
        'austria': 'AT',
        'sweden': 'SE',
        'norway': 'NO',
        'denmark': 'DK',
        'finland': 'FI',
        'poland': 'PL',
        'czech republic': 'CZ',
        'ireland': 'IE',
        'portugal': 'PT',
        'greece': 'GR',
        'hungary': 'HU',
        'romania': 'RO',
        'bulgaria': 'BG',
        'croatia': 'HR',
        'slovakia': 'SK',
        'slovenia': 'SI',
        'lithuania': 'LT',
        'latvia': 'LV',
        'estonia': 'EE',
        'japan': 'JP',
        'china': 'CN',
        'south korea': 'KR',
        'korea': 'KR',
        'singapore': 'SG',
        'hong kong': 'HK',
        'india': 'IN',
        'brazil': 'BR',
        'mexico': 'MX',
        'argentina': 'AR',
        'chile': 'CL',
        'colombia': 'CO',
        'peru': 'PE',
        'new zealand': 'NZ',
        'south africa': 'ZA',
        'uae': 'AE',
        'united arab emirates': 'AE',
        'dubai': 'AE',
        'saudi arabia': 'SA',
        'israel': 'IL',
        'turkey': 'TR',
        'russia': 'RU',
        'ukraine': 'UA',
        'malaysia': 'MY',
        'thailand': 'TH',
        'indonesia': 'ID',
        'philippines': 'PH',
        'vietnam': 'VN',
        'egypt': 'EG',
        'nigeria': 'NG',
        'kenya': 'KE'
    };
    
    const normalized = country.toLowerCase().trim();
    return countryMap[normalized] || country.substring(0, 2).toUpperCase();
}

function goToParcelStep(step: number) {
    const container = document.getElementById('page-parcel');
    if (!container) return;

    const currentStepElement = container.querySelector('.service-step.active');
    const nextStepElement = document.getElementById(`parcel-step-${step}`);

    if (currentStepElement === nextStepElement) return;

    if (currentStepElement) {
        currentStepElement.classList.add('exiting');
        currentStepElement.addEventListener('animationend', () => {
            currentStepElement.classList.remove('active', 'exiting');
        }, { once: true });
    }
    
    if (nextStepElement) {
        // Remove active from any other step in case of weird state
        container.querySelectorAll('.service-step').forEach(s => s.classList.remove('active'));
        nextStepElement.classList.add('active');
    }

    if (step === 4) {
        const printBtn = document.getElementById('parcel-print-label-btn');
        if (printBtn) {
            // FIX: Always show the print label button on the confirmation screen,
            // regardless of pickup or dropoff type, to ensure the option is always available.
            printBtn.classList.remove('hidden');
        }
    }
}

function handleHeavyItemCheck() {
    const weightInput = document.getElementById('package-weight') as HTMLInputElement;
    const banner = document.getElementById('heavy-item-banner');
    if (!weightInput || !banner) return;

    const weight = parseFloat(weightInput.value);
    banner.classList.toggle('hidden', isNaN(weight) || weight <= 30);
}

function toggleHsCodeVisibility() {
    const originCountryEl = document.getElementById('origin-country') as HTMLInputElement;
    const destCountryEl = document.getElementById('dest-country') as HTMLInputElement;
    const hsCodeSection = document.getElementById('hs-code-section');

    if (!destCountryEl || !hsCodeSection) return;

    const pickupType = State.parcelPickupType;
    let originCountry = '';

    if (pickupType === 'pickup') {
        if (!originCountryEl) return;
        originCountry = originCountryEl.value.trim().toLowerCase();
    } else { // dropoff
        const countryData = localStorage.getItem('vcanship_country');
        if (countryData) {
            originCountry = countryData.toLowerCase();
        }
    }
    
    const destCountry = destCountryEl.value.trim().toLowerCase();

    // Simple normalization for common country codes/names
    const normalize = (name: string): string => {
        const map: { [key: string]: string } = { 
            'gb': 'uk', 'united kingdom': 'uk', 
            'usa': 'us', 'united states': 'us',
            'united states of america': 'us'
        };
        return map[name] || name;
    };

    const isDomestic = normalize(originCountry) === normalize(destCountry) && originCountry !== '' && destCountry !== '';
    hsCodeSection.classList.toggle('hidden', isDomestic);
}


function handlePickupTypeChange(type: 'pickup' | 'dropoff') {
    setState({ parcelPickupType: type });

    document.getElementById('parcel-pickup-fields')?.classList.toggle('hidden', type === 'dropoff');
    document.getElementById('parcel-dropoff-fields')?.classList.toggle('hidden', type === 'pickup');
    
    const resultsContainer = document.getElementById('parcel-dropoff-results-container');
    if (resultsContainer) resultsContainer.innerHTML = '';
    
    toggleHsCodeVisibility();
}

async function handleDetailsFormSubmit(e: Event) {
    e.preventDefault();
    const form = (e.target as HTMLElement).closest('form');
    if (!form) return;

    let allValid = true;

    const validationMap: { [key: string]: string } = {
        'dest-name': "Please enter the recipient's name.",
        'dest-street': "Please enter the recipient's street address.",
        'dest-city': "Please enter the recipient's city.",
        'dest-postcode': "Please enter a postcode.",
        'dest-country': "Please enter a country.",
        'package-weight': 'Please enter the package weight.',
        'package-length': 'Please enter the package length.',
        'package-width': 'Please enter the package width.',
        'package-height': 'Please enter the package height.',
        'item-description': 'Please provide a description of the item.',
        'origin-name': "Please enter the sender's name.",
        'origin-street': "Please enter the sender's street address.",
        'origin-city': "Please enter the sender's city.",
        'origin-postcode': "Please enter a postcode.",
        'origin-country': "Please enter a country.",
        'parcel-dropoff-postcode': "Please enter your postcode to get a quote.",
    };

    const requiredFieldIds = [
        'dest-name', 'dest-street', 'dest-city', 'dest-postcode', 'dest-country',
        'package-weight', 'package-length', 'package-width', 'package-height', 'item-description'
    ];
    if (State.parcelPickupType === 'pickup') {
        requiredFieldIds.push('origin-name', 'origin-street', 'origin-city', 'origin-postcode', 'origin-country');
    }

    form.querySelectorAll('.input-wrapper').forEach(wrapper => {
        wrapper.classList.remove('input-error');
        const errorEl = wrapper.querySelector('.error-text');
        if (errorEl) {
            errorEl.classList.add('hidden');
            errorEl.textContent = '';
        }
    });

    requiredFieldIds.forEach(id => {
        const input = document.getElementById(id) as HTMLInputElement;
        if (input && !input.value.trim()) {
            allValid = false;
            const wrapper = input.closest('.input-wrapper');
            const errorEl = wrapper?.querySelector('.error-text');
            if (wrapper && errorEl) {
                wrapper.classList.add('input-error');
                errorEl.textContent = validationMap[id] || 'This field is required.';
                errorEl.classList.remove('hidden');
            }
        }
    });
    
    const postcodesToValidate: HTMLInputElement[] = [];
    if (State.parcelPickupType === 'pickup') {
        postcodesToValidate.push(document.getElementById('origin-postcode') as HTMLInputElement);
    }
    postcodesToValidate.push(document.getElementById('dest-postcode') as HTMLInputElement);
    
    postcodesToValidate.forEach(input => {
        if (!input) return;
        const wrapper = input.closest('.input-wrapper');
        if (input.value.trim() && wrapper && !wrapper.classList.contains('input-error')) {
             const pattern = new RegExp(input.pattern, 'i');
             if (!pattern.test(input.value.trim())) {
                allValid = false;
                const errorEl = wrapper.querySelector('.error-text');
                if (errorEl) {
                    wrapper.classList.add('input-error');
                    errorEl.textContent = input.dataset.errorMessage || 'Invalid format.';
                    errorEl.classList.remove('hidden');
                }
             }
        }
    });


    if (State.parcelInsuranceAdded) {
        const declaredValueInput = document.getElementById('parcel-declared-value') as HTMLInputElement;
        const value = parseFloat(declaredValueInput.value);
        if (!declaredValueInput.value.trim() || isNaN(value) || value <= 0) {
            allValid = false;
            const wrapper = declaredValueInput.closest('.input-wrapper');
            const errorEl = wrapper?.querySelector('.error-text');
            if (wrapper && errorEl) {
                wrapper.classList.add('input-error');
                errorEl.textContent = 'Please enter a valid declared value greater than zero.';
                errorEl.classList.remove('hidden');
            }
        }
    }

    if (!allValid) {
        showToast('Please fill out all required fields and correct any errors.', 'error');
        return;
    }

    if (!checkAndDecrementLookup()) return;

    let origin: Address;
    const destination: Address = {
        name: (document.getElementById('dest-name') as HTMLInputElement).value,
        street: (document.getElementById('dest-street') as HTMLInputElement).value,
        city: (document.getElementById('dest-city') as HTMLInputElement).value,
        postcode: (document.getElementById('dest-postcode') as HTMLInputElement).value,
        country: (document.getElementById('dest-country') as HTMLInputElement).value,
    };

    if (State.parcelPickupType === 'pickup') {
        origin = {
            name: (document.getElementById('origin-name') as HTMLInputElement).value,
            street: (document.getElementById('origin-street') as HTMLInputElement).value,
            city: (document.getElementById('origin-city') as HTMLInputElement).value,
            postcode: (document.getElementById('origin-postcode') as HTMLInputElement).value,
            country: (document.getElementById('origin-country') as HTMLInputElement).value,
        };
    } else { 
        const dropoffPostcode = (document.getElementById('parcel-dropoff-postcode') as HTMLInputElement).value;
        const countryData = localStorage.getItem('vcanship_country');
        
        origin = {
            name: "Customer Drop-off",
            street: dropoffPostcode, 
            city: '',
            country: countryData || '',
            postcode: dropoffPostcode,
        };
    }
    
    setState({ parcelOrigin: origin, parcelDestination: destination });

    const formData = {
        origin, destination,
        weight: parseFloat((document.getElementById('package-weight') as HTMLInputElement).value),
        length: parseInt((document.getElementById('package-length') as HTMLInputElement).value),
        width: parseInt((document.getElementById('package-width') as HTMLInputElement).value),
        height: parseInt((document.getElementById('package-height') as HTMLInputElement).value),
        description: (document.getElementById('item-description') as HTMLTextAreaElement).value,
        hsCode: (document.getElementById('hs-code') as HTMLInputElement).value,
    };
    
    goToParcelStep(2);
    
    const quotesContainer = DOMElements.parcel.quotesContainer;
    const warningsContainer = DOMElements.parcel.warningsContainer;
    const sidebarContainer = document.getElementById('parcel-sidebar-container');

    if (quotesContainer) {
        quotesContainer.innerHTML = `
            <div id="quotes-skeleton">
                <div class="quote-card-skeleton"></div><div class="quote-card-skeleton"></div><div class="quote-card-skeleton"></div>
            </div>`;
    }
    if (warningsContainer) warningsContainer.innerHTML = '';
    if (sidebarContainer) {
        sidebarContainer.innerHTML = `
            <div class="results-section"><div class="compliance-checklist-skeleton" style="height: 150px;"></div></div>
            <div class="results-section"><div class="compliance-checklist-skeleton" style="height: 120px;"></div></div>
        `;
    }

    try {
        // Display Shippo service status
        displayShippoStatus();
        
        // Convert addresses to Shippo format
        const fromAddress: ShippoAddress = {
            name: formData.origin.name || 'Sender',
            street1: formData.origin.street || formData.origin.city,
            city: formData.origin.city,
            state: '', // State not in Address type, will be parsed from address if needed
            zip: formData.origin.postcode,
            country: getCountryCode(formData.origin.country),
            phone: formData.origin.phone || '',
            email: formData.origin.email || ''
        };
        
        const toAddress: ShippoAddress = {
            name: formData.destination.name || 'Recipient',
            street1: formData.destination.street || formData.destination.city,
            city: formData.destination.city,
            state: '', // State not in Address type, will be parsed from address if needed
            zip: formData.destination.postcode,
            country: getCountryCode(formData.destination.country),
            phone: formData.destination.phone || '',
            email: formData.destination.email || ''
        };
        
        // Convert parcel dimensions to Shippo format (inches and pounds)
        const parcel: ShippoParcel = {
            length: cmToInches(formData.length),
            width: cmToInches(formData.width),
            height: cmToInches(formData.height),
            weight: kgToPounds(formData.weight),
            distance_unit: 'in',
            mass_unit: 'lb'
        };
        
        // Get real carrier rates from Shippo
        const shippoRates = await getParcelRates(fromAddress, toAddress, parcel);
        
        if (!shippoRates || shippoRates.length === 0) {
            throw new Error('No rates available for this route');
        }
        
        // Convert Shippo rates to our Quote format
        const quotes: Quote[] = shippoRates.map(rate => {
            const formatted = formatRate(rate);
            const basePrice = formatted.price;
            const markup = MARKUP_CONFIG.parcel.standard;
            const serviceFee = basePrice * markup;
            const totalCost = basePrice + serviceFee;
            
            return {
                carrierName: formatted.carrier,
                carrierType: 'Express Courier',
                estimatedTransitTime: formatted.days,
                chargeableWeight: formData.weight,
                chargeableWeightUnit: 'KG',
                weightBasis: 'Actual Weight',
                isSpecialOffer: false,
                totalCost: totalCost,
                costBreakdown: {
                    baseShippingCost: basePrice,
                    fuelSurcharge: 0,
                    estimatedCustomsAndTaxes: 0,
                    optionalInsuranceCost: 0,
                    ourServiceFee: serviceFee
                },
                serviceProvider: `Shippo (${formatted.carrier})`,
                notes: formatted.service,
                // Store Shippo rate ID for later label purchase
                shippoRateId: rate.object_id
            };
        });
        
        // Generate basic compliance report
        const complianceReport = {
            status: 'Information',
            summary: 'Standard shipping documentation required.',
            requirements: [
                {
                    title: 'Commercial Invoice',
                    details: 'Required for international shipments. Include item description, value, and HS code.'
                },
                {
                    title: 'Customs Declaration',
                    details: 'Declare contents accurately for customs clearance.'
                }
            ]
        };
        
        // Create response in expected format
        const response: ApiResponse = {
            itemWarning: formData.weight > 30 ? 'Heavy parcel - additional handling fees may apply' : null,
            complianceReport,
            quotes,
            costSavingOpportunities: [
                {
                    title: 'Bundle Shipments',
                    description: 'Save up to 15% by combining multiple parcels into one shipment.'
                }
            ],
            nextSteps: 'Select a carrier rate to proceed with booking and label generation.'
        };
        
        showToast('Real-time carrier rates loaded from Shippo!', 'success', 3000);
        renderResults(response, origin, destination);

    } catch (error) {
        console.error('Error getting quotes:', error);
        showToast('Could not fetch carrier rates. Please verify addresses and try again.', 'error');
        if (quotesContainer) {
            quotesContainer.innerHTML = '<p class="error-text" style="text-align:center; padding: 2rem;">Sorry, we couldn\'t fetch quotes at this time. Please verify your addresses and try again.</p>';
        }
    }
}

function renderQuoteCards(quotes: Quote[]) {
    const quotesContainer = DOMElements.parcel.quotesContainer;
    if (!quotesContainer) return;

    if (quotes && quotes.length > 0) {
        quotesContainer.innerHTML = quotes.map(createQuoteCard).join('');
    } else {
        quotesContainer.innerHTML = '<p class="helper-text" style="text-align: center; padding: 2rem;">No quotes available for this route. This may be due to compliance restrictions on the item you are trying to send.</p>';
    }
}

function parseTransitTime(transitTime: string): number {
    const match = transitTime.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 99;
}

function sortAndRenderQuotes(sortBy: 'price' | 'speed') {
    const sortedQuotes = [...currentQuotes]; // Create a copy to avoid modifying the original
    if (sortBy === 'price') {
        sortedQuotes.sort((a, b) => a.totalCost - b.totalCost);
    } else if (sortBy === 'speed') {
        sortedQuotes.sort((a, b) => parseTransitTime(a.estimatedTransitTime) - parseTransitTime(b.estimatedTransitTime));
    }
    renderQuoteCards(sortedQuotes);

    // Update active button state
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-sort') === sortBy);
    });
}


function renderResults(response: any, origin: Address, destination: Address) {
    const { itemWarning, complianceReport, quotes, costSavingOpportunities, nextSteps } = response;
    
    currentQuotes = quotes; // Store the master list of quotes for sorting

    const sidebarContainer = document.getElementById('parcel-sidebar-container');
    const mainSubtitle = document.getElementById('parcel-main-subtitle');

    if (mainSubtitle) {
        const originLocation = State.parcelPickupType === 'dropoff' ? origin.postcode : origin.country;
        mainSubtitle.textContent = `We've found the best rates for your shipment from ${originLocation} to ${destination.country}.`;
    }

    // Build sidebar HTML string
    let sidebarHtml = '';

    if (complianceReport) {
        const statusClass = `compliance-status-${complianceReport.status.toLowerCase().replace(/\s/g, '-')}`;
        sidebarHtml += `
            <div class="results-section">
                <h3><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1Zm3.536 2.464a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM10 18a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 0 1.5H10.75a.75.75 0 0 1-.75-.75ZM4.464 15.536a.75.75 0 0 1 0-1.06l1.06-1.06a.75.75 0 0 1 1.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0ZM2 10a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 2 10ZM5.536 4.464a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06L5.536 5.524a.75.75 0 0 1 0-1.06ZM10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z" clip-rule="evenodd" /></svg> Compliance Report</h3>
                <div class="compliance-report">
                    <div class="compliance-report-header">
                        <span class="compliance-status-badge ${statusClass}">${complianceReport.status}</span>
                        <p>${complianceReport.summary}</p>
                    </div>
                    ${complianceReport.requirements.length > 0 ? `<ul>${complianceReport.requirements.map((req: any) => `<li><strong>${req.title}:</strong> ${req.details}</li>`).join('')}</ul>` : ''}
                </div>
            </div>`;
    }

    if (costSavingOpportunities && costSavingOpportunities.length > 0) {
        sidebarHtml += `
            <div class="results-section">
                <h3><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v4.59L7.3 9.24a.75.75 0 0 0-1.1 1.02l3.25 3.5a.75.75 0 0 0 1.1 0l3.25-3.5a.75.75 0 1 0-1.1-1.02l-1.95 2.1v-4.59Z" clip-rule="evenodd" /></svg> AI Savings Advisor</h3>
                ${costSavingOpportunities.map((opp: any) => `<div class="cost-saving-opportunity"><h4>${opp.title}</h4><p>${opp.description}</p></div>`).join('')}
            </div>`;
    }

    if (nextSteps) {
        sidebarHtml += `<div class="results-section"><h3>Next Steps</h3><p>${nextSteps}</p></div>`;
    }
    
    // Populate sidebar
    if (sidebarContainer) {
        sidebarContainer.innerHTML = sidebarHtml;
    }

    // Add insurance cost to quotes before rendering
    const insuranceCost = State.parcelInsuranceCost;
    if (insuranceCost > 0) {
        currentQuotes = currentQuotes.map((quote: Quote) => {
            const newQuote = JSON.parse(JSON.stringify(quote));
            newQuote.costBreakdown.optionalInsuranceCost = insuranceCost;
            newQuote.totalCost += insuranceCost;
            return newQuote;
        });
    }

    // Initial render sorted by price
    sortAndRenderQuotes('price');
}

function handleSelectQuote(e: Event) {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('.select-quote-btn');
    if (!button?.dataset.quote) return;
    
    const quote: Quote = JSON.parse(button.dataset.quote.replace(/&quot;/g, '"'));
    const addons = [];
    if (State.parcelPremiumTrackingAdded) {
        addons.push({ name: 'Premium Tracking', cost: State.parcelPremiumTrackingCost });
    }

    const trackingId = `PAR-${Date.now().toString().slice(-6)}`;
    
    setState({
        parcelSelectedQuote: quote,
        paymentContext: {
            service: 'parcel',
            quote,
            addons,
            shipmentId: trackingId,
            // FIX: Use type assertion to satisfy the paymentContext type.
            origin: State.parcelOrigin as Address,
            destination: State.parcelDestination as Address,
        }
    });
    
    switchPage('payment');
}

function handleViewBreakdown(e: Event) {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('.view-breakdown-btn');
    if (!button?.dataset.quote) return;

    const quote: Quote = JSON.parse(button.dataset.quote.replace(/&quot;/g, '"'));
    const modal = document.getElementById('price-breakdown-modal');
    if (modal) {
        (document.getElementById('breakdown-modal-subtitle') as HTMLElement).textContent = `Details for your ${quote.carrierName} quote.`;
        
        const insuranceLine = quote.costBreakdown.optionalInsuranceCost > 0 
            ? `<div class="review-item"><span>Parcel Insurance:</span> <strong>${State.currentCurrency.symbol}${quote.costBreakdown.optionalInsuranceCost.toFixed(2)}</strong></div>`
            : '';

        (document.getElementById('breakdown-details-container') as HTMLElement).innerHTML = `
            <div class="review-item"><span>Base Shipping:</span> <strong>${State.currentCurrency.symbol}${quote.costBreakdown.baseShippingCost.toFixed(2)}</strong></div>
            <div class="review-item"><span>Fuel Surcharge:</span> <strong>${State.currentCurrency.symbol}${quote.costBreakdown.fuelSurcharge.toFixed(2)}</strong></div>
            <div class="review-item"><span>Est. Customs & Taxes:</span> <strong>${State.currentCurrency.symbol}${quote.costBreakdown.estimatedCustomsAndTaxes.toFixed(2)}</strong></div>
            ${insuranceLine}
            <div class="review-item"><span>Our Service Fee (incl. ${MARKUP_CONFIG.parcel.standard * 100}% markup):</span> <strong>${State.currentCurrency.symbol}${quote.costBreakdown.ourServiceFee.toFixed(2)}</strong></div>
            <hr>
            <div class="review-item total"><span>Total:</span> <strong>${State.currentCurrency.symbol}${quote.totalCost.toFixed(2)}</strong></div>
        `;
        modal.classList.add('active');
        document.getElementById('close-breakdown-modal-btn')?.addEventListener('click', () => modal.classList.remove('active'), { once: true });
    }
}

function renderConfirmationPage(trackingId: string, declaredValue: number, premiumTracking: boolean) {
    const confirmationTitle = document.getElementById('parcel-confirmation-title') as HTMLHeadingElement;
    const confirmationMessage = document.getElementById('parcel-confirmation-message') as HTMLParagraphElement;
    const trackingIdEl = document.getElementById('parcel-confirmation-tracking-id') as HTMLDivElement;
    
    const insuranceMessage = declaredValue > 0
        ? ` Your parcel is insured for a declared value of ${State.currentCurrency.symbol}${declaredValue.toFixed(2)}.`
        : '';
        
    const premiumTrackingMessage = premiumTracking
        ? ' Your premium live tracking is now active.'
        : '';

    if (confirmationTitle) {
        confirmationTitle.innerHTML = `
            <div class="confirmation-icon-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            </div>
            <span>Shipment Confirmed!</span>
        `;
    }
    
    if (confirmationMessage) confirmationMessage.textContent = 'Your parcel has been booked. Details have been sent to your email.' + insuranceMessage + premiumTrackingMessage;
    if (trackingIdEl) trackingIdEl.textContent = trackingId;

    goToParcelStep(4);
}


function generateShippingLabelPdf() {
    if (!State.parcelOrigin || !State.parcelDestination || !State.parcelSelectedQuote) {
        showToast("Missing data to generate label.", "error");
        return;
    }
    const doc = new jsPDF();
    const trackingId = (document.getElementById('parcel-confirmation-tracking-id') as HTMLDivElement).textContent;

    doc.setFontSize(10);
    doc.text(`Carrier: ${State.parcelSelectedQuote.carrierName}`, 10, 10);
    
    doc.rect(5, 15, 100, 50);
    doc.setFontSize(8);
    doc.text('FROM:', 10, 20);
    doc.setFontSize(10);
    doc.text((State.parcelOrigin as Address).name || '', 10, 25);
    doc.text((State.parcelOrigin as Address).street || '', 10, 30);
    doc.text(`${(State.parcelOrigin as Address).city}, ${(State.parcelOrigin as Address).country}`, 10, 35);
    
    doc.rect(5, 70, 100, 50);
    doc.setFontSize(8);
    doc.text('TO:', 10, 75);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text((State.parcelDestination as Address).name || '', 10, 82);
    doc.text((State.parcelDestination as Address).street || '', 10, 89);
    doc.text(`${(State.parcelDestination as Address).city}, ${(State.parcelDestination as Address).country}`, 10, 96);
    doc.setFont('helvetica', 'normal');

    // Mock barcode
    doc.setFont('Libre Barcode 39');
    doc.setFontSize(36);
    doc.text(`*${trackingId}*`, 105, 140, {align: 'center'});

    doc.save(`Shipping_Label_${trackingId}.pdf`);
}

function renderParcelPage() {
    const page = document.getElementById('page-parcel');
    if (!page) return;

    page.innerHTML = `
        <button class="back-btn">${t('parcel.back_to_services')}</button>
        <div class="service-page-header">
            <h2>${t('parcel.title')}</h2>
            <p id="parcel-main-subtitle" class="subtitle">${t('parcel.subtitle')}</p>
        </div>

        <!-- Step 1: Details -->
        <div id="parcel-step-1" class="service-step">
             <form id="parcel-quote-form" class="form-container" novalidate>
                <div class="form-section two-column">
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <div id="parcel-pickup-fields">
                            <div class="progressive-form-section" id="origin-address-section">
                                <h3>${t('parcel.origin')}</h3>
                                <div class="input-wrapper progressive-field" data-step="1"><label for="origin-name">${t('parcel.full_name')}</label><input type="text" id="origin-name" required><p class="error-text hidden"></p></div>
                                <div class="input-wrapper progressive-field hidden" data-step="2"><label for="origin-street">${t('parcel.street_address')}</label><input type="text" id="origin-street" required><p class="error-text hidden"></p></div>
                                <div class="input-wrapper progressive-field hidden" data-step="3"><label for="origin-city">${t('parcel.city')}</label><input type="text" id="origin-city" required><p class="error-text hidden"></p></div>
                                <div class="input-wrapper progressive-field hidden" data-step="5"><label for="origin-country">${t('parcel.country')}</label><input type="text" id="origin-country" required><p class="error-text hidden"></p></div>
                                <div class="input-wrapper progressive-field hidden" data-step="4"><label for="origin-postcode">${t('parcel.postcode')}</label><input type="text" id="origin-postcode" required><p class="error-text hidden"></p></div>
                            </div>
                        </div>
                        <div id="parcel-dropoff-fields" class="hidden">
                             <h3>Drop-off Information</h3>
                            <p class="helper-text">Drop-off quotes are based on your current country selection.</p>
                            <div class="input-wrapper">
                                <label for="parcel-dropoff-postcode">Your Postcode / City</label>
                                <input type="text" id="parcel-dropoff-postcode" placeholder="Enter postcode">
                                <p class="error-text hidden"></p>
                            </div>
                        </div>
                        <div>
                            <h3>${t('parcel.package_details')}</h3>
                            <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));">
                                <div class="input-wrapper"><label for="package-weight">${t('parcel.weight_kg')}</label><input type="number" id="package-weight" required min="0.1" step="0.1"><p class="error-text hidden"></p></div>
                                <div class="input-wrapper"><label for="package-length">${t('parcel.length_cm')}</label><input type="number" id="package-length" required min="1"><p class="error-text hidden"></p></div>
                                <div class="input-wrapper"><label for="package-width">${t('parcel.width_cm')}</label><input type="number" id="package-width" required min="1"><p class="error-text hidden"></p></div>
                                <div class="input-wrapper"><label for="package-height">${t('parcel.height_cm')}</label><input type="number" id="package-height" required min="1"><p class="error-text hidden"></p></div>
                            </div>
                            <div id="heavy-item-banner" class="info-banner hidden" style="margin-top: 1.5rem;">
                                <div class="info-banner-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>
                                </div>
                                <div class="info-banner-text">
                                    <h4>Heavy Item?</h4>
                                    <p>For items over 30kg, consider our LCL or Air Freight services for better value and handling.</p>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h3>Optional Add-ons</h3>
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="parcel-insurance-checkbox">
                                <label for="parcel-insurance-checkbox">Add Parcel Insurance</label>
                            </div>
                            <div class="conditional-fields" id="parcel-insurance-fields">
                                <div class="input-wrapper">
                                    <label for="parcel-declared-value">Declared Value (${State.currentCurrency.symbol})</label>
                                    <input type="number" id="parcel-declared-value" min="1" step="0.01" placeholder="e.g., 500">
                                    <p class="helper-text" id="parcel-insurance-cost-display"></p>
                                    <p class="error-text hidden"></p>
                                </div>
                            </div>
                        </div>
                         <div id="item-details-section">
                            <h3>${t('parcel.item_details')}</h3>
                            <div class="input-wrapper"><label for="item-description">${t('parcel.description')}</label><textarea id="item-description" required placeholder="e.g., Men's Cotton T-Shirts"></textarea><p class="error-text hidden"></p></div>
                            <div id="hs-code-section" class="hs-code-suggester-wrapper hidden" style="margin-top: 1rem;">
                                <div class="input-wrapper">
                                    <label for="hs-code">${t('parcel.hs_code_optional')}</label>
                                    <input type="text" id="hs-code" autocomplete="off" placeholder="Auto-suggested from description">
                                    <div class="hs-code-suggestions" id="parcel-hs-code-suggestions"></div>
                                     <p class="helper-text">HS Code is auto-suggested for international shipments.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                     <div class="progressive-form-section" id="destination-address-section">
                        <h3>${t('parcel.destination')}</h3>
                        <div class="input-wrapper progressive-field" data-step="1"><label for="dest-name">${t('parcel.full_name')}</label><input type="text" id="dest-name" required><p class="error-text hidden"></p></div>
                        <div class="input-wrapper progressive-field hidden" data-step="2"><label for="dest-street">${t('parcel.street_address')}</label><input type="text" id="dest-street" required><p class="error-text hidden"></p></div>
                        <div class="input-wrapper progressive-field hidden" data-step="3"><label for="dest-city">${t('parcel.city')}</label><input type="text" id="dest-city" required><p class="error-text hidden"></p></div>
                        <div class="input-wrapper progressive-field hidden" data-step="5"><label for="dest-country">${t('parcel.country')}</label><input type="text" id="dest-country" required><p class="error-text hidden"></p></div>
                        <div class="input-wrapper progressive-field hidden" data-step="4"><label for="dest-postcode">${t('parcel.postcode')}</label><input type="text" id="dest-postcode" required><p class="error-text hidden"></p></div>
                    </div>
                </div>
                <div class="form-actions"><button type="submit" class="main-submit-btn">${t('parcel.get_quotes')}</button></div>
            </form>
        </div>

        <!-- Step 2: Quotes -->
        <div id="parcel-step-2" class="service-step">
            <div id="parcel-warnings-container"></div>
            <div class="results-controls">
                <h3>Sort By:</h3>
                <div class="sort-buttons">
                    <button class="sort-btn active" data-sort="price">Cheapest First</button>
                    <button class="sort-btn" data-sort="speed">Fastest First</button>
                </div>
            </div>
            <div class="results-layout-grid">
                <main id="parcel-quotes-container" class="results-main-content">
                    <div id="quotes-skeleton">
                        <div class="quote-card-skeleton"></div>
                        <div class="quote-card-skeleton"></div>
                        <div class="quote-card-skeleton"></div>
                    </div>
                </main>
                <aside id="parcel-sidebar-container" class="results-sidebar"></aside>
            </div>
            <div class="form-actions" style="justify-content: flex-start; margin-top: 2rem;">
                <button id="parcel-back-to-details" class="secondary-btn">Back to Details</button>
            </div>
        </div>
        
        <!-- Step 3 is now the main payment page -->

        <!-- Step 4: Confirmation -->
        <div id="parcel-step-4" class="service-step">
            <div class="confirmation-container">
                <h3 id="parcel-confirmation-title"></h3><p id="parcel-confirmation-message"></p>
                <div class="confirmation-tracking">
                    <h4>Your Tracking ID</h4>
                    <div class="tracking-id-display" id="parcel-confirmation-tracking-id"></div>
                     <button class="main-submit-btn" id="parcel-confirmation-track-shipment-btn" style="margin-top: 1rem; display: inline-flex; align-items: center; gap: 0.5rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1.25em; height: 1.25em;"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                        <span>Track Your Shipment</span>
                    </button>
                </div>
                <div class="confirmation-actions">
                     <button id="parcel-print-label-btn" class="secondary-btn">Print Label (PDF)</button>
                     <button id="parcel-new-shipment-btn" class="main-submit-btn">New Shipment</button>
                </div>
            </div>
        </div>
    `;
}

function calculateAndStoreInsurance() {
    const insuranceCheckbox = document.getElementById('parcel-insurance-checkbox') as HTMLInputElement;
    const declaredValueInput = document.getElementById('parcel-declared-value') as HTMLInputElement;
    const costDisplay = document.getElementById('parcel-insurance-cost-display');

    if (!insuranceCheckbox || !declaredValueInput || !costDisplay) return;

    if (!insuranceCheckbox.checked) {
        setState({
            parcelInsuranceAdded: false,
            parcelDeclaredValue: 0,
            parcelInsuranceCost: 0,
        });
        costDisplay.textContent = '';
        return;
    }

    const declaredValue = parseFloat(declaredValueInput.value) || 0;
    if (declaredValue <= 0) {
        setState({
            parcelInsuranceAdded: true, // It's checked, but value is 0
            parcelDeclaredValue: 0,
            parcelInsuranceCost: 0,
        });
        costDisplay.textContent = '';
        return;
    }

    const MIN_INSURANCE_PREMIUM = 5.00;
    const INSURANCE_RATE = 0.005; // 0.5%

    const calculatedPremium = declaredValue * INSURANCE_RATE;
    const finalPremium = Math.max(calculatedPremium, MIN_INSURANCE_PREMIUM);

    setState({
        parcelInsuranceAdded: true,
        parcelDeclaredValue: declaredValue,
        parcelInsuranceCost: finalPremium,
    });

    costDisplay.textContent = `Insurance cost: ${State.currentCurrency.symbol}${finalPremium.toFixed(2)}`;
}

function populateFormFromState() {
    const { parcelOrigin, parcelDestination, parcelInitialWeight, parcelInitialLength, parcelInitialWidth, parcelInitialHeight } = State;

    const setInputValue = (id: string, value?: string | number) => {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el && (value || value === 0)) el.value = String(value);
    };

    if (parcelOrigin) {
        setInputValue('origin-name', (parcelOrigin as Address).name);
        setInputValue('origin-street', (parcelOrigin as Address).street);
        setInputValue('origin-city', (parcelOrigin as Address).city);
        setInputValue('origin-postcode', (parcelOrigin as Address).postcode);
        setInputValue('origin-country', (parcelOrigin as Address).country);
    }
    if (parcelDestination) {
        setInputValue('dest-name', (parcelDestination as Address).name);
        setInputValue('dest-street', (parcelDestination as Address).street);
        setInputValue('dest-city', (parcelDestination as Address).city);
        setInputValue('dest-postcode', (parcelDestination as Address).postcode);
        setInputValue('dest-country', (parcelDestination as Address).country);
    }
    if (parcelInitialWeight) {
         setInputValue('package-weight', parcelInitialWeight);
         handleHeavyItemCheck();
    }
    if (parcelInitialLength) {
        setInputValue('package-length', parcelInitialLength);
    }
    if (parcelInitialWidth) {
        setInputValue('package-width', parcelInitialWidth);
    }
    if (parcelInitialHeight) {
        setInputValue('package-height', parcelInitialHeight);
    }
}

export function startParcel() {
    setState({ currentService: 'parcel' });
    renderParcelPage();
    switchPage('parcel');

    document.querySelector('#page-parcel .back-btn')?.addEventListener('click', () => {
        resetParcelState();
        switchPage('landing');
    });

    const page = document.getElementById('page-parcel');
    if (!page) return;

    page.addEventListener('click', (e: Event) => {
        handleSelectQuote(e);
        handleViewBreakdown(e);
        const target = e.target as HTMLElement;

        if (target.id === 'parcel-back-to-details') goToParcelStep(1);
        if (target.id === 'parcel-new-shipment-btn') {
            resetParcelState();
            startParcel();
        }
        if (target.id === 'parcel-print-label-btn') generateShippingLabelPdf();
        if (target.id === 'parcel-confirmation-track-shipment-btn') {
            const trackingId = document.getElementById('parcel-confirmation-tracking-id')?.textContent;
            if (trackingId) {
                const trackingInput = DOMElements.trackingIdInput;
                if (trackingInput) trackingInput.value = trackingId;
                DOMElements.trackingModal.classList.add('active');
            }
        }
    });

    page.addEventListener('submit', (e: Event) => {
        if ((e.target as HTMLElement).id === 'parcel-quote-form') {
            handleDetailsFormSubmit(e);
        }
    });
    
    page.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.id === 'parcel-insurance-checkbox') {
            document.getElementById('parcel-insurance-fields')?.classList.toggle('active', target.checked);
            calculateAndStoreInsurance();
        }
    });

    page.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;

        if (['origin-country', 'dest-country'].includes(target.id)) toggleHsCodeVisibility();
        if (target.id === 'package-weight') handleHeavyItemCheck();
        
        if (['origin-name', 'dest-name'].includes(target.id)) {
            const section = target.closest('.progressive-form-section');
            if (section) {
                const step2 = section.querySelector('[data-step="2"]');
                if (step2) step2.classList.remove('hidden');
            }
        }
        if (['origin-street', 'dest-street'].includes(target.id)) {
             const section = target.closest('.progressive-form-section');
            if (section) {
                const step3 = section.querySelector('[data-step="3"]');
                if (step3) step3.classList.remove('hidden');
            }
        }
         if (['origin-city', 'dest-city'].includes(target.id)) {
             const section = target.closest('.progressive-form-section');
            if (section) {
                const step4 = section.querySelector('[data-step="4"]');
                if (step4) step4.classList.remove('hidden');
            }
        }
         if (['origin-postcode', 'dest-postcode'].includes(target.id)) {
             const section = target.closest('.progressive-form-section');
            if (section) {
                const step5 = section.querySelector('[data-step="5"]');
                if (step5) step5.classList.remove('hidden');
            }
        }
        
        if (target.id === 'parcel-declared-value') {
            calculateAndStoreInsurance();
        }

        if (target.id === 'item-description') {
            const hsCodeInput = document.getElementById('hs-code') as HTMLInputElement;
            const suggestionsContainer = document.getElementById('parcel-hs-code-suggestions');
            if (!hsCodeInput || !suggestionsContainer) return;
            const query = target.value.trim();
            if (query.length > 10) {
                 getHsCodeSuggestions(query).then(suggestions => {
                    if (suggestions.length > 0) {
                        hsCodeInput.value = suggestions[0].code;
                        suggestionsContainer.innerHTML = suggestions.map(s => `<div class="hs-code-suggestion-item" data-code="${s.code}"><strong>${s.code}</strong> - ${s.description}</div>`).join('');
                        suggestionsContainer.classList.add('active');
                    } else {
                        suggestionsContainer.classList.remove('active');
                    }
                });
            } else {
                 suggestionsContainer.classList.remove('active');
            }
        }
    });
    
    // Attach dynamic validation to postcode fields
    const originCountry = document.getElementById('origin-country') as HTMLInputElement;
    const originPostcode = document.getElementById('origin-postcode') as HTMLInputElement;
    if (originCountry && originPostcode) {
        attachDynamicPostcodeValidation(originCountry, originPostcode);
    }
    const destCountry = document.getElementById('dest-country') as HTMLInputElement;
    const destPostcode = document.getElementById('dest-postcode') as HTMLInputElement;
    if (destCountry && destPostcode) {
        attachDynamicPostcodeValidation(destCountry, destPostcode);
    }
    
    // Check for confirmation flow
    const confirmationContext = sessionStorage.getItem('vcanship_show_confirmation');
    if (confirmationContext) {
        const context = JSON.parse(confirmationContext);
        if (context.service === 'parcel') {
            renderConfirmationPage(context.shipmentId, State.parcelDeclaredValue, State.parcelPremiumTrackingAdded);
            sessionStorage.removeItem('vcanship_show_confirmation');
        }
    } else {
        goToParcelStep(1); // Start at details
    }
    
    // Check for pre-filled data from landing page
    populateFormFromState();
}