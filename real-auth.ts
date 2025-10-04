// real-auth.ts - Production Supabase Authentication
import { supabase } from './supabase';
import { setState } from './state';
import { DOMElements } from './dom';
import { switchPage, showToast, toggleLoading } from './ui';

// --- Types ---
interface AuthUser {
    id: string;
    email: string;
    name: string;
    subscription_tier?: string;
    ai_lookups_remaining?: number;
    stripe_customer_id?: string;
    created_at: string;
}

// --- Authentication Functions ---

/**
 * Sign up with email and password (real Supabase Auth)
 */
export async function signUpWithEmail(email: string, password: string, name: string): Promise<void> {
    try {
        toggleLoading(true, 'Creating your account...');

        // 1. Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name
                },
                emailRedirectTo: `${window.location.origin}/auth/callback`
            }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Failed to create user');

        // 2. Create user profile in database
        const { error: profileError } = await supabase
            .from('users')
            .insert({
                id: authData.user.id,
                email: authData.user.email,
                name: name,
                subscription_tier: 'free'
            });

        if (profileError) throw profileError;

        toggleLoading(false);
        showToast('Account created! Please check your email to verify your account.', 'success');
        
        // Close auth modal
        DOMElements.authModal.classList.remove('active');

    } catch (error: any) {
        toggleLoading(false);
        console.error('Sign up error:', error);
        showToast(error.message || 'Failed to create account', 'error');
    }
}

/**
 * Sign in with email and password (real Supabase Auth)
 */
export async function signInWithEmail(email: string, password: string): Promise<void> {
    try {
        toggleLoading(true, 'Signing in...');

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        if (!data.user) throw new Error('Failed to sign in');

        toggleLoading(false);
        showToast('Welcome back!', 'success');
        
        // Auth state listener will handle UI update
        DOMElements.authModal.classList.remove('active');

    } catch (error: any) {
        toggleLoading(false);
        console.error('Sign in error:', error);
        showToast(error.message || 'Failed to sign in', 'error');
    }
}

/**
 * Sign in with Google OAuth (real, not mock)
 */
export async function signInWithGoogle(): Promise<void> {
    try {
        toggleLoading(true, 'Redirecting to Google...');

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent'
                }
            }
        });

        if (error) throw error;

        // User will be redirected to Google
        // When they return, the auth state listener will handle login

    } catch (error: any) {
        toggleLoading(false);
        console.error('Google sign in error:', error);
        showToast('Failed to sign in with Google', 'error');
    }
}

/**
 * Sign out (real logout)
 */
export async function signOut(): Promise<void> {
    try {
        toggleLoading(true, 'Signing out...');

        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        // Clear local state
        setState({
            isLoggedIn: false,
            currentUser: null,
            subscriptionTier: 'guest',
            aiLookupsRemaining: 0
        });

        toggleLoading(false);
        showToast('Signed out successfully', 'success');
        switchPage('landing');

    } catch (error: any) {
        toggleLoading(false);
        console.error('Sign out error:', error);
        showToast('Failed to sign out', 'error');
    }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
    try {
        toggleLoading(true, 'Sending reset email...');

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/reset-password`
        });

        if (error) throw error;

        toggleLoading(false);
        showToast('Password reset email sent! Check your inbox.', 'success');

    } catch (error: any) {
        toggleLoading(false);
        console.error('Password reset error:', error);
        showToast(error.message || 'Failed to send reset email', 'error');
    }
}

/**
 * Update password (after reset)
 */
export async function updatePassword(newPassword: string): Promise<void> {
    try {
        toggleLoading(true, 'Updating password...');

        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;

        toggleLoading(false);
        showToast('Password updated successfully!', 'success');
        switchPage('dashboard');

    } catch (error: any) {
        toggleLoading(false);
        console.error('Update password error:', error);
        showToast(error.message || 'Failed to update password', 'error');
    }
}

/**
 * Get user profile from database
 */
async function getUserProfile(userId: string): Promise<AuthUser | null> {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data;

    } catch (error) {
        console.error('Failed to get user profile:', error);
        return null;
    }
}

/**
 * Check current session and update UI
 */
export async function checkAuthSession(): Promise<void> {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
            // Get full user profile
            const profile = await getUserProfile(session.user.id);

            if (profile) {
                setState({
                    isLoggedIn: true,
                    currentUser: {
                        name: profile.name,
                        email: profile.email
                    },
                    subscriptionTier: (profile.subscription_tier as 'guest' | 'free' | 'pro') || 'free',
                    aiLookupsRemaining: profile.ai_lookups_remaining || 5
                });

                // Update UI
                if (DOMElements.myAccountBtn) {
                    DOMElements.myAccountBtn.textContent = `Hi, ${profile.name.split(' ')[0]}`;
                }
                if (DOMElements.myAccountDropdown) {
                    DOMElements.myAccountDropdown.classList.remove('hidden');
                }
                if (DOMElements.loginSignupBtn) {
                    DOMElements.loginSignupBtn.style.display = 'none';
                }
            }
        } else {
            // Not logged in
            setState({
                isLoggedIn: false,
                currentUser: null,
                subscriptionTier: 'guest',
                aiLookupsRemaining: 0
            });

            // Update UI
            if (DOMElements.myAccountDropdown) {
                DOMElements.myAccountDropdown.classList.add('hidden');
            }
            if (DOMElements.loginSignupBtn) {
                DOMElements.loginSignupBtn.style.display = 'block';
            }
        }

    } catch (error) {
        console.error('Session check error:', error);
    }
}

/**
 * Initialize auth state listener
 */
export function initializeAuthListener(): void {
    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);

        if (event === 'SIGNED_IN' && session?.user) {
            // User signed in
            const profile = await getUserProfile(session.user.id);
            if (profile) {
                setState({
                    isLoggedIn: true,
                    currentUser: {
                        name: profile.name,
                        email: profile.email
                    },
                    subscriptionTier: (profile.subscription_tier as 'guest' | 'free' | 'pro') || 'free',
                    aiLookupsRemaining: profile.ai_lookups_remaining || 5
                });

                showToast(`Welcome back, ${profile.name.split(' ')[0]}!`, 'success');
                await checkAuthSession(); // Update UI
            }

        } else if (event === 'SIGNED_OUT') {
            // User signed out
            setState({
                isLoggedIn: false,
                currentUser: null,
                subscriptionTier: 'guest',
                aiLookupsRemaining: 0
            });
            await checkAuthSession(); // Update UI
        }
    });
}
