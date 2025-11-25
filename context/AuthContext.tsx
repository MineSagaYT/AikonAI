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
        const guestUser: UserProfile = {
            uid: 'guest',
            displayName: 'Guest', // Changed from Aditya
            email: 'guest@aikon.ai',
            photoURL: null,
            aboutYou: 'Friend', // Changed from Aditya
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
        // Auto-login immediately
        login('Guest', '0000');
        setLoading(false);
    }, []);

    return (
        <AuthContext.Provider value={{ currentUser, loading, login, logout, updateCurrentUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);