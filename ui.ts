import { DOMElements } from './dom';
import { State, setState, type Page } from './state';

/**
 * Updates the visual progress bar for service pages.
 * @param service The service to update the progress bar for (e.g., 'parcel', 'fcl').
 * @param currentStepIndex The current step index (0-based).
 */
export const updateProgressBar = (service: string, currentStepIndex: number) => {
    const progressBarContainer = document.getElementById(`progress-bar-${service}`);
    if (!progressBarContainer) return;

    const steps = progressBarContainer.querySelectorAll<HTMLElement>('.progress-step');
    steps.forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index < currentStepIndex) {
            step.classList.add('completed');
        } else if (index === currentStepIndex) {
            step.classList.add('active');
        }
    });
};


/**
 * Updates the active state of sidebar and header links based on the current page.
 */
function updateSidebarActiveState() {
    const activePage = State.currentPage;
    
    // --- Sidebar ---
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) {
        // Deactivate all buttons first
        sidebar.querySelectorAll('.sidebar-btn, .sidebar-btn-service').forEach(btn => {
            btn.classList.remove('active');
        });

        // Find the button to activate. A page can be a service or a static page.
        // Try matching on data-service first for service pages.
        let activeButton = sidebar.querySelector(`.sidebar-btn-service[data-service="${activePage}"]`);
        
        if (!activeButton) {
            // If not found, it might be a main static page link.
            activeButton = sidebar.querySelector(`.sidebar-btn.static-link[data-page="${activePage}"]`);
        }

        // Special case for landing page, its button is 'Services'
        if (activePage === 'landing') {
            activeButton = sidebar.querySelector(`.sidebar-btn.static-link[data-page="landing"]`);
        }

        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
    
    // --- Header ---
    const header = document.querySelector('header');
    if(header) {
        header.querySelectorAll('.header-btn.static-link').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeHeaderButton = header.querySelector(`.header-btn.static-link[data-page="${activePage}"]`);
        if (activeHeaderButton) {
            activeHeaderButton.classList.add('active');
        }
    }
}


/**
 * Switches the visible page. This function ensures that only one page is active at a time.
 * @param newPage The ID of the page to switch to.
 */
export const switchPage = (newPage: Page) => {
    if (State.currentPage === newPage && newPage !== 'landing') return;

    // Force hide all pages first for robustness
    document.querySelectorAll('#page-container .page').forEach(p => {
        p.classList.remove('active');
    });
    
    const newPageElement = document.getElementById(`page-${newPage}`);
    
    if (newPageElement) {
        newPageElement.classList.add('active');
        setState({ currentPage: newPage });
        updateSidebarActiveState(); 
        window.scrollTo(0, 0); 
    } else {
        console.error(`Page switch failed: Element for page '${newPage}' not found.`);
        // Fallback to landing page if the target doesn't exist to prevent a blank screen.
        if (State.currentPage !== 'landing') {
             switchPage('landing');
        }
    }
};


/**
 * Shows a toast notification with an updated design and new 'warning' type.
 * @param message The message to display.
 * @param type The type of toast (success, error, info, warning).
 * @param duration Duration in milliseconds.
 */
export function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration: number = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const icons = {
        success: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
        error: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
        info: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>`,
        warning: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>`,
    };
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-message">${message}</div>
    `;
    
    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}

/**
 * Toggles the loading overlay.
 * @param show True to show, false to hide.
 * @param text The text to display on the overlay.
 */
export const toggleLoading = (show: boolean, text: string = 'Please wait...') => {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-progress-text');
    if (!loadingOverlay || !loadingText) return;

    loadingText.textContent = text;
    loadingOverlay.classList.toggle('active', show);
};

/**
 * Shows the authentication modal.
 */
export function showAuthModal() {
    DOMElements.authModal.classList.add('active');
}

/**
 * Hides the authentication modal.
 */
export function closeAuthModal() {
    DOMElements.authModal.classList.remove('active');
}

/**
 * Shows the pre-launch "coming soon" modal.
 */
export function showPrelaunchModal() {
    const modal = document.getElementById('prelaunch-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Hides the pre-launch "coming soon" modal.
 */
export function closePrelaunchModal() {
    const modal = document.getElementById('prelaunch-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Displays the usage limit modal with content based on user type.
 * @param userType The type of user who has hit their limit ('guest' or 'free').
 */
export function showUsageLimitModal(userType: 'guest' | 'free') {
    const modal = document.getElementById('usage-limit-modal');
    const title = document.getElementById('limit-modal-title');
    const message = document.getElementById('limit-modal-message');
    const actionBtn = document.getElementById('limit-modal-action-btn') as HTMLButtonElement;
    const closeBtn = document.getElementById('close-limit-modal-btn');

    if (!modal || !title || !message || !actionBtn || !closeBtn) return;

    if (userType === 'guest') {
        title.textContent = 'Free Lookups Used';
        message.textContent = "You've used your 2 free trial lookups. Sign up for a free account to get 5 more each month.";
        actionBtn.textContent = 'Sign Up for Free';
        actionBtn.onclick = () => {
            closeUsageLimitModal();
            showAuthModal();
        };
    } else { // 'free' user
        title.textContent = 'Monthly Limit Reached';
        message.textContent = 'You have reached your monthly limit of 5 AI-powered quotes. Upgrade to Pro for unlimited access and exclusive rates.';
        actionBtn.textContent = 'Upgrade to Pro';
        actionBtn.onclick = () => {
            showToast('Pro plans are coming soon!', 'info');
        };
    }

    closeBtn.onclick = closeUsageLimitModal;
    modal.classList.add('active');
}

/**
 * Hides the usage limit modal.
 */
export function closeUsageLimitModal() {
    const modal = document.getElementById('usage-limit-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Updates the UI element that displays the number of remaining lookups.
 */
export function updateLookupCounterUI() {
    const counterEl = document.getElementById('lookup-counter');
    if (!counterEl) return;

    if (!State.isLoggedIn) {
        const guestLookups = parseInt(localStorage.getItem('vcanship_guest_lookups') || '2', 10);
        counterEl.textContent = `You have ${guestLookups} AI lookups remaining in your free trial.`;
        counterEl.style.display = 'block';
    } else if (State.subscriptionTier === 'free') {
        counterEl.textContent = `You have ${State.aiLookupsRemaining} AI quotes left this month.`;
        counterEl.style.display = 'block';
    } else {
        // Hide for Pro users or other cases
        counterEl.style.display = 'none';
    }
}