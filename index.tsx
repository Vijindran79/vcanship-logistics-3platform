// ⚠️  READ-ONLY — DO NOT EDIT — SERVICE LOCKED ⚠️
import { DOMElements } from './dom';
import { mountService } from './router';
import { switchPage, showToast, showPrelaunchModal, closePrelaunchModal, toggleLoading } from './ui';
import { Page, Service, State, setState, Deal } from './state';
// FIX: Removed unused import for initializeApi as it is no longer exported.
import { initializePaymentPage } from './payment';
import { initializeLocaleSwitcher, countryCodeToFlag } from './LocaleSwitcher';
import { initializeAuth, handleLogout, updateUIForAuthState } from './auth';
import { initializeStaticPages } from './static_pages';
import { initializeDashboard } from './dashboard';
import { initializeAccountPages }from './account';
import { GoogleGenAI, Chat, Type, GenerateContentResponse } from '@google/genai';
import { initializeI18n, updateStaticUIText, t } from './i18n';
import { initializeSidebar } from './sidebar';
import { unmountPromotionBanner } from './promotions';
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