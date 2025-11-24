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

const USER_DATA_PREFIX = 'aikon_user_';
const SESSION_KEY = 'aikon_session_username';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for an active session on component mount
        try {
            const sessionUsername = sessionStorage.getItem(SESSION_KEY);
            if (sessionUsername) {
                const userDataString = localStorage.getItem(`${USER_DATA_PREFIX}${sessionUsername}`);
                if (userDataString) {
                    const userData = JSON.parse(userDataString);
                    setCurrentUser(userData.profile);
                }
            }
        } catch (error) {
            console.error("Failed to load session:", error);
            sessionStorage.removeItem(SESSION_KEY);
        } finally {
            setLoading(false);
        }
    }, []);

    const login = useCallback(async (username: string, pin: string): Promise<{ success: boolean; message: string }> => {
        if (!username.trim() || !pin.trim()) {
            return { success: false, message: "Username and PIN cannot be empty." };
        }

        try {
            const userKey = `${USER_DATA_PREFIX}${username}`;
            const userDataString = localStorage.getItem(userKey);

            if (userDataString) {
                // User exists, check PIN (Login)
                const userData = JSON.parse(userDataString);
                if (userData.profile.pin === pin) {
                    setCurrentUser(userData.profile);
                    sessionStorage.setItem(SESSION_KEY, username);
                    return { success: true, message: "Login successful!" };
                } else {
                    return { success: false, message: "Invalid PIN." };
                }
            } else {
                // User does not exist, create new profile (Registration)
                const newUserProfile: UserProfile = {
                    uid: username,
                    displayName: username,
                    email: null,
                    photoURL: null,
                    customInstructions: '',
                    aboutYou: username,
                    onboardingCompleted: true,
                    pin: pin,
                };

                const newUserRecord = {
                    profile: newUserProfile,
                    chatHistory: [],
                    messages: [],
                    customPersonas: [],
                    tasks: [],
                };
                
                localStorage.setItem(userKey, JSON.stringify(newUserRecord));
                setCurrentUser(newUserProfile);
                sessionStorage.setItem(SESSION_KEY, username);
                return { success: true, message: "Account created successfully!" };
            }
        } catch (error) {
            console.error("Login/Registration error:", error);
            return { success: false, message: "An error occurred. Please try again." };
        }
    }, []);

    const logout = useCallback(() => {
        setCurrentUser(null);
        sessionStorage.removeItem(SESSION_KEY);
    }, []);

    const updateCurrentUser = useCallback((data: Partial<UserProfile>) => {
        if (!currentUser) return;

        const updatedProfile = { ...currentUser, ...data };
        setCurrentUser(updatedProfile);

        try {
            const userKey = `${USER_DATA_PREFIX}${currentUser.uid}`;
            const userDataString = localStorage.getItem(userKey);
            if (userDataString) {
                const userData = JSON.parse(userDataString);
                userData.profile = updatedProfile;
                localStorage.setItem(userKey, JSON.stringify(userData));
            }
        } catch (error) {
            console.error("Failed to update user profile in localStorage:", error);
        }
    }, [currentUser]);

    const value = { currentUser, loading, login, logout, updateCurrentUser };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    return useContext(AuthContext);
};
