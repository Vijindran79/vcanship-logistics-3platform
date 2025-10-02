// ⚠️  READ-ONLY — DO NOT EDIT — SERVICE LOCKED ⚠️
import { DOMElements } from './dom';
import { State, setState } from './state';
import { switchPage, showAuthModal, closeAuthModal, toggleLoading } from './ui';
import { mountService } from './router';

// --- MOCK USER SESSION MANAGEMENT ---

/**
 * Checks localStorage for a saved user session.
 */
function checkSession() {
    const savedUser = localStorage.getItem('vcanship_user');
    if (savedUser) {
        const savedLookups = localStorage.getItem('vcanship_free_lookups');
        setState({
            isLoggedIn: true,
            currentUser: JSON.parse(savedUser),
            // MOCK: In a real app, you'd fetch the user's subscription tier from your database.
            // For this demo, we'll assume a restored session is for a 'free' user.
            subscriptionTier: 'free',
            aiLookupsRemaining: savedLookups ? parseInt(savedLookups, 10) : 5,
        });
    }
}

/**
 * Updates the UI based on the current authentication state.
 */
export function updateUIForAuthState() {
    const { isLoggedIn, currentUser } = State;

    // Toggle header buttons
    DOMElements.loginSignupBtn.classList.toggle('hidden', isLoggedIn);
    DOMElements.myAccountDropdown.classList.toggle('hidden', !isLoggedIn);
    
    // Update "My Account" button text
    if (isLoggedIn && currentUser) {
        DOMElements.myAccountBtn.textContent = `Hi, ${currentUser.name.split(' ')[0]}`;
    }

    // Show/hide dashboard link in main nav
    const dashboardLink = document.getElementById('header-dashboard-link');
    if (dashboardLink) {
        dashboardLink.style.display = isLoggedIn ? 'inline-block' : 'none';
    }

    // Update welcome banner on landing page
    const welcomeBanner = document.getElementById('welcome-banner');
    if (welcomeBanner) {
        if (isLoggedIn && currentUser) {
            welcomeBanner.innerHTML = `
                <h2 class="welcome-title">Welcome back, ${currentUser.name}!</h2>
                <p>What would you like to ship today?</p>
            `;
             welcomeBanner.classList.remove('hidden');
        } else {
            // Hide the banner if not logged in to keep the focus on the parcel form
            welcomeBanner.innerHTML = '';
            welcomeBanner.classList.add('hidden');
        }
    }
}


// --- MODAL AND FORM LOGIC ---

/**
 * Toggles between the login and signup views within the modal.
 * @param viewToShow The view to display ('login' or 'signup').
 */
function switchAuthView(viewToShow: 'login' | 'signup') {
    const isLogin = viewToShow === 'login';
    DOMElements.loginView.classList.toggle('hidden', !isLogin);
    DOMElements.signupView.classList.toggle('hidden', isLogin);
    DOMElements.loginToggleText.classList.toggle('hidden', !isLogin);
    DOMElements.signupToggleText.classList.toggle('hidden', isLogin);
}

// --- AUTHENTICATION ACTIONS ---

/**
 * Finalizes the login process for any authentication method.
 * @param user The user object to log in.
 */
function completeLogin(user: { name: string, email: string }) {
    localStorage.setItem('vcanship_user', JSON.stringify(user));
    localStorage.removeItem('vcanship_guest_lookups'); // Clear guest counter on login
    localStorage.setItem('vcanship_free_lookups', '5'); // Set free user counter

    setState({
        isLoggedIn: true,
        currentUser: user,
        subscriptionTier: 'free',
        aiLookupsRemaining: 5,
    });
    
    updateUIForAuthState();
    closeAuthModal();
    
    if (State.postLoginRedirectService) {
        mountService(State.postLoginRedirectService);
        setState({ postLoginRedirectService: null });
    } else {
        switchPage('dashboard');
    }
}

/**
 * Handles a mock social login.
 * @param provider The social provider ('Google' or 'Apple').
 */
function handleSocialLogin(provider: 'Google' | 'Apple') {
    toggleLoading(true, `Signing in with ${provider}...`);

    // Simulate the async nature of social logins
    setTimeout(() => {
        const user = {
            name: provider === 'Google' ? 'Gia Lee' : 'Alex Chen',
            email: provider === 'Google' ? 'gia.lee@example.com' : 'alex.chen@icloud.com',
        };
        
        toggleLoading(false);
        completeLogin(user);
    }, 1500); // 1.5 second delay to simulate redirect and callback
}


/**
 * Handles the email/password login process.
 * @param e The form submission event.
 */
function handleLogin(e: Event) {
    e.preventDefault();
    const email = DOMElements.loginEmail.value;
    // For this demo, we create a mock user based on the email.
    const name = email.split('@')[0].replace(/[^a-zA-Z]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    const user = { name, email };
    
    completeLogin(user);
}

/**
 * Handles the email/password signup process.
 * @param e The form submission event.
 */
function handleSignup(e: Event) {
    e.preventDefault();
    const name = DOMElements.signupName.value;
    const email = DOMElements.signupEmail.value;

    const user = { name, email };
    
    completeLogin(user);
}

/**
 * Handles the logout process.
 */
export function handleLogout() {
    localStorage.removeItem('vcanship_user');
    localStorage.removeItem('vcanship_free_lookups'); // Clear free user counter on logout
    setState({
        isLoggedIn: false,
        currentUser: null,
        subscriptionTier: 'guest',
        aiLookupsRemaining: 0,
    });
    updateUIForAuthState();
    switchPage('landing'); // Redirect to landing page after logout
}


// --- INITIALIZATION ---

/**
 * Sets up all event listeners for the authentication flow.
 */
export function initializeAuth() {
    // Check for existing session on page load
    checkSession();
    
    // Modal controls
    DOMElements.loginSignupBtn.addEventListener('click', showAuthModal);
    DOMElements.closeAuthModalBtn.addEventListener('click', closeAuthModal);

    // View switching
    DOMElements.showSignupBtn.addEventListener('click', () => switchAuthView('signup'));
    DOMElements.showLoginBtn.addEventListener('click', () => switchAuthView('login'));
    
    // Form submissions
    DOMElements.loginForm.addEventListener('submit', handleLogin);
    DOMElements.signupForm.addEventListener('submit', handleSignup);

    // Social Logins - Attach to all buttons with these classes
    document.querySelectorAll('.google-login-btn').forEach(button => {
        button.addEventListener('click', () => handleSocialLogin('Google'));
    });
    document.querySelectorAll('.apple-login-btn').forEach(button => {
        button.addEventListener('click', () => handleSocialLogin('Apple'));
    });

    // Password visibility toggles
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const passwordInput = toggle.previousElementSibling as HTMLInputElement;
            const icon = toggle.querySelector('i');
            if (!passwordInput || !icon) return;

            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
                toggle.setAttribute('aria-label', 'Hide password');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
                toggle.setAttribute('aria-label', 'Show password');
            }
        });
    });
}