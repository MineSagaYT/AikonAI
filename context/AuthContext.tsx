import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile } from '../types';
import { auth, googleProvider, syncUserToFirestore, deleteUserDocument, updateUserProfile } from '../services/firebase';
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
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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
        const result = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
            setGoogleAccessToken(credential.accessToken);
        }
        // User state will update via onAuthStateChanged
    };

    const connectGmail = async () => {
        // Trigger a sign-in with popup explicitly asking for Gmail scope
        // This is done ONLY when the user asks to send an email
        const scopeProvider = new GoogleAuthProvider();
        scopeProvider.addScope('https://www.googleapis.com/auth/gmail.send');
        
        // Use the Client ID if provided in a custom parameter, though Firebase usually handles this via Console config
        // scopeProvider.setCustomParameters({ client_id: '973421497766-bhd23a8scm1gqlnk9asu7i5i3g7qv8hn.apps.googleusercontent.com' });

        const result = await signInWithPopup(auth, scopeProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
            setGoogleAccessToken(credential.accessToken);
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
        <AuthContext.Provider value={{ currentUser, googleAccessToken, loading, login, loginWithGoogle, register, logout, resetPassword, updateEmailAddress, updateCurrentUser, deleteAccount, connectGmail }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);