// PRODUCTION AUTH - Real Supabase Authentication
import { DOMElements } from './dom';
import { State, setState } from './state';
import { switchPage, showAuthModal, closeAuthModal, toggleLoading, showToast } from './ui';
import { mountService } from './router';
import { 
    signUpWithEmail, 
    signInWithEmail, 
    signInWithGoogle, 
    signOut, 
    resetPassword,
    checkAuthSession,
    initializeAuthListener
} from './real-auth';

// --- REAL USER SESSION MANAGEMENT ---

/**
 * Checks Supabase for current session (real auth)
 */
async function checkSession() {
    await checkAuthSession();
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
 * Handles real social login (Google OAuth via Supabase)
 * @param provider The social provider ('Google' or 'Apple').
 */
async function handleSocialLogin(provider: 'Google' | 'Apple') {
    if (provider === 'Google') {
        await signInWithGoogle();
    } else {
        // Apple Sign In can be implemented similarly
        showToast('Apple Sign In coming soon!', 'info');
    }
}


/**
 * Handles the email/password login process (real auth).
 * @param e The form submission event.
 */
async function handleLogin(e: Event) {
    e.preventDefault();
    const email = DOMElements.loginEmail.value;
    const password = DOMElements.loginPassword.value;
    
    await signInWithEmail(email, password);
}

/**
 * Handles the email/password signup process (real auth).
 * @param e The form submission event.
 */
async function handleSignup(e: Event) {
    e.preventDefault();
    const name = DOMElements.signupName.value;
    const email = DOMElements.signupEmail.value;
    const password = DOMElements.signupPassword.value;
    
    await signUpWithEmail(email, password, name);
}

/**
 * Handles the logout process (real auth).
 */
export async function handleLogout() {
    await signOut();
}


// --- INITIALIZATION ---

/**
 * Sets up all event listeners for the authentication flow (real auth).
 */
export function initializeAuth() {
    // Initialize auth state listener (Supabase)
    initializeAuthListener();
    
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