// fcl.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { State, setState, resetFclState, Quote, FclDetails, ComplianceDoc, FclContainer } from './state';
import { switchPage, updateProgressBar, showToast, toggleLoading } from './ui';
import { getHsCodeSuggestions } from './api';
import { MARKUP_CONFIG } from './pricing';
import { checkAndDecrementLookup } from './api';
import { Type } from '@google/genai';
import { getFCLQuotes, displayAPIUsage } from './searates-api';
import { captureCustomerInfo, submitQuoteRequest } from './email-capture';
import { isUserSubscribed, getAPIUnavailableReason } from './subscription';
import { getCachedRates, setCachedRates, getCacheInfo } from './rate-cache';


// --- MODULE STATE ---
let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, painting = false;

// --- UI RENDERING & STEP MANAGEMENT ---

function goToFclStep(step: number) {
    setState({ currentFclStep: step });
    updateProgressBar('trade-finance', step - 1); // Reusing progress bar style
    document.querySelectorAll('#page-fcl .service-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`fcl-step-${step}`)?.classList.add('active');
    
    if (step === 3) {
        initializeSignaturePad();
    }
}

function renderFclPage() {
    const page = document.getElementById('page-fcl');
    if (!page) return;

    page.innerHTML = `
        <button class="back-btn">Back to Services</button>
        <div class="service-page-header">
            <h2>Book Full Container Load (FCL)</h2>
            <p class="subtitle">Secure exclusive use of a container for your large shipments.</p>
        </div>
        <div class="form-container">
             <div class="visual-progress-bar" id="progress-bar-trade-finance">
                <div class="progress-step"></div><div class="progress-step"></div><div class="progress-step"></div><div class="progress-step"></div>
            </div>

            <!-- Step 1: Details -->
            <div id="fcl-step-1" class="service-step">
                <form id="fcl-quote-form" novalidate>
                    <div class="form-section">
                        <h3>Service Type</h3>
                        <div id="fcl-service-type-selector" class="service-type-selector">
                            <button type="button" class="service-type-btn" data-type="port-to-port"><strong>Port-to-Port</strong><span>You handle transport to/from ports.</span></button>
                            <button type="button" class="service-type-btn" data-type="door-to-port"><strong>Door-to-Port</strong><span>We pick up from your door.</span></button>
                            <button type="button" class="service-type-btn" data-type="port-to-door"><strong>Port-to-Door</strong><span>We deliver to their door.</span></button>
                            <button type="button" class="service-type-btn" data-type="door-to-door"><strong>Door-to-Door</strong><span>We handle the entire journey.</span></button>
                        </div>
                    </div>

                    <div class="form-section two-column">
                        <div id="fcl-origin-section">
                            <h4>Origin</h4>
                            <div id="fcl-pickup-address-fields" class="hidden">
                                <div class="input-wrapper"><label for="fcl-pickup-name">Sender Name/Company</label><input type="text" id="fcl-pickup-name"></div>
                                <div class="input-wrapper"><label for="fcl-pickup-country">Country</label><input type="text" id="fcl-pickup-country"></div>
                            </div>
                             <div id="fcl-pickup-location-fields">
                                <div class="input-wrapper"><label for="fcl-pickup-port">Port of Loading</label><input type="text" id="fcl-pickup-port" placeholder="e.g., Shanghai or CNSHA"></div>
                            </div>
                        </div>
                         <div id="fcl-destination-section">
                            <h4>Destination</h4>
                            <div id="fcl-delivery-address-fields" class="hidden">
                                <div class="input-wrapper"><label for="fcl-delivery-name">Recipient Name/Company</label><input type="text" id="fcl-delivery-name"></div>
                                <div class="input-wrapper"><label for="fcl-delivery-country">Country</label><input type="text" id="fcl-delivery-country"></div>
                            </div>
                            <div id="fcl-delivery-location-fields">
                                <div class="input-wrapper"><label for="fcl-delivery-port">Port of Discharge</label><input type="text" id="fcl-delivery-port" placeholder="e.g., Los Angeles or USLAX"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>Cargo & Container Details</h4>
                        <div class="input-wrapper"><label for="fcl-cargo-description">Cargo Description</label><textarea id="fcl-cargo-description" required placeholder="e.g., 15 pallets of consumer electronics"></textarea></div>
                        <div id="fcl-container-list"></div>
                        <button type="button" id="fcl-add-container-btn" class="secondary-btn">Add Container</button>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="main-submit-btn">Get Quote & Compliance</button>
                    </div>
                </form>
            </div>
            
            <!-- Step 2: Quote & Compliance -->
            <div id="fcl-step-2" class="service-step">
                <h3>Quote & Compliance</h3>
                 <div class="quote-confirmation-panel" style="margin-bottom: 2rem;">
                    <h4>Please Note: This is an AI Estimate</h4>
                    <p>This price is an estimate generated by our AI based on current market rates. A Vcanship agent will contact you to confirm the final details, provide an exact quote, and finalize your booking.</p>
                </div>
                <div class="results-layout-grid">
                     <main id="fcl-compliance-container" class="results-main-content"></main>
                     <aside id="fcl-quote-sidebar" class="results-sidebar"></aside>
                </div>
                <div class="form-actions" style="justify-content: space-between;">
                    <button type="button" id="fcl-back-to-details-btn" class="secondary-btn">Back</button>
                    <button type="button" id="fcl-to-agreement-btn" class="main-submit-btn">Request Final Quote</button>
                </div>
            </div>

            <!-- Step 3: Agreement -->
            <div id="fcl-step-3" class="service-step">
                 <h3>Agreement & Finalization</h3>
                 <div class="two-column">
                    <div>
                        <h4>Booking Summary</h4>
                        <div id="fcl-agreement-summary" class="payment-overview"></div>
                        <div class="checkbox-wrapper" style="margin-top: 1.5rem;">
                            <input type="checkbox" id="fcl-compliance-ack">
                            <label for="fcl-compliance-ack">I acknowledge that providing the required compliance documents is my responsibility.</label>
                        </div>
                    </div>
                    <div>
                        <h4>Digital Signature</h4>
                        <div class="input-wrapper">
                            <label for="fcl-signer-name">Sign by Typing Your Full Name</label>
                            <input type="text" id="fcl-signer-name">
                        </div>
                        <label>Sign in the box below</label>
                        <canvas id="fcl-signature-pad" width="400" height="150" style="border: 2px solid var(--border-color); border-radius: 8px; cursor: crosshair;"></canvas>
                    </div>
                 </div>
                 <div class="form-actions" style="justify-content: space-between;">
                    <button type="button" id="fcl-back-to-compliance-btn" class="secondary-btn">Back</button>
                    <button type="button" id="fcl-to-payment-btn" class="main-submit-btn" disabled>Confirm Booking Request</button>
                </div>
            </div>

            <!-- Step 4: Confirmation -->
            <div id="fcl-step-4" class="service-step">
                <div class="confirmation-container">
                    <h3 id="fcl-confirmation-title">Booking Request Sent!</h3>
                    <p id="fcl-confirmation-message">Your FCL shipment request has been received. Our operations team will be in touch via email to coordinate the next steps.</p>
                    <div class="confirmation-tracking">
                        <h4>Reference ID</h4>
                        <div class="tracking-id-display" id="fcl-booking-id"></div>
                    </div>
                    <div class="confirmation-actions">
                         <button id="fcl-download-docs-btn" class="secondary-btn">Download Summary (PDF)</button>
                         <button id="fcl-new-shipment-btn" class="main-submit-btn">New Shipment</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- UI & EVENT HANDLERS ---

function handleServiceTypeChange(type: string) {
    document.querySelectorAll('#fcl-service-type-selector .service-type-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`#fcl-service-type-selector .service-type-btn[data-type="${type}"]`)?.classList.add('active');

    const showOriginAddress = type.startsWith('door-to');
    const showDestAddress = type.endsWith('-to-door');

    document.getElementById('fcl-pickup-address-fields')?.classList.toggle('hidden', !showOriginAddress);
    document.getElementById('fcl-pickup-location-fields')?.classList.toggle('hidden', showOriginAddress);
    document.getElementById('fcl-delivery-address-fields')?.classList.toggle('hidden', !showDestAddress);
    document.getElementById('fcl-delivery-location-fields')?.classList.toggle('hidden', showDestAddress);
}

function renderContainerItems() {
    const list = document.getElementById('fcl-container-list');
    if (!list) return;
    const items = State.fclDetails?.containers || [];
    list.innerHTML = items.map((item, index) => `
        <div class="card" data-index="${index}" style="margin-bottom: 1rem; padding: 1rem;">
            <div class="form-grid" style="grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 1rem; align-items: flex-end;">
                <div class="input-wrapper" style="margin-bottom: 0;"><label>Container Type</label><select class="fcl-container-type"><option ${item.type === '20GP' ? 'selected':''}>20GP</option><option ${item.type === '40GP' ? 'selected':''}>40GP</option><option ${item.type === '40HC' ? 'selected':''}>40HC</option></select></div>
                <div class="input-wrapper" style="margin-bottom: 0;"><label>Quantity</label><input type="number" class="fcl-container-quantity" value="${item.quantity}" min="1"></div>
                <div class="input-wrapper" style="margin-bottom: 0;"><label>Weight</label><input type="number" class="fcl-container-weight" value="${item.weight || ''}" min="1"></div>
                <div class="input-wrapper" style="margin-bottom: 0;"><label>Unit</label><select class="fcl-container-weight-unit"><option ${item.weightUnit === 'KG' ? 'selected':''}>KG</option><option ${item.weightUnit === 'TON' ? 'selected':''}>TON</option></select></div>
                <button type="button" class="secondary-btn fcl-remove-container-btn">&times;</button>
            </div>
        </div>
    `).join('');
}

function updateContainersFromUI() {
    const containers: FclContainer[] = [];
    document.querySelectorAll('#fcl-container-list .card').forEach(el => {
        containers.push({
            type: (el.querySelector('.fcl-container-type') as HTMLSelectElement).value,
            quantity: parseInt((el.querySelector('.fcl-container-quantity') as HTMLInputElement).value) || 1,
            weight: parseInt((el.querySelector('.fcl-container-weight') as HTMLInputElement).value) || 0,
            weightUnit: (el.querySelector('.fcl-container-weight-unit') as HTMLSelectElement).value as 'KG' | 'TON',
        });
    });
    setState({ fclDetails: { ...State.fclDetails, containers } as FclDetails });
}

function renderQuoteAndComplianceStep() {
    const { fclQuote, fclComplianceDocs, fclDetails } = State;
    const quoteSidebar = document.getElementById('fcl-quote-sidebar');
    const complianceContainer = document.getElementById('fcl-compliance-container');

    if (quoteSidebar && fclQuote && fclDetails) {
        quoteSidebar.innerHTML = `
            <div class="results-section">
                <h3>Route</h3>
                <div id="fcl-route-visualizer" style="padding: 1rem; background: var(--light-gray); border-radius: 8px; text-align: center;">
                    <p style="margin: 0;"><strong>From:</strong> ${fclDetails.pickupPort || fclDetails.pickupAddress?.country}<br><strong>To:</strong> ${fclDetails.deliveryPort || fclDetails.deliveryAddress?.country}</p>
                </div>
            </div>
            <div class="results-section">
                 <h3>AI-Generated Quote</h3>
                 <div class="payment-overview">
                    <div class="review-item"><span>Carrier:</span><strong>${fclQuote.carrierName}</strong></div>
                    <div class="review-item"><span>Transit Time:</span><strong>~${fclQuote.estimatedTransitTime}</strong></div>
                    <hr>
                    <div class="review-item total"><span>Est. Total Cost:</span><strong>${State.currentCurrency.symbol}${fclQuote.totalCost.toFixed(2)}</strong></div>
                 </div>
            </div>
        `;
    }

    if (complianceContainer && fclComplianceDocs) {
        complianceContainer.innerHTML = `
            <h3>Compliance Checklist</h3>
            <p class="subtitle" style="text-align: left; margin: 0 0 1rem;">Upload the required documents for your shipment.</p>
            <div id="fcl-compliance-checklist" class="compliance-checklist">
                ${fclComplianceDocs.map(doc => `
                    <div class="compliance-doc-item" id="${doc.id}" data-status="${doc.status}">
                        <div class="compliance-doc-info"><h4>${doc.title} ${doc.required ? '<span>(Required)</span>' : ''}</h4><p>${doc.description}</p></div>
                        <div class="file-drop-area">
                            <div class="file-drop-area-idle"><span>Drop file or click</span></div>
                            <div class="file-drop-area-uploaded" style="display: none;"></div>
                            <input type="file" class="file-input" data-doc-id="${doc.id}">
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

function initializeSignaturePad() {
    canvas = document.getElementById('fcl-signature-pad') as HTMLCanvasElement;
    if (!canvas) return;
    ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#212121'; ctx.lineWidth = 2;

    const start = (e: MouseEvent | TouchEvent) => { painting = true; draw(e); };
    const end = () => { painting = false; ctx.beginPath(); setState({ fclSignatureDataUrl: canvas.toDataURL() }); validateAgreement(); };
    const draw = (e: MouseEvent | TouchEvent) => {
        if (!painting) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const pos = e instanceof MouseEvent ? e : e.touches[0];
        ctx.lineTo(pos.clientX - rect.left, pos.clientY - rect.top);
        ctx.stroke(); ctx.beginPath(); ctx.moveTo(pos.clientX - rect.left, pos.clientY - rect.top);
    };
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('touchstart', start);
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchmove', draw);
}

function validateAgreement() {
    const ack = (document.getElementById('fcl-compliance-ack') as HTMLInputElement).checked;
    const name = (document.getElementById('fcl-signer-name') as HTMLInputElement).value.trim();
    const isSigned = !!State.fclSignatureDataUrl;
    (document.getElementById('fcl-to-payment-btn') as HTMLButtonElement).disabled = !(ack && name && isSigned);
}

async function handleFclFormSubmit(e: Event) {
    e.preventDefault();
    updateContainersFromUI();
    
    if (!checkAndDecrementLookup()) return;

    toggleLoading(true, "Analyzing your FCL shipment...");

    const serviceType = document.querySelector('#fcl-service-type-selector .service-type-btn.active')?.getAttribute('data-type') || 'port-to-port';
    const pickupAddress = serviceType.startsWith('door-to') ? {
        name: (document.getElementById('fcl-pickup-name') as HTMLInputElement).value,
        country: (document.getElementById('fcl-pickup-country') as HTMLInputElement).value,
    } : null;
    const pickupPort = serviceType.startsWith('door-to') ? null : (document.getElementById('fcl-pickup-port') as HTMLInputElement).value;
    const deliveryAddress = serviceType.endsWith('-to-door') ? {
        name: (document.getElementById('fcl-delivery-name') as HTMLInputElement).value,
        country: (document.getElementById('fcl-delivery-country') as HTMLInputElement).value,
    } : null;
    const deliveryPort = serviceType.endsWith('-to-door') ? null : (document.getElementById('fcl-delivery-port') as HTMLInputElement).value;

    const details: FclDetails = {
        serviceType: serviceType as FclDetails['serviceType'],
        pickupType: serviceType.startsWith('door-to') ? 'address' : 'location',
        deliveryType: serviceType.endsWith('-to-door') ? 'address' : 'location',
        pickupAddress,
        deliveryAddress,
        pickupPort,
        deliveryPort,
        cargoDescription: (document.getElementById('fcl-cargo-description') as HTMLTextAreaElement).value,
        hsCode: '', // Simplified for this version
        containers: State.fclDetails?.containers || [],
    };
    setState({ fclDetails: details });

    try {
        // Display API usage for transparency
        await displayAPIUsage();
        
        // Prepare origin and destination for API call
        const origin = {
            country: pickupAddress?.country || 'China',
            city: pickupPort || 'Shanghai'
        };
        const destination = {
            country: deliveryAddress?.country || 'United States',
            city: deliveryPort || 'Los Angeles'
        };
        
        // Convert containers to SeaRates format
        const containersForApi = details.containers.map(c => ({
            type: c.type as '20GP' | '40GP' | '40HC' | '45HC',
            quantity: c.quantity
        }));
        
        let quoteWithBreakdown: Quote;
        let isRealQuote = false;
        let usedCache = false;
        
        // Step 0: Check if user has subscription for live rates
        const hasSubscription = await isUserSubscribed();
        
        // Step 1: Check cache first (for subscribed users)
        if (hasSubscription) {
            const cacheParams = { containers: containersForApi };
            const cachedQuotes = getCachedRates('fcl', origin.city, destination.city, cacheParams);
            
            if (cachedQuotes && cachedQuotes.length > 0) {
                quoteWithBreakdown = cachedQuotes[0];
                isRealQuote = true;
                usedCache = true;
                
                const cacheInfo = getCacheInfo('fcl', origin.city, destination.city, cacheParams);
                showToast(`✅ Using cached rate (valid for ${cacheInfo.hoursRemaining}h more)`, 'success', 3000);
                console.log('[FCL] Using cached quote, saved 1 API call!');
            }
        }
        
        // Step 2: Try SeaRates API (if subscribed and not cached)
        if (!usedCache && hasSubscription) {
            try {
                console.log('✅ Subscription active - fetching live FCL quotes...');
                const searatesQuotes = await getFCLQuotes(origin, destination, containersForApi);
                
                if (searatesQuotes && searatesQuotes.length > 0) {
                    // Use the first (best) quote from SeaRates
                    const bestQuote = searatesQuotes[0];
                    const baseCost = bestQuote.price;
                    const markupCost = baseCost * (1 + MARKUP_CONFIG.fcl.standard);
                    
                    quoteWithBreakdown = {
                        carrierName: bestQuote.carrier,
                        estimatedTransitTime: bestQuote.transitTime,
                        totalCost: markupCost,
                        carrierType: "Ocean Carrier",
                        chargeableWeight: 0,
                        chargeableWeightUnit: 'N/A',
                        weightBasis: 'Per Container',
                        isSpecialOffer: false,
                        costBreakdown: {
                            baseShippingCost: baseCost,
                            fuelSurcharge: 0,
                            estimatedCustomsAndTaxes: 0,
                            optionalInsuranceCost: 0,
                            ourServiceFee: markupCost - baseCost
                        },
                        serviceProvider: `SeaRates (${bestQuote.carrier})`
                    };
                    
                    // Cache the rate for 24 hours
                    const cacheParams = { containers: containersForApi };
                    setCachedRates('fcl', origin.city, destination.city, cacheParams, [quoteWithBreakdown]);
                    
                    isRealQuote = true;
                    showToast('✅ Real-time carrier quote! Valid for 24 hours.', 'success', 3000);
                } else {
                    throw new Error('No quotes returned from SeaRates API');
                }
                
            } catch (apiError: any) {
                console.log('❌ SeaRates API error, falling back to AI:', apiError.message);
            }
        }
        
        // Step 3: Fallback to AI estimate (free users or API error)
        if (!isRealQuote) {
            const reason = await getAPIUnavailableReason();
            console.log(`💡 Using AI estimate: ${reason}`);
            
            // Fallback to Google Gemini AI
            if (!State.api) throw new Error("API not initialized");
            
            const containerSummary = details.containers.map(c => `${c.quantity} x ${c.type}`).join(', ');
            const prompt = `Act as a logistics pricing expert for FCL sea freight. Provide a realistic estimated quote.
            Route: From ${pickupPort || pickupAddress?.country} to ${deliveryPort || deliveryAddress?.country}.
            Containers: ${containerSummary}.
            Cargo: ${details.cargoDescription}.
            Currency: ${State.currentCurrency.code}.
            
            Provide a JSON object with: carrierName (e.g., Maersk, MSC), estimatedTransitTime (e.g., "25-30 days"), and totalCost (realistic market rate with ${MARKUP_CONFIG.fcl.standard * 100}% markup included).`;
            
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    carrierName: { type: Type.STRING },
                    estimatedTransitTime: { type: Type.STRING },
                    totalCost: { type: Type.NUMBER }
                }
            };

            const result = await State.api.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema
                }
            });

            const parsedResult = JSON.parse(result.text);
            
            quoteWithBreakdown = {
                ...parsedResult,
                carrierType: "Ocean Carrier",
                chargeableWeight: 0,
                chargeableWeightUnit: 'N/A',
                weightBasis: 'Per Container',
                isSpecialOffer: false,
                costBreakdown: {
                    baseShippingCost: parsedResult.totalCost / (1 + MARKUP_CONFIG.fcl.standard),
                    fuelSurcharge: 0,
                    estimatedCustomsAndTaxes: 0,
                    optionalInsuranceCost: 0,
                    ourServiceFee: parsedResult.totalCost - (parsedResult.totalCost / (1 + MARKUP_CONFIG.fcl.standard))
                },
                serviceProvider: 'Vcanship AI Estimate',
                isAIEstimate: true // Flag for upgrade prompt
            };
            
            if (!hasSubscription && State.isLoggedIn) {
                showToast('💡 AI estimate - Upgrade to Premium ($9.99/mo) for real carrier rates!', 'info', 5000);
            } else if (!State.isLoggedIn) {
                showToast('AI estimate. Log in & subscribe for live carrier rates.', 'info', 4000);
            } else {
                showToast('AI estimate - We\'ll email confirmed rates soon.', 'info', 4000);
            }
        }
        
        // Generate compliance checklist (standard for all FCL shipments)
        const standardDocs: ComplianceDoc[] = [
            {
                id: 'doc-commercial-invoice',
                title: 'Commercial Invoice',
                description: 'Detailed invoice showing goods value, quantities, and buyer/seller information.',
                status: 'pending',
                file: null,
                required: true
            },
            {
                id: 'doc-packing-list',
                title: 'Packing List',
                description: 'Itemized list of container contents with weights and dimensions.',
                status: 'pending',
                file: null,
                required: true
            },
            {
                id: 'doc-bill-of-lading',
                title: 'Bill of Lading',
                description: 'Contract between shipper and carrier. Will be issued by the carrier.',
                status: 'pending',
                file: null,
                required: true
            },
            {
                id: 'doc-certificate-of-origin',
                title: 'Certificate of Origin',
                description: 'Certifies the country where goods were manufactured.',
                status: 'pending',
                file: null,
                required: false
            }
        ];
        
        // Capture customer info if using AI fallback
        if (!isRealQuote) {
            try {
                const customerInfo = await captureCustomerInfo('FCL');
                if (customerInfo) {
                    await submitQuoteRequest({
                        serviceType: 'FCL',
                        customerInfo,
                        shipmentDetails: details,
                        aiEstimate: quoteWithBreakdown
                    });
                }
            } catch (captureError) {
                console.log('Customer info capture skipped:', captureError);
            }
        }
        
        setState({ fclQuote: quoteWithBreakdown, fclComplianceDocs: standardDocs });
        renderQuoteAndComplianceStep();
        goToFclStep(2);
        
    } catch (error) {
        console.error("FCL quote error:", error);
        showToast("Could not generate an estimate. Please try again.", "error");
    } finally {
        toggleLoading(false);
    }
}

function attachFclEventListeners() {
    const page = document.getElementById('page-fcl');
    if (!page) return;

    page.querySelector('.back-btn')?.addEventListener('click', () => switchPage('landing'));
    document.getElementById('fcl-quote-form')?.addEventListener('submit', handleFclFormSubmit);

    document.getElementById('fcl-service-type-selector')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest<HTMLButtonElement>('.service-type-btn');
        if (button?.dataset.type) {
            handleServiceTypeChange(button.dataset.type);
        }
    });
    
    document.getElementById('fcl-add-container-btn')?.addEventListener('click', addContainerItem);
    
    document.getElementById('fcl-container-list')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('fcl-remove-container-btn')) {
            const index = parseInt(target.closest<HTMLElement>('.card')?.dataset.index || '-1');
            if (index > -1 && State.fclDetails?.containers) {
                const newContainers = State.fclDetails.containers.filter((_, i) => i !== index);
                setState({ fclDetails: { ...State.fclDetails, containers: newContainers } as FclDetails });
                renderContainerItems();
            }
        }
    });

    // Navigation buttons
    document.getElementById('fcl-back-to-details-btn')?.addEventListener('click', () => goToFclStep(1));
    document.getElementById('fcl-to-agreement-btn')?.addEventListener('click', () => {
        const summaryEl = document.getElementById('fcl-agreement-summary');
        if (summaryEl) {
            summaryEl.innerHTML = (document.querySelector('#fcl-quote-sidebar .payment-overview') as HTMLElement).innerHTML;
        }
        goToFclStep(3);
    });
    document.getElementById('fcl-back-to-compliance-btn')?.addEventListener('click', () => goToFclStep(2));
    document.getElementById('fcl-to-payment-btn')?.addEventListener('click', () => {
        const bookingId = `FCL-${Date.now().toString().slice(-6)}`;
        setState({ fclBookingId: bookingId });
        (document.getElementById('fcl-booking-id') as HTMLElement).textContent = bookingId;
        goToFclStep(4);
    });
    document.getElementById('fcl-new-shipment-btn')?.addEventListener('click', () => startFcl());
    
    // Agreement validation
    document.getElementById('fcl-compliance-ack')?.addEventListener('change', validateAgreement);
    document.getElementById('fcl-signer-name')?.addEventListener('input', validateAgreement);
}

function addContainerItem() {
    const currentContainers = State.fclDetails?.containers || [];
    const newContainers: FclContainer[] = [...currentContainers, { type: '20GP', quantity: 1, weight: 0, weightUnit: 'KG' as const }];
    setState({ fclDetails: { ...State.fclDetails, containers: newContainers } as FclDetails });
    renderContainerItems();
}

// --- INITIALIZATION ---
export function startFcl() {
    setState({ currentService: 'fcl' });
    resetFclState();
    renderFclPage();
    switchPage('fcl');
    attachFclEventListeners();
    goToFclStep(1);
    addContainerItem(); // Start with one container
}
