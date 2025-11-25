import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile } from '../types';
import { auth, googleProvider } from '../services/firebase';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    updateProfile, 
    User, 
    sendEmailVerification, 
    sendPasswordResetEmail,
    signInWithPopup 
} from 'firebase/auth';

interface AuthContextType {
    currentUser: UserProfile | null;
    loading: boolean;
    login: (email: string, pass: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    register: (email: string, pass: string, name: string, photoFile?: File) => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    updateCurrentUser: (data: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType>({ 
    currentUser: null,
    loading: true, 
    login: async () => {},
    loginWithGoogle: async () => {},
    register: async () => {},
    logout: async () => {},
    resetPassword: async () => {},
    updateCurrentUser: () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            // Check if user is logged in AND verified
            // Note: Google Auth users usually have emailVerified = true automatically
            if (user && user.emailVerified) {
                // Map Firebase User to our UserProfile
                const profile: UserProfile = {
                    uid: user.uid,
                    displayName: user.displayName || user.email?.split('@')[0] || 'User',
                    email: user.email,
                    photoURL: user.photoURL,
                    pin: '', // Not used in this auth flow
                    aboutYou: user.displayName || 'Friend',
                    onboardingCompleted: true
                };
                setCurrentUser(profile);
            } else {
                setCurrentUser(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const login = async (email: string, pass: string) => {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        if (!userCredential.user.emailVerified) {
            await signOut(auth); // Sign out immediately if not verified
            throw new Error("EMAIL_NOT_VERIFIED");
        }
    };

    const loginWithGoogle = async () => {
        await signInWithPopup(auth, googleProvider);
        // User state will update via onAuthStateChanged
    };

    const register = async (email: string, pass: string, name: string, photoFile?: File) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;
        
        let photoURL = null;
        if (photoFile) {
            // Placeholder for photo upload logic
            // In a real app with Storage, we would upload here and get the URL.
            // photoURL = await uploadPhoto(photoFile); 
        }

        await updateProfile(user, {
            displayName: name,
            // photoURL: photoURL 
        });
        
        // Send verification email
        await sendEmailVerification(user);
        
        // Sign out immediately so they don't get into the app until verified
        await signOut(auth);
    };

    const logout = async () => {
        await signOut(auth);
    };

    const resetPassword = async (email: string) => {
        await sendPasswordResetEmail(auth, email);
    };

    const updateCurrentUser = (data: Partial<UserProfile>) => {
        if (currentUser) {
            setCurrentUser({ ...currentUser, ...data });
        }
    };

    return (
        <AuthContext.Provider value={{ currentUser, loading, login, loginWithGoogle, register, logout, resetPassword, updateCurrentUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);