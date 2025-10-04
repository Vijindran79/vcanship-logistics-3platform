// airfreight.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { State, setState, resetAirfreightState, AirfreightCargoPiece, Quote, ComplianceDoc, AirfreightDetails } from './state';
import { switchPage, updateProgressBar, showToast, toggleLoading } from './ui';
import { getHsCodeSuggestions } from './api';
import { getAirFreightQuotes, displayAPIUsage } from './searates-api';
import { captureCustomerInfo, submitQuoteRequest } from './email-capture';
import { MARKUP_CONFIG } from './pricing';
import { isUserSubscribed, getAPIUnavailableReason } from './subscription';
import { getCachedRates, setCachedRates, getCacheInfo } from './rate-cache';

// --- MODULE STATE ---
let cargoPieces: AirfreightCargoPiece[] = [];
let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, painting = false;


async function getMockAirfreightApiResponse(details: AirfreightDetails): Promise<{ quote: Quote, complianceReport: any }> {
    await new Promise(res => setTimeout(res, 1500)); 

    const baseRatePerKg = 3.5 + Math.random() * 2;
    const baseCost = baseRatePerKg * details.chargeableWeight;
    const quote: Quote = {
        carrierName: "Lufthansa Cargo",
        carrierType: "Air Carrier",
        estimatedTransitTime: "3-5 days",
        chargeableWeight: details.chargeableWeight,
        chargeableWeightUnit: "KG",
        weightBasis: "Chargeable Weight",
        isSpecialOffer: false,
        totalCost: baseCost * 1.1, // with markup
        costBreakdown: {
            baseShippingCost: baseCost,
            fuelSurcharge: baseCost * 0.2,
            estimatedCustomsAndTaxes: 0,
            optionalInsuranceCost: 0,
            ourServiceFee: baseCost * 0.1,
        },
        serviceProvider: "Vcanship AI",
    };

    const requirements: Omit<ComplianceDoc, 'file' | 'status'>[] = [
        { id: 'doc-awb', title: 'Air Waybill (AWB)', description: 'The primary transport document for your air freight.', required: true },
        { id: 'doc-ci', title: 'Commercial Invoice', description: 'A customs document detailing the goods and their value.', required: true },
        { id: 'doc-pl', title: 'Packing List', description: 'Details the contents of the shipment.', required: true },
    ];

    if (details.cargoDescription.toLowerCase().includes('batteries') || details.cargoDescription.toLowerCase().includes('lithium')) {
        requirements.push({ id: 'doc-dgd', title: 'Dangerous Goods Declaration (DGD)', description: 'Required for items containing lithium batteries.', required: true });
    }
     if (details.cargoDescription.toLowerCase().includes('food') || details.cargoDescription.toLowerCase().includes('plant')) {
        requirements.push({ id: 'doc-phyto', title: 'Phytosanitary Certificate', description: 'Required for shipping organic materials like food or plants.', required: true });
    }

    const complianceReport = {
        status: 'Action Required',
        summary: 'Based on your route and cargo, the following documents are required for customs clearance.',
        requirements: requirements,
    };

    return { quote, complianceReport };
}


function goToAirfreightStep(step: number) {
    setState({ currentAirfreightStep: step });
    updateProgressBar('trade-finance', step - 1);
    document.querySelectorAll('#page-airfreight .service-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`airfreight-step-${step}`)?.classList.add('active');

    if (step === 4) {
        initializeSignaturePad();
    }
}

function renderAirfreightPage() {
    const page = document.getElementById('page-airfreight');
    if (!page) return;

    page.innerHTML = `
        <button class="back-btn">Back to Services</button>
        <div class="service-page-header">
            <h2>Book Air Freight</h2>
            <p class="subtitle">Fast and reliable shipping for your time-sensitive cargo.</p>
        </div>
        <div class="form-container">
            <div class="visual-progress-bar" id="progress-bar-trade-finance">
                <div class="progress-step"></div><div class="progress-step"></div><div class="progress-step"></div><div class="progress-step"></div><div class="progress-step"></div>
            </div>

            <!-- Step 1: Details -->
            <div id="airfreight-step-1" class="service-step">
                <form id="airfreight-details-form">
                    <h3>Route & Cargo Details</h3>
                    <div class="form-section two-column">
                        <div class="input-wrapper"><label for="airfreight-origin">Origin Airport (IATA)</label><input type="text" id="airfreight-origin" required placeholder="e.g., LHR"></div>
                        <div class="input-wrapper"><label for="airfreight-destination">Destination Airport (IATA)</label><input type="text" id="airfreight-destination" required placeholder="e.g., JFK"></div>
                    </div>
                    <div class="form-section">
                        <div class="input-wrapper"><label for="airfreight-cargo-description">Detailed Cargo Description</label><textarea id="airfreight-cargo-description" required placeholder="e.g., 10 boxes of smartphone batteries"></textarea></div>
                        <div class="hs-code-suggester-wrapper">
                            <div class="input-wrapper"><label for="airfreight-hs-code">HS Code</label><input type="text" id="airfreight-hs-code" placeholder="Auto-suggested from description"><div class="hs-code-suggestions" id="airfreight-hs-code-suggestions"></div></div>
                        </div>
                    </div>
                    <div class="form-actions"><button type="button" id="airfreight-to-dims-btn" class="main-submit-btn">Next: Dimensions</button></div>
                </form>
            </div>

            <!-- Step 2: Dimensions -->
            <div id="airfreight-step-2" class="service-step">
                <h3>Dimensions & Weight</h3>
                <div id="airfreight-cargo-list"></div>
                <button type="button" id="airfreight-add-piece-btn" class="secondary-btn">Add Piece</button>
                <div id="airfreight-cargo-summary" class="payment-overview" style="margin-top: 1rem;"></div>
                <div class="form-actions" style="justify-content: space-between">
                    <button type="button" id="airfreight-back-to-details-btn" class="secondary-btn">Back</button>
                    <button type="button" id="airfreight-to-quote-btn" class="main-submit-btn">Get Quote & Compliance</button>
                </div>
            </div>

            <!-- Step 3: Quote & Compliance -->
            <div id="airfreight-step-3" class="service-step">
                <h3>Quote & Compliance</h3>
                <div class="results-layout-grid">
                     <main id="airfreight-compliance-container" class="results-main-content"></main>
                     <aside id="airfreight-quote-sidebar" class="results-sidebar"></aside>
                </div>
                <div class="form-actions" style="justify-content: space-between;">
                    <button type="button" id="airfreight-back-to-dims-btn" class="secondary-btn">Back</button>
                    <button type="button" id="airfreight-to-agreement-btn" class="main-submit-btn">Proceed to Agreement</button>
                </div>
            </div>
            
            <!-- Step 4: Agreement -->
            <div id="airfreight-step-4" class="service-step">
                 <h3>Agreement & Finalization</h3>
                 <div class="two-column">
                    <div>
                        <h4>Booking Summary</h4>
                        <div id="airfreight-agreement-summary" class="payment-overview"></div>
                        <div class="checkbox-wrapper" style="margin-top: 1.5rem;"><input type="checkbox" id="airfreight-compliance-ack"><label for="airfreight-compliance-ack">I acknowledge my responsibility for providing the required compliance documents.</label></div>
                    </div>
                    <div>
                        <h4>Digital Signature</h4>
                        <div class="input-wrapper"><label for="airfreight-signer-name">Sign by Typing Your Full Name</label><input type="text" id="airfreight-signer-name"></div>
                        <label>Sign in the box below</label>
                        <canvas id="airfreight-signature-pad" width="400" height="150" style="border: 2px solid var(--border-color); border-radius: 8px; cursor: crosshair;"></canvas>
                    </div>
                 </div>
                 <div class="form-actions" style="justify-content: space-between;">
                    <button type="button" id="airfreight-back-to-compliance-btn" class="secondary-btn">Back</button>
                    <button type="button" id="airfreight-confirm-booking-btn" class="main-submit-btn" disabled>Confirm Booking Request</button>
                </div>
            </div>

            <!-- Step 5: Confirmation -->
            <div id="airfreight-step-5" class="service-step">
                <div class="confirmation-container">
                    <h3>Booking Request Confirmed!</h3>
                    <p>Your Air Freight booking is confirmed. Our operations team will be in touch to coordinate the next steps.</p>
                    <div class="confirmation-tracking"><h4>Booking ID</h4><div class="tracking-id-display" id="airfreight-booking-id"></div></div>
                    <div class="confirmation-actions">
                         <button id="airfreight-download-pdf-btn" class="secondary-btn">Download Summary (PDF)</button>
                         <button id="airfreight-new-shipment-btn" class="main-submit-btn">New Shipment</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}


function renderCargoPieces() {
    const list = document.getElementById('airfreight-cargo-list');
    if (!list) return;
    list.innerHTML = cargoPieces.map((item, index) => `
        <div class="airfreight-cargo-item card" data-index="${index}">
             <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 1rem; align-items: flex-end;">
                <div class="input-wrapper" style="margin-bottom: 0;"><label>Pieces</label><input type="number" class="airfreight-cargo-pieces" value="${item.pieces}" min="1" required></div>
                <div class="input-wrapper" style="margin-bottom: 0;"><label>Length(cm)</label><input type="number" class="airfreight-cargo-length" value="${item.length}" min="1" required></div>
                <div class="input-wrapper" style="margin-bottom: 0;"><label>Width(cm)</label><input type="number" class="airfreight-cargo-width" value="${item.width}" min="1" required></div>
                <div class="input-wrapper" style="margin-bottom: 0;"><label>Height(cm)</label><input type="number" class="airfreight-cargo-height" value="${item.height}" min="1" required></div>
                <div class="input-wrapper" style="margin-bottom: 0;"><label>Weight(kg)</label><input type="number" class="airfreight-cargo-weight" value="${item.weight}" min="1" required></div>
                <button type="button" class="secondary-btn airfreight-remove-piece-btn" style="margin-bottom: 0.5rem;">Remove</button>
            </div>
        </div>
    `).join('');
    updateCargoSummary();
}

function addCargoPiece() {
    cargoPieces.push({ id: Date.now(), pieces: 1, length: 50, width: 50, height: 50, weight: 20 });
    renderCargoPieces();
}

function updateAndRecalculateCargo(): number {
    const newItems: AirfreightCargoPiece[] = [];
    document.querySelectorAll('.airfreight-cargo-item').forEach(itemEl => {
        newItems.push({
            id: Date.now(),
            pieces: parseInt((itemEl.querySelector('.airfreight-cargo-pieces') as HTMLInputElement).value, 10) || 0,
            length: parseInt((itemEl.querySelector('.airfreight-cargo-length') as HTMLInputElement).value, 10) || 0,
            width: parseInt((itemEl.querySelector('.airfreight-cargo-width') as HTMLInputElement).value, 10) || 0,
            height: parseInt((itemEl.querySelector('.airfreight-cargo-height') as HTMLInputElement).value, 10) || 0,
            weight: parseInt((itemEl.querySelector('.airfreight-cargo-weight') as HTMLInputElement).value, 10) || 0,
        });
    });
    cargoPieces = newItems;
    return updateCargoSummary();
}

function updateCargoSummary(): number {
    const summaryEl = document.getElementById('airfreight-cargo-summary');
    if (!summaryEl) return 0;

    let totalVolume = 0;
    let totalWeight = 0;
    cargoPieces.forEach(item => {
        totalVolume += (item.length * item.width * item.height) / 1000000 * item.pieces; // CBM
        totalWeight += item.weight * item.pieces;
    });

    const chargeableWeight = Math.max(totalWeight, totalVolume * 167); // IATA standard: 1 CBM = 167 kg

    if (cargoPieces.length > 0) {
        summaryEl.innerHTML = `
            <div class="review-item"><span>Total Actual Weight:</span><strong>${totalWeight.toFixed(2)} kg</strong></div>
            <div class="review-item"><span>Total Volume:</span><strong>${totalVolume.toFixed(3)} m³</strong></div>
            <div class="review-item total"><span>Chargeable Weight:</span><strong>${chargeableWeight.toFixed(2)} kg</strong></div>
        `;
    } else {
        summaryEl.innerHTML = '';
    }
    return chargeableWeight;
}

async function handleGetQuote() {
    const chargeableWeight = updateAndRecalculateCargo();
    if (cargoPieces.length === 0) {
        showToast("Please add at least one cargo piece.", "error");
        return;
    }

    const details: AirfreightDetails = {
        originAirport: (document.getElementById('airfreight-origin') as HTMLInputElement).value,
        destAirport: (document.getElementById('airfreight-destination') as HTMLInputElement).value,
        cargoDescription: (document.getElementById('airfreight-cargo-description') as HTMLTextAreaElement).value,
        hsCode: (document.getElementById('airfreight-hs-code') as HTMLInputElement).value,
        cargoPieces: cargoPieces,
        chargeableWeight: chargeableWeight,
        serviceLevel: 'standard',
        cargoCategory: '',
    };
    setState({ airfreightDetails: details });
    
    toggleLoading(true, "Getting air freight quotes...");
    
    try {
        // Display API usage
        await displayAPIUsage();
        
        // Calculate total volume for API call
        let totalVolume = 0;
        cargoPieces.forEach(item => {
            totalVolume += (item.length * item.width * item.height) / 1000000 * item.pieces;
        });
        
        let quote: Quote;
        let isRealQuote = false;
        let usedCache = false;
        
        // Step 0: Check subscription
        const hasSubscription = await isUserSubscribed();
        
        // Step 1: Check cache (for subscribed users)
        if (hasSubscription) {
            const cacheParams = { weight: chargeableWeight, volume: totalVolume };
            const cachedQuotes = getCachedRates('airfreight', details.originAirport, details.destAirport, cacheParams);
            
            if (cachedQuotes && cachedQuotes.length > 0) {
                quote = cachedQuotes[0];
                isRealQuote = true;
                usedCache = true;
                
                const cacheInfo = getCacheInfo('airfreight', details.originAirport, details.destAirport, cacheParams);
                showToast(`✅ Using cached air freight rate (${cacheInfo.hoursRemaining}h valid)`, 'success', 3000);
                console.log('[Air Freight] Cache hit, saved 1 API call!');
            }
        }
        
        // Step 2: Try SeaRates API (if subscribed and not cached)
        if (!usedCache && hasSubscription) {
            try {
                console.log('✅ Subscription active - fetching live air freight quotes...');
                const quotes = await getAirFreightQuotes(
                    { country: 'UK', city: details.originAirport },
                    { country: 'US', city: details.destAirport },
                    { weight: chargeableWeight, volume: totalVolume }
                );
                
                if (quotes && quotes.length > 0) {
                    const bestQuote = quotes[0];
                    const baseCost = bestQuote.price;
                    const markupCost = baseCost * (1 + MARKUP_CONFIG.airfreight.standard);
                    
                    quote = {
                        carrierName: bestQuote.carrier,
                        carrierType: "Air Carrier",
                        estimatedTransitTime: bestQuote.transitTime,
                        chargeableWeight: chargeableWeight,
                        chargeableWeightUnit: "KG",
                        weightBasis: "Chargeable Weight",
                        isSpecialOffer: false,
                        totalCost: markupCost,
                        costBreakdown: {
                            baseShippingCost: baseCost,
                            fuelSurcharge: baseCost * 0.2,
                            estimatedCustomsAndTaxes: 0,
                            optionalInsuranceCost: 0,
                            ourServiceFee: markupCost - baseCost,
                        },
                        serviceProvider: `SeaRates (${bestQuote.carrier})`,
                    };
                    
                    // Cache the rate
                    const cacheParams = { weight: chargeableWeight, volume: totalVolume };
                    setCachedRates('airfreight', details.originAirport, details.destAirport, cacheParams, [quote]);
                    
                    isRealQuote = true;
                    showToast('✅ Live air freight quote! Valid for 24 hours.', 'success', 3000);
                } else {
                    throw new Error('No quotes returned from SeaRates');
                }
                
            } catch (apiError: any) {
                console.log('❌ SeaRates API error, falling back to AI:', apiError.message);
            }
        }
        
        // Step 3: Fallback to AI (free users or API error)
        if (!isRealQuote) {
            const reason = await getAPIUnavailableReason();
            console.log(`💡 Using AI estimate: ${reason}`);
            
            // Fallback to mock/estimate
            const baseRatePerKg = 3.5 + Math.random() * 2;
            const baseCost = baseRatePerKg * chargeableWeight;
            
            quote = {
                carrierName: "Lufthansa Cargo",
                carrierType: "Air Carrier",
                estimatedTransitTime: "3-5 days",
                chargeableWeight: chargeableWeight,
                chargeableWeightUnit: "KG",
                weightBasis: "Chargeable Weight",
                isSpecialOffer: false,
                totalCost: baseCost * 1.1,
                costBreakdown: {
                    baseShippingCost: baseCost,
                    fuelSurcharge: baseCost * 0.2,
                    estimatedCustomsAndTaxes: 0,
                    optionalInsuranceCost: 0,
                    ourServiceFee: baseCost * 0.1,
                },
                serviceProvider: "Vcanship AI Estimate",
            };
            
            if (!hasSubscription && State.isLoggedIn) {
                showToast('💡 AI estimate - Upgrade to Premium ($9.99/mo) for live rates!', 'info', 5000);
            } else if (!State.isLoggedIn) {
                showToast('AI estimate. Log in & subscribe for live air freight rates.', 'info', 4000);
            } else {
                showToast('AI estimate - We\'ll email confirmed rates soon.', 'info', 4000);
            }
        }
        
        // Generate standard compliance docs
        const requirements: Omit<ComplianceDoc, 'file' | 'status'>[] = [
            { id: 'doc-awb', title: 'Air Waybill (AWB)', description: 'The primary transport document for your air freight.', required: true },
            { id: 'doc-ci', title: 'Commercial Invoice', description: 'A customs document detailing the goods and their value.', required: true },
            { id: 'doc-pl', title: 'Packing List', description: 'Details the contents of the shipment.', required: true },
        ];

        if (details.cargoDescription.toLowerCase().includes('batteries') || details.cargoDescription.toLowerCase().includes('lithium')) {
            requirements.push({ id: 'doc-dgd', title: 'Dangerous Goods Declaration (DGD)', description: 'Required for items containing lithium batteries.', required: true });
        }
        if (details.cargoDescription.toLowerCase().includes('food') || details.cargoDescription.toLowerCase().includes('plant')) {
            requirements.push({ id: 'doc-phyto', title: 'Phytosanitary Certificate', description: 'Required for shipping organic materials like food or plants.', required: true });
        }
        
        const docs: ComplianceDoc[] = requirements.map((r: any) => ({ ...r, status: 'pending', file: null }));
        
        // Capture customer info if using fallback
        if (!isRealQuote) {
            try {
                const customerInfo = await captureCustomerInfo('Air Freight');
                if (customerInfo) {
                    await submitQuoteRequest({
                        serviceType: 'Air Freight',
                        customerInfo,
                        shipmentDetails: details,
                        aiEstimate: quote
                    });
                }
            } catch (captureError) {
                console.log('Customer info capture skipped:', captureError);
            }
        }
        
        setState({ airfreightQuote: quote, airfreightComplianceDocs: docs });
        renderQuoteAndComplianceStep();
        goToAirfreightStep(3);
        
    } catch (error) {
        console.error("Air freight quote error:", error);
        showToast("Failed to get quote and compliance.", "error");
    } finally {
        toggleLoading(false);
    }
}

function renderQuoteAndComplianceStep() {
    const { airfreightQuote, airfreightComplianceDocs, airfreightDetails } = State;
    const quoteSidebar = document.getElementById('airfreight-quote-sidebar');
    const complianceContainer = document.getElementById('airfreight-compliance-container');

    if (quoteSidebar && airfreightQuote && airfreightDetails) {
        quoteSidebar.innerHTML = `
            <div class="results-section"><h3>Route</h3><p><strong>From:</strong> ${airfreightDetails.originAirport} <strong>To:</strong> ${airfreightDetails.destAirport}</p></div>
            <div class="results-section">
                 <h3>AI-Generated Quote</h3>
                 <div class="payment-overview">
                    <div class="review-item"><span>Carrier:</span><strong>${airfreightQuote.carrierName}</strong></div>
                    <div class="review-item"><span>Transit Time:</span><strong>~${airfreightQuote.estimatedTransitTime}</strong></div>
                    <hr>
                    <div class="review-item total"><span>Est. Total Cost:</span><strong>${State.currentCurrency.symbol}${airfreightQuote.totalCost.toFixed(2)}</strong></div>
                 </div>
            </div>
        `;
    }

    if (complianceContainer && airfreightComplianceDocs) {
        complianceContainer.innerHTML = `
            <h3>Compliance Checklist</h3>
            <p class="subtitle" style="text-align: left; margin: 0 0 1rem;">Upload the required documents for your shipment.</p>
            <div id="airfreight-compliance-checklist" class="compliance-checklist">
                ${airfreightComplianceDocs.map(doc => `
                    <div class="compliance-doc-item" id="${doc.id}" data-status="${doc.status}">
                        <div class="compliance-doc-info"><h4>${doc.title} ${doc.required ? '<span>(Required)</span>' : ''}</h4><p>${doc.description}</p></div>
                        <div class="file-drop-area"><div class="file-drop-area-idle"><span>Drop file or click</span></div><div class="file-drop-area-uploaded" style="display: none;"></div><input type="file" class="file-input" data-doc-id="${doc.id}"></div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

function initializeSignaturePad() {
    canvas = document.getElementById('airfreight-signature-pad') as HTMLCanvasElement;
    if (!canvas) return;
    ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#212121';
    ctx.lineWidth = 2;
    
    const startPosition = (e: MouseEvent | TouchEvent) => { painting = true; draw(e); };
    const finishedPosition = () => { painting = false; ctx.beginPath(); validateAgreement(); };
    const draw = (e: MouseEvent | TouchEvent) => {
        if (!painting) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const pos = e instanceof MouseEvent ? e : e.touches[0];
        ctx.lineTo(pos.clientX - rect.left, pos.clientY - rect.top);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.clientX - rect.left, pos.clientY - rect.top);
    };

    canvas.addEventListener('mousedown', startPosition);
    canvas.addEventListener('mouseup', finishedPosition);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('touchstart', startPosition);
    canvas.addEventListener('touchend', finishedPosition);
    canvas.addEventListener('touchmove', draw);
}

function validateAgreement() {
    const ack = (document.getElementById('airfreight-compliance-ack') as HTMLInputElement).checked;
    const name = (document.getElementById('airfreight-signer-name') as HTMLInputElement).value.trim();
    (document.getElementById('airfreight-confirm-booking-btn') as HTMLButtonElement).disabled = !(ack && name && !isCanvasBlank());
}

function isCanvasBlank() {
    if (!canvas) return true;
    return !canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.some(channel => channel !== 0);
}


function generateAirfreightSummaryPdf() {
    const { airfreightDetails, airfreightQuote, airfreightBookingId } = State;
    if (!airfreightDetails || !airfreightQuote || !airfreightBookingId) {
        showToast('Cannot generate PDF, missing data.', 'error'); return;
    }
    const doc = new jsPDF();
    doc.text('Air Freight Booking Summary', 14, 20);
    doc.text(`Booking ID: ${airfreightBookingId}`, 14, 28);

    autoTable(doc, {
        startY: 35,
        head: [['Detail', 'Information']],
        body: [
            ['Route', `${airfreightDetails.originAirport} -> ${airfreightDetails.destAirport}`],
            ['Cargo', airfreightDetails.cargoDescription],
            ['Chargeable Weight', `${airfreightDetails.chargeableWeight.toFixed(2)} KG`],
            ['Carrier', airfreightQuote.carrierName],
            ['Est. Transit', airfreightQuote.estimatedTransitTime],
            ['Est. Total Cost', `${State.currentCurrency.symbol}${airfreightQuote.totalCost.toFixed(2)}`]
        ]
    });

    const cargoData = airfreightDetails.cargoPieces.map(c => [c.pieces, `${c.length}x${c.width}x${c.height}cm`, `${c.weight}kg`]);
    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Pieces', 'Dimensions', 'Weight']],
        body: cargoData
    });
    
    doc.save(`Vcanship_AIR_${airfreightBookingId}.pdf`);
}

function attachAirfreightEventListeners() {
    const page = document.getElementById('page-airfreight');
    if (!page) return;

    page.querySelector('.back-btn')?.addEventListener('click', () => switchPage('landing'));
    
    // Nav
    document.getElementById('airfreight-to-dims-btn')?.addEventListener('click', () => goToAirfreightStep(2));
    document.getElementById('airfreight-back-to-details-btn')?.addEventListener('click', () => goToAirfreightStep(1));
    document.getElementById('airfreight-to-quote-btn')?.addEventListener('click', handleGetQuote);
    document.getElementById('airfreight-back-to-dims-btn')?.addEventListener('click', () => goToAirfreightStep(2));
    document.getElementById('airfreight-to-agreement-btn')?.addEventListener('click', () => {
        const summaryEl = document.getElementById('airfreight-agreement-summary');
        if (summaryEl && State.airfreightQuote) {
            summaryEl.innerHTML = (document.querySelector('#airfreight-quote-sidebar .payment-overview') as HTMLElement).innerHTML;
        }
        goToAirfreightStep(4);
    });
    document.getElementById('airfreight-back-to-compliance-btn')?.addEventListener('click', () => goToAirfreightStep(3));
    document.getElementById('airfreight-confirm-booking-btn')?.addEventListener('click', () => {
        const bookingId = `AIR-${Date.now().toString().slice(-6)}`;
        setState({ airfreightBookingId: bookingId });
        (document.getElementById('airfreight-booking-id') as HTMLElement).textContent = bookingId;
        goToAirfreightStep(5);
    });
    document.getElementById('airfreight-new-shipment-btn')?.addEventListener('click', startAirfreight);
    document.getElementById('airfreight-download-pdf-btn')?.addEventListener('click', generateAirfreightSummaryPdf);

    // Cargo pieces
    document.getElementById('airfreight-add-piece-btn')?.addEventListener('click', addCargoPiece);
    const cargoList = document.getElementById('airfreight-cargo-list');
    cargoList?.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.airfreight-remove-piece-btn')) {
            const index = parseInt((e.target as HTMLElement).closest<HTMLElement>('.airfreight-cargo-item')?.dataset.index || '-1');
            if (index > -1) {
                cargoPieces.splice(index, 1);
                renderCargoPieces();
            }
        }
    });
    cargoList?.addEventListener('change', updateAndRecalculateCargo);

    // Agreement
    document.getElementById('airfreight-compliance-ack')?.addEventListener('change', validateAgreement);
    document.getElementById('airfreight-signer-name')?.addEventListener('input', validateAgreement);

    // HS Code Suggester
    let hsCodeTimeout: number;
    const descInput = document.getElementById('airfreight-cargo-description') as HTMLInputElement;
    const hsCodeInput = document.getElementById('airfreight-hs-code') as HTMLInputElement;
    const suggestionsContainer = document.getElementById('airfreight-hs-code-suggestions');
    descInput?.addEventListener('input', () => {
        clearTimeout(hsCodeTimeout);
        if (!suggestionsContainer) return;
        const query = descInput.value.trim();
        if (query.length < 5) {
            suggestionsContainer.classList.remove('active'); return;
        }
        hsCodeTimeout = window.setTimeout(async () => {
            const suggestions = await getHsCodeSuggestions(query);
            if (suggestions.length > 0) {
                suggestionsContainer.innerHTML = suggestions.map(s => `<div class="hs-code-suggestion-item" data-code="${s.code}"><strong>${s.code}</strong> - ${s.description}</div>`).join('');
                suggestionsContainer.classList.add('active');
                if (hsCodeInput.value === '') hsCodeInput.value = suggestions[0].code;
            } else {
                suggestionsContainer.classList.remove('active');
            }
        }, 500);
    });
    suggestionsContainer?.addEventListener('click', e => {
        const item = (e.target as HTMLElement).closest<HTMLElement>('.hs-code-suggestion-item');
        if (item?.dataset.code) {
            hsCodeInput.value = item.dataset.code;
            suggestionsContainer.classList.remove('active');
        }
    });
}

export function startAirfreight() {
    setState({ currentService: 'airfreight' });
    resetAirfreightState();
    cargoPieces = [];
    renderAirfreightPage();
    switchPage('airfreight');
    attachAirfreightEventListeners();
    goToAirfreightStep(1);
    addCargoPiece();
}
