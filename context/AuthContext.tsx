
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile } from '../types';

interface AuthContextType {
    currentUser: UserProfile | null;
    loading: boolean;
    login: (username: string, pin: string) => void;
    logout: () => void;
    updateCurrentUser: (data: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType>({ 
    currentUser: null,
    loading: true, 
    login: () => {},
    logout: () => {},
    updateCurrentUser: () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const login = (username: string, pin: string) => {
        // Simplified login for "No login" requirement: Always succeed as Guest
        const guestUser: UserProfile = {
            uid: 'guest',
            displayName: 'Aditya',
            email: 'guest@aikon.ai',
            photoURL: null,
            aboutYou: 'Aditya',
            onboardingCompleted: true,
            pin: '0000'
        };
        setCurrentUser(guestUser);
    };

    const logout = () => {
        setCurrentUser(null);
    };

    const updateCurrentUser = (data: Partial<UserProfile>) => {
        if (currentUser) {
            setCurrentUser({ ...currentUser, ...data });
        }
    };

    useEffect(() => {
        // Simulate checking auth state, then finish loading
        setTimeout(() => setLoading(false), 500);
    }, []);

    return (
        <AuthContext.Provider value={{ currentUser, loading, login, logout, updateCurrentUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
