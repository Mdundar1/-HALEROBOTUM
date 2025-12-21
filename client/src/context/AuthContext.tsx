'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';

interface User {
    id: string;
    email: string;
    name: string;
}

interface Subscription {
    hasActiveSubscription: boolean;
    status: string;
    planName: string | null;
    endsAt: string | null;
    isTrial: boolean;
}

interface AuthContextType {
    isLoggedIn: boolean;
    user: User | null;
    subscription: Subscription | null;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
    refreshSubscription: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkSubscription = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setSubscription(null);
                return;
            }

            const res = await fetch('/api/subscription/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setSubscription(data);
            } else {
                setSubscription(null);
            }
        } catch (error) {
            console.error('Error checking subscription:', error);
            setSubscription(null);
        }
    };

    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        if (token && storedUser) {
            try {
                // Optionally fetch fresh user data from API here
                const res = await fetch('/api/user/profile', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem('user', JSON.stringify(data.user));
                    setUser(data.user);
                } else {
                    setUser(JSON.parse(storedUser));
                }
                setIsLoggedIn(true);
                await checkSubscription();
            } catch (e) {
                console.error('checkAuth error:', e);
                setIsLoggedIn(true);
                setUser(JSON.parse(storedUser));
            }
        } else {
            setIsLoggedIn(false);
            setUser(null);
        }
        setIsLoading(false);
    };

    // Check local storage on mount to persist login state
    useEffect(() => {
        checkAuth();
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Login failed');
            }

            const data = await res.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            setIsLoggedIn(true);
            setUser(data.user);
            await checkSubscription();
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    const register = async (email: string, password: string, name: string) => {
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Registration failed');
            }

            const data = await res.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            setIsLoggedIn(true);
            setUser(data.user);
            // New users get a trial automatically
            await checkSubscription();
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsLoggedIn(false);
        setUser(null);
        setSubscription(null);
    };

    return (
        <AuthContext.Provider value={{ isLoggedIn, user, subscription, login, register, logout, isLoading, refreshSubscription: checkSubscription, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
