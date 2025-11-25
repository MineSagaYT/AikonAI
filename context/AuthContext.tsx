import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile } from '../types';
import { auth, googleProvider, syncUserToFirestore, deleteUserDocument, updateUserProfile, updateUserConnections } from '../services/firebase';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    updateProfile, 
    User, 
    sendEmailVerification, 
    sendPasswordResetEmail,
    signInWithPopup,
    updateEmail,
    GoogleAuthProvider
} from 'firebase/auth';

interface AuthContextType {
    currentUser: UserProfile | null;
    googleAccessToken: string | null;
    loading: boolean;
    login: (email: string, pass: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    register: (email: string, pass: string, name: string, photoFile?: File) => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    updateEmailAddress: (newEmail: string) => Promise<void>;
    updateCurrentUser: (data: Partial<UserProfile>) => void;
    deleteAccount: () => Promise<void>;
    connectGmail: () => Promise<void>;
    disconnectGmail: () => void;
}

const AuthContext = createContext<AuthContextType>({ 
    currentUser: null,
    googleAccessToken: null,
    loading: true, 
    login: async () => {},
    loginWithGoogle: async () => {},
    register: async () => {},
    logout: async () => {},
    resetPassword: async () => {},
    updateEmailAddress: async () => {},
    updateCurrentUser: () => {},
    deleteAccount: async () => {},
    connectGmail: async () => {},
    disconnectGmail: () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // --- 1. Hydrate Token from LocalStorage ---
        const storedToken = localStorage.getItem('aikon_gmail_token');
        const storedExp = localStorage.getItem('aikon_gmail_exp');
        if (storedToken && storedExp) {
            const expTime = parseInt(storedExp, 10);
            if (Date.now() < expTime) {
                setGoogleAccessToken(storedToken);
            } else {
                // Token expired
                localStorage.removeItem('aikon_gmail_token');
                localStorage.removeItem('aikon_gmail_exp');
            }
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            // Check if user is logged in AND verified
            if (user && user.emailVerified) {
                try {
                    // Sync with Firestore
                    const userProfile = await syncUserToFirestore(user);
                    setCurrentUser(userProfile);
                } catch (error) {
                    console.error("Error fetching user profile from Firestore:", error);
                    setCurrentUser(null);
                }
            } else {
                setCurrentUser(null);
                setGoogleAccessToken(null);
                localStorage.removeItem('aikon_gmail_token');
                localStorage.removeItem('aikon_gmail_exp');
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
        // Standard login without special scopes
        // We do NOT store the access token here because it lacks Gmail scopes.
        await signInWithPopup(auth, googleProvider);
        // User state will update via onAuthStateChanged
    };

    const connectGmail = async () => {
        // Trigger a sign-in with popup explicitly asking for Gmail scope
        // This is done ONLY when the user asks to send an email or connects via Profile
        const scopeProvider = new GoogleAuthProvider();
        scopeProvider.addScope('https://www.googleapis.com/auth/gmail.send');
        
        // REMOVED prompt: 'consent' to allow seamless re-auth if user already consented.
        // This is crucial for the "24x7" feel (popup might just flash and close).

        const result = await signInWithPopup(auth, scopeProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        
        if (credential?.accessToken && auth.currentUser) {
            const token = credential.accessToken;
            setGoogleAccessToken(token);
            
            // Persist Token (approx 1 hour usually, saving locally)
            localStorage.setItem('aikon_gmail_token', token);
            // Set expiry for 55 minutes to be safe
            localStorage.setItem('aikon_gmail_exp', (Date.now() + 55 * 60 * 1000).toString());

            // Persist Connection Status to Firestore
            const gmailEmail = result.user.email || undefined;
            await updateUserConnections(auth.currentUser.uid, {
                gmail: true,
                gmailEmail: gmailEmail,
                connectedAt: new Date().toISOString()
            });

            // Update local state immediately
            if (currentUser) {
                setCurrentUser({
                    ...currentUser,
                    connections: {
                        ...currentUser.connections,
                        gmail: true,
                        gmailEmail: gmailEmail,
                        connectedAt: new Date().toISOString()
                    }
                });
            }
        }
    };

    const disconnectGmail = async () => {
        setGoogleAccessToken(null);
        localStorage.removeItem('aikon_gmail_token');
        localStorage.removeItem('aikon_gmail_exp');

        if (auth.currentUser && currentUser) {
             await updateUserConnections(auth.currentUser.uid, {
                gmail: false
            });
            setCurrentUser({
                ...currentUser,
                connections: {
                    ...currentUser.connections,
                    gmail: false
                }
            });
        }
    };

    const register = async (email: string, pass: string, name: string, photoFile?: File) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;
        
        await updateProfile(user, {
            displayName: name,
        });
        
        // Save initial profile to Firestore immediately upon registration
        await syncUserToFirestore(user, { 
            name: name,
            photoFileName: photoFile?.name 
        });

        // Send verification email
        await sendEmailVerification(user);
        
        // Sign out immediately so they don't get into the app until verified
        await signOut(auth);
    };

    const logout = async () => {
        setGoogleAccessToken(null);
        localStorage.removeItem('aikon_gmail_token');
        localStorage.removeItem('aikon_gmail_exp');
        await signOut(auth);
    };

    const resetPassword = async (email: string) => {
        await sendPasswordResetEmail(auth, email);
    };

    const updateEmailAddress = async (newEmail: string) => {
        if (auth.currentUser) {
            await updateEmail(auth.currentUser, newEmail);
            // Sync new email to Firestore immediately
            await updateUserProfile(auth.currentUser.uid, { email: newEmail });
            if (currentUser) {
                setCurrentUser({ ...currentUser, email: newEmail });
            }
        }
    };

    const updateCurrentUser = (data: Partial<UserProfile>) => {
        if (currentUser) {
            setCurrentUser({ ...currentUser, ...data });
        }
    };

    const deleteAccount = async () => {
        if (!auth.currentUser) return;
        const uid = auth.currentUser.uid;
        
        // Delete from Firestore
        await deleteUserDocument(uid);
        
        // Delete Authentication User
        await auth.currentUser.delete();
        
        setCurrentUser(null);
    };

    return (
        <AuthContext.Provider value={{ currentUser, googleAccessToken, loading, login, loginWithGoogle, register, logout, resetPassword, updateEmailAddress, updateCurrentUser, deleteAccount, connectGmail, disconnectGmail }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);