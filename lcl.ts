// lcl.ts
import { State, setState, resetLclState, LclCargoItem } from './state';
import { switchPage, updateProgressBar, showToast, toggleLoading } from './ui';
import { MARKUP_CONFIG } from './pricing';
import { getHsCodeSuggestions } from './api';
import { getLCLQuotes, displayAPIUsage } from './searates-api';
import { captureCustomerInfo, submitQuoteRequest } from './email-capture';

let cargoItems: LclCargoItem[] = [];

function goToLclStep(step: number) {
    updateProgressBar('trade-finance', step - 1);
    document.querySelectorAll('#page-lcl .service-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`lcl-step-${step}`)?.classList.add('active');
}

function renderLclPage() {
    const page = document.getElementById('page-lcl');
    if (!page) return;

    page.innerHTML = `
        <button class="back-btn">Back to Services</button>
        <div class="service-page-header">
            <h2>Book Less than Container Load (LCL)</h2>
            <p class="subtitle">Cost-effective shipping for goods not requiring a full container.</p>
        </div>
        <div class="form-container">
            <div class="visual-progress-bar" id="progress-bar-trade-finance">
                <div class="progress-step"></div><div class="progress-step"></div><div class="progress-step"></div>
            </div>

            <!-- Step 1: Details -->
            <div id="lcl-step-1" class="service-step">
                <form id="lcl-details-form">
                    <h3>Shipment Details</h3>
                     <div class="form-section two-column">
                        <div class="input-wrapper"><label for="lcl-origin">Origin (City, Country)</label><input type="text" id="lcl-origin" required placeholder="e.g., Hamburg, Germany"></div>
                        <div class="input-wrapper"><label for="lcl-destination">Destination (City, Country)</label><input type="text" id="lcl-destination" required placeholder="e.g., New York, USA"></div>
                    </div>
                     <div class="form-section">
                        <h4>Cargo Description</h4>
                        <div class="input-wrapper">
                            <label for="lcl-cargo-description">Detailed description of goods</label>
                            <textarea id="lcl-cargo-description" required placeholder="e.g., 10 boxes of cotton t-shirts, 5 boxes of leather shoes"></textarea>
                        </div>
                        <div class="hs-code-suggester-wrapper" style="margin-top: 1rem;">
                            <div class="input-wrapper">
                                <label for="lcl-hs-code">HS Code (Harmonized System)</label>
                                <input type="text" id="lcl-hs-code" autocomplete="off" placeholder="Auto-suggested from description">
                                <div class="hs-code-suggestions" id="lcl-hs-code-suggestions"></div>
                                <p class="helper-text">This code is used by customs worldwide to classify products. We can suggest one based on your description.</p>
                            </div>
                        </div>
                    </div>
                    <div class="form-section">
                        <h4>Cargo Dimensions & Weight</h4>
                        <div id="lcl-cargo-list"></div>
                        <button type="button" id="lcl-add-cargo-btn" class="secondary-btn">Add Cargo Item</button>
                        <div id="lcl-cargo-summary" class="payment-overview" style="margin-top: 1rem;"></div>
                    </div>
                    <div class="form-actions"><button type="submit" class="main-submit-btn">Get AI Estimate</button></div>
                </form>
            </div>

            <!-- Step 2: Quote -->
            <div id="lcl-step-2" class="service-step">
                 <h3>Your AI-Powered Estimate</h3>
                <div id="lcl-quote-container"></div>
                <div class="quote-confirmation-panel">
                    <h4>Please Note: This is an AI Estimate</h4>
                    <p>This price is an estimate generated based on current market rates. It may not include local charges, customs, or duties. A Vcanship agent will contact you via email to confirm all details and provide a final, all-inclusive quote.</p>
                </div>
                <div class="form-actions">
                    <button type="button" id="lcl-back-to-details" class="secondary-btn">Back</button>
                    <button type="button" id="lcl-request-booking" class="main-submit-btn">Request Final Quote</button>
                </div>
            </div>
            
            <!-- Step 3: Confirmation -->
            <div id="lcl-step-3" class="service-step">
                <div class="confirmation-container">
                    <h3>Booking Request Sent!</h3>
                    <p>Your LCL shipment request has been received. Our team will email you shortly with a final quote and booking instructions.</p>
                    <div class="confirmation-tracking">
                        <h4>Reference ID</h4>
                        <div class="tracking-id-display" id="lcl-reference-id"></div>
                    </div>
                    <div class="confirmation-actions">
                        <button id="lcl-new-shipment-btn" class="main-submit-btn">Book Another LCL Shipment</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderCargoItems() {
    const list = document.getElementById('lcl-cargo-list');
    if (!list) return;
    list.innerHTML = cargoItems.map((item, index) => `
        <div class="lcl-cargo-item card" data-index="${index}">
             <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 1rem; align-items: flex-end;">
                <div class="input-wrapper" style="margin-bottom: 0;"><label>Pieces</label><input type="number" class="lcl-cargo-pieces" value="${item.pieces}" min="1" required></div>
                <div class="input-wrapper" style="margin-bottom: 0;"><label>Length(cm)</label><input type="number" class="lcl-cargo-length" value="${item.length}" min="1" required></div>
                <div class="input-wrapper" style="margin-bottom: 0;"><label>Width(cm)</label><input type="number" class="lcl-cargo-width" value="${item.width}" min="1" required></div>
                <div class="input-wrapper" style="margin-bottom: 0;"><label>Height(cm)</label><input type="number" class="lcl-cargo-height" value="${item.height}" min="1" required></div>
                <div class="input-wrapper" style="margin-bottom: 0;"><label>Weight(kg)</label><input type="number" class="lcl-cargo-weight" value="${item.weight}" min="1" required></div>
                <button type="button" class="secondary-btn lcl-remove-cargo-btn" style="margin-bottom: 0.5rem;">Remove</button>
            </div>
        </div>
    `).join('');
    updateCargoSummary();
}

function addCargoItem() {
    cargoItems.push({ id: Date.now(), pieces: 1, length: 100, width: 100, height: 100, weight: 100 });
    renderCargoItems();
}

function updateAndRecalculateCargo() {
    const newItems: LclCargoItem[] = [];
    let allValid = true;
    document.querySelectorAll('.lcl-cargo-item').forEach(itemEl => {
        const item: LclCargoItem = {
            id: Date.now(),
            pieces: parseInt((itemEl.querySelector('.lcl-cargo-pieces') as HTMLInputElement).value, 10) || 0,
            length: parseInt((itemEl.querySelector('.lcl-cargo-length') as HTMLInputElement).value, 10) || 0,
            width: parseInt((itemEl.querySelector('.lcl-cargo-width') as HTMLInputElement).value, 10) || 0,
            height: parseInt((itemEl.querySelector('.lcl-cargo-height') as HTMLInputElement).value, 10) || 0,
            weight: parseInt((itemEl.querySelector('.lcl-cargo-weight') as HTMLInputElement).value, 10) || 0,
        };
        if (item.pieces > 0 && item.length > 0 && item.width > 0 && item.height > 0 && item.weight > 0) {
            newItems.push(item);
        } else {
            allValid = false;
        }
    });
    cargoItems = newItems;
    if (!allValid) {
        showToast("Please ensure all cargo dimensions and weights are filled correctly.", "warning");
    }
    updateCargoSummary();
}

function updateCargoSummary() {
    const summaryEl = document.getElementById('lcl-cargo-summary');
    if (!summaryEl) return;

    let totalCbm = 0;
    let totalWeight = 0;
    cargoItems.forEach(item => {
        totalCbm += (item.length * item.width * item.height) / 1000000 * item.pieces;
        totalWeight += item.weight * item.pieces;
    });

    const chargeableWeight = Math.max(totalWeight, totalCbm * 1000); // 1 CBM = 1000 kg for LCL

    if (cargoItems.length > 0) {
        summaryEl.innerHTML = `
            <div class="review-item"><span>Total Volume (CBM):</span><strong>${totalCbm.toFixed(3)} m³</strong></div>
            <div class="review-item"><span>Total Actual Weight:</span><strong>${totalWeight.toFixed(2)} kg</strong></div>
            <div class="review-item"><span>Chargeable Weight:</span><strong>${chargeableWeight.toFixed(2)} kg</strong></div>
        `;
    } else {
        summaryEl.innerHTML = '';
    }
}


async function handleLclFormSubmit(e: Event) {
    e.preventDefault();
    updateAndRecalculateCargo();
    if (cargoItems.length === 0) {
        showToast("Please add at least one cargo item.", "error");
        return;
    }
    toggleLoading(true, "Calculating LCL estimate...");

    const origin = (document.getElementById('lcl-origin') as HTMLInputElement).value;
    const destination = (document.getElementById('lcl-destination') as HTMLInputElement).value;
    const cargoDescription = (document.getElementById('lcl-cargo-description') as HTMLTextAreaElement).value;
    const hsCode = (document.getElementById('lcl-hs-code') as HTMLInputElement).value;
    const cargoSummary = cargoItems.map(c => `${c.pieces}pcs, ${c.length}x${c.width}x${c.height}cm, ${c.weight}kg`).join('; ');
    const totalCbm = cargoItems.reduce((acc, item) => acc + (item.length * item.width * item.height) / 1000000 * item.pieces, 0);
    const totalWeight = cargoItems.reduce((acc, item) => acc + item.weight * item.pieces, 0);

    try {
        // Display API usage
        await displayAPIUsage();
        
        // Parse origin and destination for API call
        const [originCity, originCountry] = origin.split(',').map(s => s.trim());
        const [destCity, destCountry] = destination.split(',').map(s => s.trim());
        
        let finalPrice: number;
        let carrierInfo = '';
        let isRealQuote = false;
        
        // Try SeaRates API first
        try {
            const quotes = await getLCLQuotes(
                { country: originCountry || origin, city: originCity || origin },
                { country: destCountry || destination, city: destCity || destination },
                { weight: totalWeight, volume: totalCbm }
            );
            
            if (quotes && quotes.length > 0) {
                const bestQuote = quotes[0];
                const baseCost = bestQuote.price;
                const markup = MARKUP_CONFIG.lcl.standard;
                finalPrice = baseCost * (1 + markup);
                carrierInfo = `<div class="review-item"><span>Carrier:</span><strong>${bestQuote.carrier}</strong></div>
                                <div class="review-item"><span>Transit Time:</span><strong>${bestQuote.transitTime}</strong></div>`;
                isRealQuote = true;
                showToast('Real-time LCL quote loaded successfully!', 'success', 3000);
            } else {
                throw new Error('No quotes returned from SeaRates');
            }
            
        } catch (apiError: any) {
            console.log('SeaRates API unavailable, falling back to AI:', apiError.message);
            
            // Fallback to Google Gemini AI
            if (!State.api) throw new Error("AI API not initialized.");
            
            const prompt = `
                Act as a logistics pricing expert for LCL (Less than Container Load) sea freight.
                - Origin CFS: ${origin}
                - Destination CFS: ${destination}
                - Total Volume: ${totalCbm.toFixed(3)} CBM
                - Total Weight: ${totalWeight.toFixed(2)} kg
                - Cargo description: ${cargoDescription}
                - HS Code: ${hsCode || 'Not provided'}
                - Cargo details: ${cargoSummary}
                - Currency: ${State.currentCurrency.code}

                Provide a single estimated base cost for the freight as a number. Do not add any other text or formatting.
            `;
            
            const response = await State.api.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
            });
            
            const baseCost = parseFloat(response.text);
            if (isNaN(baseCost)) throw new Error("Invalid AI response.");
            
            const markup = MARKUP_CONFIG.lcl.standard;
            finalPrice = baseCost * (1 + markup);
            carrierInfo = '<div class="review-item"><span>Source:</span><strong>AI Estimate</strong></div>';
            
            showToast('AI-estimated quote. We\'ll email confirmed rates.', 'info', 4000);
        }

        const quoteContainer = document.getElementById('lcl-quote-container');
        if (quoteContainer) {
            quoteContainer.innerHTML = `
                <div class="payment-overview">
                    <div class="review-item"><span>Route:</span><strong>${origin} &rarr; ${destination}</strong></div>
                    ${carrierInfo}
                    <div id="lcl-quote-summary-cargo"></div>
                    <hr>
                    <div class="review-item total"><span>Estimated Freight Cost:</span><strong>${State.currentCurrency.symbol}${finalPrice.toFixed(2)}</strong></div>
                </div>
            `;
            document.getElementById('lcl-quote-summary-cargo')!.innerHTML = document.getElementById('lcl-cargo-summary')!.innerHTML;
        }
        
        // Capture customer info if using AI fallback
        if (!isRealQuote) {
            try {
                const customerInfo = await captureCustomerInfo('LCL');
                if (customerInfo) {
                    await submitQuoteRequest({
                        serviceType: 'LCL',
                        customerInfo,
                        shipmentDetails: {
                            origin,
                            destination,
                            cargoDescription,
                            hsCode,
                            totalCbm,
                            totalWeight,
                            cargoItems
                        },
                        aiEstimate: { totalCost: finalPrice, currency: State.currentCurrency.code }
                    });
                }
            } catch (captureError) {
                console.log('Customer info capture skipped:', captureError);
            }
        }
        
        goToLclStep(2);
        
    } catch (error) {
        console.error("LCL quote error:", error);
        showToast("Could not generate an estimate. Please try again.", "error");
    } finally {
        toggleLoading(false);
    }
}


function attachLclEventListeners() {
    document.querySelector('#page-lcl .back-btn')?.addEventListener('click', () => switchPage('landing'));
    document.getElementById('lcl-details-form')?.addEventListener('submit', handleLclFormSubmit);
    document.getElementById('lcl-add-cargo-btn')?.addEventListener('click', addCargoItem);
    
    document.getElementById('lcl-cargo-list')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('lcl-remove-cargo-btn')) {
            const item = target.closest<HTMLElement>('.lcl-cargo-item');
            if (item?.dataset.index) {
                cargoItems.splice(parseInt(item.dataset.index, 10), 1);
                renderCargoItems();
            }
        }
    });

    document.getElementById('lcl-cargo-list')?.addEventListener('change', updateAndRecalculateCargo);

    document.getElementById('lcl-back-to-details')?.addEventListener('click', () => goToLclStep(1));
    document.getElementById('lcl-request-booking')?.addEventListener('click', () => {
        const refId = `LCL-${Date.now().toString().slice(-6)}`;
        (document.getElementById('lcl-reference-id') as HTMLElement).textContent = refId;
        goToLclStep(3);
        showToast("Request sent! Our team will contact you shortly.", "success");
    });
    document.getElementById('lcl-new-shipment-btn')?.addEventListener('click', () => {
        resetLclState();
        cargoItems = [];
        renderLclPage();
        attachLclEventListeners();
        goToLclStep(1);
        addCargoItem();
    });

    // HS Code Suggester Logic
    let hsCodeSearchTimeout: number | null = null;
    const descriptionInput = document.getElementById('lcl-cargo-description') as HTMLTextAreaElement;
    const hsCodeInput = document.getElementById('lcl-hs-code') as HTMLInputElement;
    const suggestionsContainer = document.getElementById('lcl-hs-code-suggestions');

    descriptionInput?.addEventListener('input', () => {
        const query = descriptionInput.value.trim();
        if (hsCodeSearchTimeout) clearTimeout(hsCodeSearchTimeout);
        if (query.length < 10 || !suggestionsContainer) { // require more text for better suggestions
            suggestionsContainer?.classList.remove('active');
            return;
        }

        hsCodeSearchTimeout = window.setTimeout(async () => {
            toggleLoading(true, "Suggesting HS codes...");
            try {
                const suggestions = await getHsCodeSuggestions(query);
                if (suggestionsContainer) {
                    if (suggestions.length > 0) {
                        suggestionsContainer.innerHTML = suggestions.map(s => `
                            <div class="hs-code-suggestion-item" data-code="${s.code}">
                                <strong>${s.code}</strong> - ${s.description}
                            </div>
                        `).join('');
                        suggestionsContainer.classList.add('active');
            
                        if (hsCodeInput && hsCodeInput.value.trim() === '') {
                            hsCodeInput.value = suggestions[0].code;
                            showToast(`Suggested HS Code: ${suggestions[0].code}`, 'info');
                        }
                    } else {
                        suggestionsContainer.classList.remove('active');
                    }
                }
            } catch (e) {
                console.error("HS Code suggestion failed", e);
                // Don't show a toast, it's a non-critical feature
            } finally {
                toggleLoading(false);
            }
        }, 800); // slightly longer delay
    });

    suggestionsContainer?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const item = target.closest<HTMLElement>('.hs-code-suggestion-item');
        if (item && item.dataset.code && hsCodeInput) {
            hsCodeInput.value = item.dataset.code;
            suggestionsContainer.classList.remove('active');
        }
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.hs-code-suggester-wrapper')) {
            suggestionsContainer?.classList.remove('active');
        }
    });
}


export function startLcl() {
    setState({ currentService: 'lcl' });
    resetLclState();
    cargoItems = [];
    renderLclPage();
    switchPage('lcl');
    attachLclEventListeners();
    goToLclStep(1);
    addCargoItem();
}