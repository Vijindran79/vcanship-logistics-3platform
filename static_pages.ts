// FIX: Add type definitions for the Web Speech API to resolve "Cannot find name 'SpeechRecognition'" error.
// This is a browser-specific API and its types are not included in the default TypeScript DOM library.
interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}
interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
}
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    onstart: (event: Event) => void;
    onend: (event: Event) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onresult: (event: SpeechRecognitionEvent) => void;
}
declare var SpeechRecognition: {
    new (): SpeechRecognition;
};
declare var webkitSpeechRecognition: {
    new (): SpeechRecognition;
};

// ⚠️  READ-ONLY — DO NOT EDIT — SERVICE LOCKED ⚠️
import { DOMElements } from './dom';
import { State, setState, Address } from './state';
import { t } from './i18n';
import { mountService } from './router';
import { showToast } from './ui';
import { generatePromotions, startPromotionsRotator } from './promotions';

export function renderLandingPage() {
    const page = DOMElements.pageLanding;
    if (!page) return;

    // The "Send a Parcel" form is now the first element, placed directly for immediate user interaction.
    // The original hero section follows, now containing just the branding and messaging.
    page.innerHTML = `
      <div class="hero-parcel-form-card card">
          <div class="landing-form-header">
              <div class="send-parcel-icon-wrapper">
                  <i class="fa-solid fa-truck-fast large-icon"></i>
              </div>
              <div class="header-text">
                  <h3>${t('landing.parcel_title')}</h3>
                  <p class="subtitle">${t('landing.parcel_subtitle')}</p>
              </div>
          </div>
          <form id="landing-parcel-form">
                <div class="landing-toggle-grid">
                    <div class="landing-toggle-group">
                        <button type="button" class="toggle-btn active" data-group="ship-type" data-value="local">Local</button>
                        <button type="button" class="toggle-btn" data-group="ship-type" data-value="international">International</button>
                    </div>
                    <div class="landing-toggle-group">
                        <button type="button" class="toggle-btn active" data-group="delivery-type" data-value="pickup">Schedule Pickup</button>
                        <button type="button" class="toggle-btn" data-group="delivery-type" data-value="dropoff">I'll Drop Off</button>
                    </div>
                </div>
                <div class="landing-form-actions">
                    <button type="submit" class="cta-button">${t('landing.parcel_cta')}</button>
                </div>
          </form>
      </div>

      <section class="landing-hero">
        <div class="seo-rotator-container">
            <div id="seo-rotator-text-1" class="seo-rotator-line seo-rotator-text"></div>
            <div id="seo-rotator-text-2" class="seo-rotator-line seo-rotator-text"></div>
        </div>
        <div id="welcome-banner" class="${State.isLoggedIn ? '' : 'hidden'}"></div>
      </section>

      <section class="landing-section services-overview">
        <h2 class="landing-section-title">Our Core Services</h2>
        <p class="landing-section-subtitle">From a single document to a full container load, we've got you covered.</p>
        <div class="services-overview-grid">
            <div class="service-promo-card card" data-service="parcel">
                <i class="fa-solid fa-box card-icon"></i><h4>Parcel</h4><p>Global door-to-door delivery with the best carriers.</p>
            </div>
            <div class="service-promo-card card" data-service="airfreight">
                <i class="fa-solid fa-plane-departure card-icon card-icon-air"></i><h4>Air Freight</h4><p>Fast and reliable air cargo for time-sensitive shipments.</p>
            </div>
            <div class="service-promo-card card" data-service="fcl">
                <i class="fa-solid fa-boxes-stacked card-icon"></i><h4>Sea Freight FCL</h4><p>Exclusive use of a full container for your goods.</p>
            </div>
            <div class="service-promo-card card" data-service="lcl">
                <i class="fa-solid fa-boxes-packing card-icon"></i><h4>Sea Freight LCL</h4><p>Cost-effective shared container space for smaller loads.</p>
            </div>
            <div class="service-promo-card card" data-service="ecommerce">
                <i class="fa-solid fa-store card-icon"></i><h4>${t('landing.ecommerce_title')}</h4><p>${t('landing.ecommerce_subtitle')}</p>
            </div>
        </div>
      </section>

      <section class="landing-section secure-trade-promo">
        <div class="secure-trade-content">
            <div class="secure-trade-text">
                <h2 class="landing-section-title">Trade with Confidence. Ship without Surprises.</h2>
                <p class="landing-section-subtitle" style="text-align: left; margin-left: 0; max-width: 500px;">Introducing <strong>Vcanship Secure Trade</strong>, our new escrow and verification service that eliminates risks for buyers and sellers in global trade.</p>
                <button class="main-submit-btn" data-service="secure-trade">Learn More & Start a Secure Trade</button>
            </div>
            <div class="secure-trade-steps">
                <div class="step-item"><span>1</span><div><h4>Buyer Pays Vcanship</h4><p>The buyer funds the transaction securely in our escrow account.</p></div></div>
                <div class="step-item"><span>2</span><div><h4>Seller Delivers to Us</h4><p>Seller delivers goods to a Vcanship warehouse for verification.</p></div></div>
                <div class="step-item"><span>3</span><div><h4>We Verify & Ship</h4><p>We inspect the cargo, send a report to the buyer, and ship upon approval.</p></div></div>
                <div class="step-item"><span>4</span><div><h4>Seller Gets Paid</h4><p>We release the funds to the seller once the shipment is underway.</p></div></div>
            </div>
        </div>
      </section>

      <section class="landing-section why-us-section">
        <h2 class="landing-section-title">Why Vcanship?</h2>
        <p class="landing-section-subtitle">We're not just a platform; we're your logistics partner.</p>
        <div class="why-us-grid">
            <div class="feature-item">
                <i class="fa-solid fa-brain feature-item-icon"></i>
                <div><h4>AI-Powered Insights</h4><p>Our intelligent platform analyzes millions of data points to find you optimal routes and pricing.</p></div>
            </div>
            <div class="feature-item">
                <i class="fa-solid fa-globe feature-item-icon"></i>
                <div><h4>Global Reach</h4><p>Access a vast network of carriers and partners covering over 220 countries and territories.</p></div>
            </div>
            <div class="feature-item">
                <i class="fa-solid fa-magnifying-glass-dollar feature-item-icon"></i>
                <div><h4>Transparent Pricing</h4><p>No hidden fees. Get detailed cost breakdowns before you book, every single time.</p></div>
            </div>
        </div>
      </section>
      
      <section class="landing-section live-deals-section">
        <h2 class="landing-section-title">Live Shipping Deals</h2>
        <p class="landing-section-subtitle">Check out our latest hot rates on popular trade lanes, updated daily.</p>
        <div id="live-deals-container" class="live-deals-container">
            <!-- Dynamic promotions will be rendered here by promotions.ts -->
        </div>
      </section>
    `;

    // --- SEO Rotator Logic ---
    const businessSeo = t('landing.seo.business').split('|');
    const emotionalSeo = t('landing.seo.emotional').split('|');
    
    const rotator1 = document.getElementById('seo-rotator-text-1');
    const rotator2 = document.getElementById('seo-rotator-text-2');

    let idx1 = 0;
    let idx2 = 0;

    if (rotator1) {
        rotator1.textContent = businessSeo[idx1];
        rotator1.classList.add('visible'); // Make text visible on initial load
        setInterval(() => {
            rotator1.classList.remove('visible');
            setTimeout(() => {
                idx1 = (idx1 + 1) % businessSeo.length;
                rotator1.textContent = businessSeo[idx1];
                rotator1.classList.add('visible');
            }, 500); // Wait for fade out
        }, 4000); // 4 seconds
    }

    if (rotator2) {
        rotator2.textContent = emotionalSeo[idx2];
         setTimeout(() => { // Stagger the start
            rotator2.classList.add('visible');
             setInterval(() => {
                rotator2.classList.remove('visible');
                setTimeout(() => {
                    idx2 = (idx2 + 1) % emotionalSeo.length;
                    rotator2.textContent = emotionalSeo[idx2];
                    rotator2.classList.add('visible');
                }, 500); // Wait for fade out
            }, 6000); // 6 seconds
        }, 2000);
    }


    // Attach event listeners for the new form
    const parcelForm = document.getElementById('landing-parcel-form');
    
    const toggleGrid = parcelForm?.querySelector('.landing-toggle-grid');
    toggleGrid?.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        if (target.matches('.toggle-btn')) {
            const group = target.dataset.group;
            if (group) {
                // Deactivate other buttons in the same group
                toggleGrid.querySelectorAll(`.toggle-btn[data-group="${group}"]`).forEach(btn => btn.classList.remove('active'));
                // Activate the clicked button
                target.classList.add('active');
            }
        }
    });


    parcelForm?.addEventListener('submit', (e) => {
        e.preventDefault();

        const pickupType = (parcelForm.querySelector('.toggle-btn[data-group="delivery-type"].active') as HTMLElement)?.dataset.value as 'pickup' | 'dropoff';
        
        // Set the delivery preference and clear any old parcel data before navigating
        setState({
            parcelPickupType: pickupType || 'pickup',
            parcelOrigin: undefined,
            parcelDestination: undefined,
            parcelInitialWeight: undefined,
            parcelInitialLength: undefined,
            parcelInitialWidth: undefined,
            parcelInitialHeight: undefined,
        });

        mountService('parcel');
    });
}


export function renderHelpPage() {
    const page = DOMElements.pageHelp;
    if (!page) return;

    const faqs = [
        // General Category
        { category: 'General', question: 'What is Vcanship?', answer: 'Vcanship is an advanced, AI-driven platform designed to simplify global logistics. We connect you with a vast network of carriers to find the most competitive rates for shipping everything from small parcels to full container loads.' },
        { category: 'General', question: 'How does the AI-powered platform work?', answer: 'Our AI analyzes millions of data points, including carrier availability, historical pricing, route efficiency, and fuel costs, to provide you with optimized, real-time quotes. It also helps with compliance by suggesting necessary documents and HS codes for international shipments.' },
        { category: 'General', question: 'What countries do you ship to?', answer: 'We have a global network that covers over 220 countries and territories. Whether you\'re shipping locally or across continents, we have a solution for you.' },
        { category: 'General', question: 'Do you offer shipping insurance?', answer: 'Yes, we offer optional shipping insurance for most services. You can add it during the booking process to protect your shipment\'s declared value against loss or damage.' },
        
        // Shipping Services Category
        { category: 'Shipping', question: 'What is the difference between FCL and LCL?', answer: 'FCL (Full Container Load) means you book an entire container for your exclusive use. LCL (Less than Container Load) means you share container space with other shippers, which is a cost-effective option for smaller shipments that don\'t require a full container.' },
        { category: 'Shipping', question: 'When should I use Air Freight?', answer: 'Air Freight is the fastest shipping method and is ideal for time-sensitive cargo, high-value goods, or items that need to travel long distances quickly. It is generally more expensive than sea freight.' },
        { category: 'Shipping', question: 'Can I ship my personal baggage?', answer: 'Yes! Our Baggage service is a great way to avoid expensive airline excess baggage fees. We can ship your suitcases and personal effects to your destination, often at a lower cost.' },
        { category: 'Shipping', question: 'Can I ship a vehicle?', answer: 'Absolutely. We offer specialized vehicle shipping services, including Roll-on/Roll-off (RoRo) and container shipping for cars, motorcycles, and other vehicles.' },
        { category: 'Shipping', question: 'Do you offer inland transport like trucking and rail?', answer: 'Yes, we provide comprehensive inland transport solutions. This includes Full Truckload (FTL) and Less than Truckload (LTL) services, as well as railway freight for efficient overland logistics across continents.' },
        { category: 'Shipping', question: 'What items are prohibited?', answer: 'Prohibited items typically include hazardous materials, flammable liquids, lithium batteries (unless properly declared), illegal substances, and perishable goods. Regulations vary by country and carrier, so please check our detailed guide or contact support if you are unsure.' },
        
        // Booking & Tracking Category
        { category: 'Booking', question: 'How do I get a quote?', answer: 'Simply select the service you need from our homepage, enter your origin, destination, and shipment details. Our platform will provide you with instant, AI-powered estimates or guide you through the inquiry process for more complex services.' },
        { category: 'Booking', question: 'What is an HS Code and do I need one?', answer: 'The Harmonized System (HS) Code is a standardized numerical method of classifying traded products. It is used by customs authorities around the world to identify products when assessing duties and taxes. For international shipments, an HS code is usually required. Our platform can help suggest a code based on your item description.' },
        { category: 'Booking', question: 'How do I track my shipment?', answer: 'You can track your shipment by clicking the "Track" button in the header and entering your Tracking ID provided after booking. Real-time tracking is available for many of our services.' },

        // Billing & Payments Category
        { category: 'Billing', question: 'What payment methods do you accept?', answer: 'We accept all major credit cards. All transactions are processed securely through our payment provider, Stripe.' },
        { category: 'Billing', question: 'How are customs and duties handled?', answer: 'The recipient of the shipment is typically responsible for any customs, duties, or taxes levied by the destination country. Vcanship provides estimates for these costs where possible, but the final amount is determined by local customs authorities and is not included in our shipping quote unless specified.' },
        { category: 'Billing', question: 'Is the price I see on the quote page final?', answer: 'For services like Parcel, the quote is typically very accurate. For more complex freight services (FCL, LCL, Air), the initial quote is an AI-powered estimate. A Vcanship agent will contact you to confirm all details and provide a final, all-inclusive price before you are charged.' },

        // Account & Partners Category
        { category: 'Account', question: 'What are the benefits of creating a Vcanship account?', answer: 'Creating an account allows you to save addresses, view your complete shipment history, manage payments, and access your dashboard. It makes booking future shipments much faster and easier.' },
        { category: 'Account', question: 'How can I view my past shipments?', answer: 'Once logged in, you can access your full shipment history, including costs and statuses, from your personal Dashboard.' },
        { category: 'Account', question: 'How do I use the API Hub?', answer: 'Our API Hub is for developers who want to integrate Vcanship\'s quoting and booking capabilities into their own applications or e-commerce stores. You can find your API key and code snippets in the API Hub section after logging in.' }
    ];

    const categories = ['All Topics', ...new Set(faqs.map(f => f.category))];
    const categoryIcons: { [key: string]: string } = {
        'All Topics': 'fa-solid fa-grip',
        'General': 'fa-solid fa-circle-info',
        'Shipping': 'fa-solid fa-truck-fast',
        'Booking': 'fa-solid fa-calendar-check',
        'Billing': 'fa-solid fa-file-invoice-dollar',
        'Account': 'fa-solid fa-user-gear'
    };

    page.innerHTML = `
        <div class="service-page-header">
            <h2>Help Center</h2>
            <p class="subtitle">Find answers to common questions about our services.</p>
        </div>
        <div class="help-center-container">
            <div class="help-search-bar">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="search" id="help-search-input" placeholder="Search or ask a question...">
                 <button id="voice-search-btn" aria-label="Search by voice">
                    <i class="fa-solid fa-microphone"></i>
                </button>
            </div>
            
            <div class="faq-categories">
                ${categories.map(cat => `
                    <button class="faq-category-card" data-category="${cat}">
                        <i class="${categoryIcons[cat]}"></i>
                        <span>${cat}</span>
                    </button>
                `).join('')}
            </div>
            
            <div id="faq-list" class="card" style="padding: 1rem 2rem;">
                <!-- FAQs will be rendered here -->
            </div>
            
            <div id="faq-not-found" class="hidden" style="text-align: center; padding: 2rem;">
                <p>No results found. Please try different keywords.</p>
            </div>

            <div class="card contact-support-card">
                <h3>Still have questions?</h3>
                <p>Our support team is ready to help you with any issues.</p>
                <div class="form-actions" style="justify-content: center; gap: 1rem;">
                     <a href="tel:+12513166847" class="secondary-btn" style="text-decoration: none; display: inline-flex; align-items: center; gap: 0.75rem;">
                        <i class="fa-solid fa-phone"></i>
                        <span>Call Support</span>
                    </a>
                    <a href="mailto:support@vcanresources.com" class="main-submit-btn">
                        <i class="fa-regular fa-envelope"></i>
                        <span>Email Support</span>
                    </a>
                </div>
                <div class="contact-support-fallback">
                    <span>Or copy our email:</span>
                    <div class="api-key-display" style="margin-top: 0.5rem; justify-content: center;">
                        <code id="support-email-text">support@vcanresources.com</code>
                        <button class="secondary-btn copy-btn" data-copy-target="#support-email-text">
                            <i class="fa-regular fa-copy"></i>
                            <span>Copy</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const searchInput = page.querySelector('#help-search-input') as HTMLInputElement;
    const categoryContainer = page.querySelector('.faq-categories') as HTMLElement;
    const faqList = page.querySelector('#faq-list') as HTMLElement;
    const notFoundMessage = page.querySelector('#faq-not-found') as HTMLElement;

    let currentCategory = 'All Topics';
    let currentSearchTerm = '';

    function highlight(text: string, query: string): string {
        if (!query) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    function displayFaqs() {
        const filteredFaqs = faqs.filter(faq => {
            const matchesCategory = currentCategory === 'All Topics' || faq.category === currentCategory;
            const matchesSearch = !currentSearchTerm || 
                                  faq.question.toLowerCase().includes(currentSearchTerm) || 
                                  faq.answer.toLowerCase().includes(currentSearchTerm);
            return matchesCategory && matchesSearch;
        });

        if (filteredFaqs.length === 0) {
            faqList.innerHTML = '';
            notFoundMessage.classList.remove('hidden');
        } else {
            faqList.innerHTML = filteredFaqs.map(faq => `
                <div class="faq-item">
                    <div class="faq-question">${highlight(faq.question, currentSearchTerm)}</div>
                    <div class="faq-answer">
                        <p>${highlight(faq.answer, currentSearchTerm)}</p>
                    </div>
                </div>
            `).join('');
            notFoundMessage.classList.add('hidden');
        }
    }
    
    // Initial display
    categoryContainer.querySelector(`[data-category="All Topics"]`)?.classList.add('active');
    displayFaqs();

    // Event Listeners
    searchInput.addEventListener('input', () => {
        currentSearchTerm = searchInput.value.toLowerCase().trim();
        displayFaqs();
    });

    categoryContainer.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const card = target.closest<HTMLButtonElement>('.faq-category-card');
        if (card) {
            currentCategory = card.dataset.category || 'All Topics';
            categoryContainer.querySelectorAll('.faq-category-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            displayFaqs();
        }
    });

    faqList.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const question = target.closest('.faq-question');
        if (question) {
            question.parentElement?.classList.toggle('active');
        }
    });

    page.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            const targetSelector = btn.dataset.copyTarget;
            if (!targetSelector) return;

            const sourceElement = page.querySelector(targetSelector) as HTMLElement;
            if (!sourceElement) return;

            const textToCopy = sourceElement.innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalIcon = btn.querySelector('i')?.className || 'fa-regular fa-copy';
                const originalText = btn.querySelector('span')?.textContent || 'Copy';

                btn.classList.add('copied');
                if(btn.querySelector('i')) btn.querySelector('i')!.className = 'fa-solid fa-check';
                if(btn.querySelector('span')) btn.querySelector('span')!.textContent = 'Copied!';
                btn.disabled = true;

                setTimeout(() => {
                    btn.classList.remove('copied');
                    if(btn.querySelector('i')) btn.querySelector('i')!.className = originalIcon;
                    if(btn.querySelector('span')) btn.querySelector('span')!.textContent = originalText;
                    btn.disabled = false;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                showToast('Failed to copy text.', 'error');
            });
        });
    });

    // --- Voice Search Logic ---
    const voiceSearchBtn = page.querySelector('#voice-search-btn') as HTMLButtonElement;
    const originalPlaceholder = searchInput.placeholder;

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    let recognition: SpeechRecognition | null = null;

    if (SpeechRecognitionAPI) {
        recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        voiceSearchBtn.addEventListener('click', () => {
            if (voiceSearchBtn.classList.contains('listening')) {
                recognition?.stop();
            } else {
                recognition?.start();
            }
        });

        recognition.onstart = () => {
            voiceSearchBtn.classList.add('listening');
            searchInput.placeholder = 'Listening...';
        };
        
        recognition.onend = () => {
            voiceSearchBtn.classList.remove('listening');
            searchInput.placeholder = originalPlaceholder;
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            let errorMessage = 'An error occurred during voice recognition.';
            if (event.error === 'no-speech') {
                errorMessage = "I didn't hear anything. Please try again.";
            } else if (event.error === 'not-allowed') {
                errorMessage = "Microphone access was denied. Please allow access in your browser settings.";
            }
            showToast(errorMessage, 'error');
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const transcript = event.results[0][0].transcript;
            searchInput.value = transcript;
            
            // Trigger the input event to make the existing search logic run
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            searchInput.dispatchEvent(inputEvent);
        };

    } else {
        voiceSearchBtn.style.display = 'none';
        console.warn("Speech Recognition API not supported in this browser.");
    }
}
export function renderApiHubPage() {
    const page = DOMElements.pageApiHub;
    if (!page) return;

    // A mock API key for demonstration purposes
    const mockApiKey = `vcan_live_${'•'.repeat(20)}abcdef123`;

    page.innerHTML = `
        <div class="service-page-header">
            <h2>API Hub</h2>
            <p class="subtitle">Integrate Vcanship's logistics capabilities into your applications.</p>
        </div>
        <div class="api-grid">
            <div class="api-key-card">
                <h3>Your API Key</h3>
                <p class="subtitle" style="text-align: left; margin: 0.5rem 0 1rem 0;">Use this key in the 'Authorization' header of your requests.</p>
                <div class="api-key-display">
                    <code id="api-key-text">${mockApiKey}</code>
                    <button class="secondary-btn copy-btn" data-copy-target="#api-key-text">
                        <i class="fa-regular fa-copy"></i>
                        <span>Copy</span>
                    </button>
                </div>
            </div>

            <div class="code-snippet-card">
                <h4>Get Parcel Rates (JavaScript)</h4>
                <pre>
                    <button class="secondary-btn copy-btn" data-copy-target="#js-code-snippet">
                        <i class="fa-regular fa-copy"></i>
                        <span>Copy</span>
                    </button>
                    <code id="js-code-snippet">
const apiKey = 'YOUR_API_KEY';
const quoteData = {
  origin: { postcode: 'SW1A 0AA', country: 'GB' },
  destination: { postcode: '90210', country: 'US' },
  weight_kg: 2.5
};

fetch('https://api.vcanship.com/v1/parcel/rates', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${apiKey}\`
  },
  body: JSON.stringify(quoteData)
})
.then(response => response.json())
.then(data => console.log(data.quotes))
.catch(error => console.error('Error:', error));
                    </code>
                </pre>
            </div>

            <div class="code-snippet-card">
                <h4>Track a Shipment (Python)</h4>
                <pre>
                    <button class="secondary-btn copy-btn" data-copy-target="#python-code-snippet">
                        <i class="fa-regular fa-copy"></i>
                        <span>Copy</span>
                    </button>
                    <code id="python-code-snippet">
import requests

api_key = 'YOUR_API_KEY'
tracking_id = 'PAR-123456'

url = f"https://api.vcanship.com/v1/tracking/{tracking_id}"
headers = {
    "Authorization": f"Bearer {api_key}"
}

response = requests.get(url, headers=headers)

if response.status_code == 200:
    print(response.json())
else:
    print(f"Error: {response.status_code}")
                    </code>
                </pre>
            </div>
            
            <div class="use-case-card">
                <i class="fa-solid fa-store"></i>
                <h4>E-commerce Integration</h4>
                <p>Automate shipping cost calculation at checkout for your online store.</p>
            </div>
             <div class="use-case-card">
                <i class="fa-solid fa-boxes-stacked"></i>
                <h4>Warehouse Management</h4>
                <p>Integrate with your WMS to book freight and print labels automatically.</p>
            </div>
        </div>
    `;

    // Attach event listeners for copy buttons
    page.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            const targetSelector = btn.dataset.copyTarget;
            if (!targetSelector) return;

            const sourceElement = page.querySelector(targetSelector) as HTMLElement;
            if (!sourceElement) return;

            const textToCopy = sourceElement.innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalIcon = btn.querySelector('i')?.className || 'fa-regular fa-copy';
                const originalText = btn.querySelector('span')?.textContent || 'Copy';

                btn.classList.add('copied');
                if(btn.querySelector('i')) btn.querySelector('i')!.className = 'fa-solid fa-check';
                if(btn.querySelector('span')) btn.querySelector('span')!.textContent = 'Copied!';
                btn.disabled = true;

                setTimeout(() => {
                    btn.classList.remove('copied');
                    if(btn.querySelector('i')) btn.querySelector('i')!.className = originalIcon;
                    if(btn.querySelector('span')) btn.querySelector('span')!.textContent = originalText;
                    btn.disabled = false;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                showToast('Failed to copy text.', 'error');
            });
        });
    });
}
export function renderPrivacyPage() {
    const page = DOMElements.pagePrivacy;
    if (!page) return;
    page.innerHTML = `
        <div class="service-page-header"><h2>Privacy Policy</h2><p class="subtitle">Coming soon.</p></div>
    `;
}
export function renderTermsPage() {
    const page = DOMElements.pageTerms;
    if (!page) return;
    page.innerHTML = `
        <div class="service-page-header"><h2>Terms of Service</h2><p class="subtitle">Coming soon.</p></div>
    `;
}

export function initializeStaticPages() {
    // Inject the new ticker banner content
    const tickerBanner = document.getElementById('top-ticker-banner');
    if (tickerBanner) {
        // More dynamic, "Bloomberg-style" ticker
        const tickerItems = [
            'Welcome to Vcanship',
            'Global Shipping, Intelligently Simplified.',
            'AI-POWERED LOGISTICS',
            'REAL-TIME QUOTES',
            'CONNECTING CONTINENTS'
        ];
        const tickerHtml = tickerItems.map(item => `<span>${item}</span>`).join('');
        // Repeat the content to ensure seamless scrolling
        tickerBanner.innerHTML = `<div class="ticker-content">${tickerHtml.repeat(5)}</div>`;
    }

    renderLandingPage();
    // Initialize promotions
    generatePromotions();
    startPromotionsRotator('live-deals-container');
}