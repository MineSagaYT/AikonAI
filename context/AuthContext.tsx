
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { UserProfile } from '../types';

interface AuthContextType {
    currentUser: UserProfile | null;
    loading: boolean;
    login: (username: string, pin: string) => Promise<{ success: boolean; message: string }>;
    logout: () => void;
    updateCurrentUser: (data: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType>({ 
    currentUser: null,
    loading: true, 
    login: async () => ({ success: false, message: "Not implemented" }),
    logout: () => {},
    updateCurrentUser: () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Auto-login as 'Aditya' for the full demo experience requested in the prompt
        const demoUser: UserProfile = {
            uid: 'aditya_jain',
            displayName: 'Aditya Jain',
            email: 'aditya@aikon.studios',
            photoURL: null,
            aboutYou: 'Aditya',
            onboardingCompleted: true,
            pin: '0000',
        };
        setCurrentUser(demoUser);
        setLoading(false);
    }, []);

    const login = useCallback(async (username: string, pin: string): Promise<{ success: boolean; message: string }> => {
        return { success: true, message: "Logged in" };
    }, []);

    const logout = useCallback(() => {
        // No-op for now in single page mode
    }, []);

    const updateCurrentUser = useCallback((data: Partial<UserProfile>) => {
        if (!currentUser) return;
        setCurrentUser({ ...currentUser, ...data });
    }, [currentUser]);

    const value = { currentUser, loading, login, logout, updateCurrentUser };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    return useContext(AuthContext);
};
