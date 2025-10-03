import { DOMElements } from './dom';
import { mountService } from './router';
import { switchPage, showToast, showPrelaunchModal, closePrelaunchModal, toggleLoading } from './ui';
import { Page, Service, State, setState, Deal } from './state';
// FIX: Removed unused import for initializeApi as it is no longer exported.
import { initializePaymentPage } from './payment';
import { initializeLocaleSwitcher } from './LocaleSwitcher';
import { initializeAuth, handleLogout, updateUIForAuthState } from './auth';
import { initializeStaticPages } from './static_pages';
import { initializeDashboard } from './dashboard';
import { initializeAccountPages }from './account';
import { GoogleGenAI, Chat, Type, GenerateContentResponse } from '@google/genai';
import { initializeI18n, updateStaticUIText, t } from './i18n';
import { initializeSidebar } from './sidebar';
import { unmountPromotionBanner } from './promotions';
import { initializeAPIUsageTracking } from './api-usage-integration';
// FIX: Removed import for initializeSupabase as it is not exported from the module.
// The supabase client is initialized on module load.

// --- Global state for live tracking simulation ---
let liveTrackingInterval: number | null = null;
let iotSimulationInterval: number | null = null;

// --- Theme Management ---
function applyTheme(theme: 'light' | 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vcanship-theme', theme);
}

function initializeTheme() {
    const themeSwitch = document.querySelector('.theme-switch');
    if (!themeSwitch) return;

    const savedTheme = localStorage.getItem('vcanship-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = (savedTheme || (prefersDark ? 'dark' : 'light')) as 'light' | 'dark';
    applyTheme(initialTheme);

    themeSwitch.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    });
}

// --- Smart Header (Auto-hide on scroll down, show on scroll up) ---
function initializeSmartHeader() {
    const header = document.querySelector('header');
    if (!header) return;

    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateHeader = () => {
        const currentScrollY = window.scrollY;
        
        // Don't hide header if we're at the very top
        if (currentScrollY <= 10) {
            header.classList.remove('header-hidden');
        }
        // Hide header when scrolling down (and past 10px)
        else if (currentScrollY > lastScrollY && currentScrollY > 100) {
            header.classList.add('header-hidden');
        }
        // Show header when scrolling up
        else if (currentScrollY < lastScrollY) {
            header.classList.remove('header-hidden');
        }

        lastScrollY = currentScrollY;
        ticking = false;
    };

    const onScroll = () => {
        if (!ticking) {
            window.requestAnimationFrame(updateHeader);
            ticking = true;
        }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
}

// --- Landscape Mode Suggestion for Phones ---
function initializeOrientationSuggestion() {
    // Detect if device is a phone (not tablet or desktop)
    const isPhone = /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent) && window.innerWidth <= 767;
    
    if (!isPhone) return; // Only show for phones, not tablets/desktops

    let orientationBanner: HTMLDivElement | null = null;
    let dismissed = sessionStorage.getItem('vcanship-orientation-dismissed') === 'true';

    const showOrientationSuggestion = () => {
        const isPortrait = window.innerHeight > window.innerWidth;
        
        // Only show if in portrait mode and not dismissed
        if (isPortrait && !dismissed) {
            if (!orientationBanner) {
                orientationBanner = document.createElement('div');
                orientationBanner.style.cssText = `
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 1rem;
                    text-align: center;
                    z-index: 1000;
                    box-shadow: 0 -4px 12px rgba(0,0,0,0.2);
                    animation: slideUp 0.3s ease;
                    font-family: 'Poppins', sans-serif;
                `;
                
                orientationBanner.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; max-width: 600px; margin: 0 auto;">
                        <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
                            <i class="fas fa-mobile-screen-button" style="font-size: 2rem; animation: rotatePhone 2s ease-in-out infinite;"></i>
                            <div style="text-align: left;">
                                <strong style="display: block; margin-bottom: 0.25rem;">Better View Available!</strong>
                                <span style="font-size: 0.9rem; opacity: 0.95;">Rotate your phone to landscape mode</span>
                            </div>
                        </div>
                        <button id="dismiss-orientation" style="
                            background: rgba(255,255,255,0.3);
                            border: 2px solid white;
                            color: white;
                            padding: 0.5rem 1rem;
                            border-radius: 20px;
                            cursor: pointer;
                            font-weight: 600;
                            white-space: nowrap;
                            font-family: 'Poppins', sans-serif;
                        ">Got it</button>
                    </div>
                `;
                
                document.body.appendChild(orientationBanner);
                
                // Add rotation animation
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes slideUp {
                        from { transform: translateY(100%); }
                        to { transform: translateY(0); }
                    }
                    @keyframes rotatePhone {
                        0%, 100% { transform: rotate(0deg); }
                        25% { transform: rotate(-15deg); }
                        75% { transform: rotate(15deg); }
                    }
                `;
                document.head.appendChild(style);
                
                // Dismiss button handler
                const dismissBtn = orientationBanner.querySelector('#dismiss-orientation');
                dismissBtn?.addEventListener('click', () => {
                    dismissed = true;
                    sessionStorage.setItem('vcanship-orientation-dismissed', 'true');
                    if (orientationBanner) {
                        orientationBanner.style.animation = 'slideDown 0.3s ease';
                        setTimeout(() => {
                            orientationBanner?.remove();
                            orientationBanner = null;
                        }, 300);
                    }
                });
            }
        } else if (!isPortrait && orientationBanner) {
            // Remove banner when in landscape
            orientationBanner.remove();
            orientationBanner = null;
        }
    };

    // Check orientation on load
    showOrientationSuggestion();

    // Check when orientation changes
    window.addEventListener('orientationchange', () => {
        setTimeout(showOrientationSuggestion, 300); // Delay for accurate dimensions
    });
    
    // Also check on resize (some devices don't fire orientationchange)
    window.addEventListener('resize', () => {
        setTimeout(showOrientationSuggestion, 100);
    });
}

// --- Chatbot ---
let chat: Chat | null = null;
let ai: GoogleGenAI | null = null;

function initializeChatbot() {
    const fab = document.getElementById('chatbot-fab');
    const chatWindow = document.getElementById('chat-window');
    const closeBtn = document.getElementById('close-chat-btn');
    const form = document.getElementById('chat-form') as HTMLFormElement;
    const input = document.getElementById('chat-input') as HTMLInputElement;
    const history = document.getElementById('chat-history');

    if (!fab || !chatWindow || !closeBtn || !form || !history) return;

    try {
        if (!process.env.API_KEY) {
            console.warn("API_KEY missing for chatbot. Disabling feature.");
            fab.style.display = 'none';
            return;
        }
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        chat = ai.chats.create({
          model: 'gemini-2.5-flash',
          config: {
            systemInstruction: 'You are Vcanship Assistant, a friendly and helpful AI specialized in logistics and shipping. Answer user questions about tracking, services, and booking. Be concise and helpful. If you cannot answer, direct them to support@vcanresources.com.',
          },
        });
    } catch(error) {
        console.error("Failed to initialize Gemini for chatbot:", error);
        fab.style.display = 'none';
        return;
    }

    fab.addEventListener('click', () => {
        chatWindow.classList.remove('hidden');
        fab.classList.add('hidden');
        input.focus();
    });

    closeBtn.addEventListener('click', () => {
        chatWindow.classList.add('hidden');
        fab.classList.remove('hidden');
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!chat) return;
        const message = input.value.trim();
        if (!message) return;

        input.value = '';
        input.disabled = true;

        // Display user message
        const userMessageEl = document.createElement('div');
        userMessageEl.className = 'chat-message user-message';
        userMessageEl.textContent = message;
        history.appendChild(userMessageEl);
        history.scrollTop = history.scrollHeight;
        
        // Display thinking indicator
        const thinkingIndicator = document.createElement('div');
        thinkingIndicator.className = 'chat-message bot-message thinking-indicator';
        thinkingIndicator.innerHTML = `<span>Thinking</span><div class="dot"></div><div class="dot"></div><div class="dot"></div>`;
        history.appendChild(thinkingIndicator);
        history.scrollTop = history.scrollHeight;

        try {
            const responseStream = await chat.sendMessageStream({ message });
            let botMessageEl = document.createElement('div');
            botMessageEl.className = 'chat-message bot-message';
            let firstChunk = true;

            for await (const chunk of responseStream) {
                if (firstChunk) {
                    history.removeChild(thinkingIndicator);
                    history.appendChild(botMessageEl);
                    firstChunk = false;
                }
                // FIX: Access the text content via the .text property on the GenerateContentResponse chunk.
                // This is the correct implementation according to the @google/genai guidelines for streaming responses.
                botMessageEl.textContent += chunk.text;
                history.scrollTop = history.scrollHeight;
            }
        } catch(error) {
            console.error("Chatbot error:", error);
            history.removeChild(thinkingIndicator);
            const errorEl = document.createElement('div');
            errorEl.className = 'chat-message bot-message error';
            errorEl.textContent = "Sorry, I couldn't connect to the assistant right now.";
            history.appendChild(errorEl);
        } finally {
            input.disabled = false;
            input.focus();
            history.scrollTop = history.scrollHeight;
        }
    });
}


// --- Main Application Initialization ---
async function main() {
    // Foundational initializations
    // FIX: Removed call to initializeApi() as it's no longer necessary.
    await initializeI18n();
    initializeTheme();
    initializeSidebar();
    
    // Handle Stripe Redirect from older checkout flows (graceful fallback)
    const urlParams = new URLSearchParams(window.location.search);
    const contextStr = sessionStorage.getItem('vcanship_checkout_context');

    if (urlParams.get('stripe-success') && contextStr) {
        const context = JSON.parse(contextStr);
        showToast('Payment successful! Your shipment is confirmed.', 'success');
        sessionStorage.setItem('vcanship_show_confirmation', JSON.stringify(context));
        mountService(context.service);
        sessionStorage.removeItem('vcanship_checkout_context');
        history.replaceState(null, '', window.location.pathname); 
    } else if (urlParams.get('stripe-cancel')) {
        showToast('Payment was cancelled. You can try again anytime.', 'info');
        sessionStorage.removeItem('vcanship_checkout_context');
        history.replaceState(null, '', window.location.pathname);
    }


    // Feature/Page initializations
    initializeStaticPages();
    initializeAuth();
    initializePaymentPage();
    initializeLocaleSwitcher();
    initializeDashboard();
    initializeAccountPages();
    initializeChatbot();
    initializeSmartHeader(); // Auto-hide header on scroll down, show on scroll up
    initializeOrientationSuggestion(); // Suggest landscape mode for phones
    
    // Initialize API usage tracking (async - only shows for Premium users)
    initializeAPIUsageTracking().catch(err => {
        console.error('Failed to initialize API usage tracking:', err);
    });
    
    // --- Global Event Listeners ---
    document.body.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const serviceBtn = target.closest<HTMLElement>('[data-service]');
        const staticLink = target.closest<HTMLElement>('.static-link');
        
        // Handle static page navigation from sidebar
        if (staticLink) {
            e.preventDefault();
            unmountPromotionBanner();
            const page = staticLink.dataset.page as Page;
            
            if (page === 'landing') {
                setState({ currentService: null });
                switchPage('landing');
            } else {
                 mountService(page);
            }
            return;
        }

        // Handle service card/button clicks
        if (serviceBtn) {
            const service = serviceBtn.dataset.service as Service;
            if (service) {
                e.preventDefault();
                mountService(service);
            }
        }
    });
    
    DOMElements.trackBtn.addEventListener('click', () => {
        DOMElements.trackingModal.classList.add('active');
    });
    DOMElements.closeTrackingModalBtn.addEventListener('click', () => {
        DOMElements.trackingModal.classList.remove('active');
    });
    DOMElements.trackingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        showToast("Live tracking coming soon!", "info");
    });

    DOMElements.complianceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        DOMElements.inspectorModal.classList.add('active');
    });
     DOMElements.closeInspectorModalBtn.addEventListener('click', () => {
        DOMElements.inspectorModal.classList.remove('active');
    });

    // Initial UI state update based on auth
    updateUIForAuthState();
}

// Run the application
main();