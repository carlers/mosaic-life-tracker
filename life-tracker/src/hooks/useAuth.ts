import { useState, useEffect, useCallback } from 'react';
import { account } from '../lib/appwrite';
import type { Models } from 'appwrite';


export interface AuthState {
    user: Models.User<Models.Preferences> | null;
    isLoading: boolean;
    error: string | null;
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({ 
        user: null, 
        isLoading: true, 
        error: null 
    });

    useEffect(() => {
        account.get().then(
            (user) => setState({ user, isLoading: false, error: null }),
            () => setState({ user: null, isLoading: false, error: null })
        );
    }, []);

    const login = useCallback(async (email: string, password: string): Promise<boolean> => {
        setState(s => ({ ...s, isLoading: true, error: null }));
        try {
            // Clear any stale sessions first to prevent conflicts
            try { await account.deleteSession('current'); } catch {} 
            
            await account.createEmailPasswordSession(email, password);
            const user = await account.get();
            setState({ user, isLoading: false, error: null });
            return true;
        } catch (err: any) {
            setState(s => ({ ...s, isLoading: false, error: err.message || 'Login failed' }));
            return false;
        }
    }, []);

    const signup = useCallback(async (email: string, password: string, name: string): Promise<boolean> => {
        setState(s => ({ ...s, isLoading: true, error: null }));
        try {
            await account.create('unique()', email, password, name);
            
            // Appwrite sometimes auto-creates a session on signup. 
            // We try to login, but if it says "session active", we ignore the error.
            try {
                await account.createEmailPasswordSession(email, password);
            } catch (sessionError: any) {
                const msg = sessionError.message || '';
                if (!msg.includes('already active') && !msg.includes('prohibited')) {
                    throw sessionError;
                }
            }
            
            const user = await account.get();
            setState({ user, isLoading: false, error: null });
            return true;
        } catch (err: any) {
            setState(s => ({ ...s, isLoading: false, error: err.message || 'Signup failed' }));
            return false;
        }
    }, []);

    const logout = useCallback(async () => {
        setState(s => ({ ...s, isLoading: true, error: null }));
        try {
            await account.deleteSession('current');
            setState({ user: null, isLoading: false, error: null });
        } catch (err: any) {
            setState(s => ({ ...s, isLoading: false, error: err.message || 'Logout failed' }));
        }
    }, []);

    return { ...state, login, signup, logout };
}