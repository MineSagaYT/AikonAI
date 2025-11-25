
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
    driveAccessToken: string | null;
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
    connectDrive: () => Promise<void>;
    disconnectDrive: () => void;
}

const AuthContext = createContext<AuthContextType>({ 
    currentUser: null,
    googleAccessToken: null,
    driveAccessToken: null,
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
    connectDrive: async () => {},
    disconnectDrive: () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
    const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // --- 1. Hydrate Tokens from LocalStorage ---
        
        // Gmail
        const storedToken = localStorage.getItem('aikon_gmail_token');
        const storedExp = localStorage.getItem('aikon_gmail_exp');
        if (storedToken && storedExp) {
            const expTime = parseInt(storedExp, 10);
            if (Date.now() < expTime) {
                setGoogleAccessToken(storedToken);
            } else {
                localStorage.removeItem('aikon_gmail_token');
                localStorage.removeItem('aikon_gmail_exp');
            }
        }

        // Drive
        const storedDriveToken = localStorage.getItem('aikon_drive_token');
        const storedDriveExp = localStorage.getItem('aikon_drive_exp');
        if (storedDriveToken && storedDriveExp) {
            const expTime = parseInt(storedDriveExp, 10);
            if (Date.now() < expTime) {
                setDriveAccessToken(storedDriveToken);
            } else {
                localStorage.removeItem('aikon_drive_token');
                localStorage.removeItem('aikon_drive_exp');
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
                
                // Clear all tokens
                setGoogleAccessToken(null);
                localStorage.removeItem('aikon_gmail_token');
                localStorage.removeItem('aikon_gmail_exp');

                setDriveAccessToken(null);
                localStorage.removeItem('aikon_drive_token');
                localStorage.removeItem('aikon_drive_exp');
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
        await signInWithPopup(auth, googleProvider);
    };

    const connectGmail = async () => {
        const scopeProvider = new GoogleAuthProvider();
        scopeProvider.addScope('https://www.googleapis.com/auth/gmail.send');
        
        const result = await signInWithPopup(auth, scopeProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        
        if (credential?.accessToken && auth.currentUser) {
            const token = credential.accessToken;
            setGoogleAccessToken(token);
            
            localStorage.setItem('aikon_gmail_token', token);
            localStorage.setItem('aikon_gmail_exp', (Date.now() + 55 * 60 * 1000).toString());

            const gmailEmail = result.user.email || undefined;
            await updateUserConnections(auth.currentUser.uid, {
                gmail: true,
                gmailEmail: gmailEmail,
                connectedAt: new Date().toISOString()
            });

            if (currentUser) {
                setCurrentUser({
                    ...currentUser,
                    connections: {
                        ...currentUser.connections,
                        gmail: true,
                        gmailEmail: gmailEmail
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

    const connectDrive = async () => {
        const scopeProvider = new GoogleAuthProvider();
        // Request full drive access as requested ("access... create/edit... whatever user wants")
        scopeProvider.addScope('https://www.googleapis.com/auth/drive');
        
        const result = await signInWithPopup(auth, scopeProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        
        if (credential?.accessToken && auth.currentUser) {
            const token = credential.accessToken;
            setDriveAccessToken(token);
            
            localStorage.setItem('aikon_drive_token', token);
            localStorage.setItem('aikon_drive_exp', (Date.now() + 55 * 60 * 1000).toString());

            const driveEmail = result.user.email || undefined;
            await updateUserConnections(auth.currentUser.uid, {
                drive: true,
                driveEmail: driveEmail,
            });

            if (currentUser) {
                setCurrentUser({
                    ...currentUser,
                    connections: {
                        ...currentUser.connections,
                        drive: true,
                        driveEmail: driveEmail
                    }
                });
            }
        }
    };

    const disconnectDrive = async () => {
        setDriveAccessToken(null);
        localStorage.removeItem('aikon_drive_token');
        localStorage.removeItem('aikon_drive_exp');

        if (auth.currentUser && currentUser) {
             await updateUserConnections(auth.currentUser.uid, {
                drive: false
            });
            setCurrentUser({
                ...currentUser,
                connections: {
                    ...currentUser.connections,
                    drive: false
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
        
        await syncUserToFirestore(user, { 
            name: name,
            photoFileName: photoFile?.name 
        });

        await sendEmailVerification(user);
        await signOut(auth);
    };

    const logout = async () => {
        setGoogleAccessToken(null);
        setDriveAccessToken(null);
        localStorage.removeItem('aikon_gmail_token');
        localStorage.removeItem('aikon_gmail_exp');
        localStorage.removeItem('aikon_drive_token');
        localStorage.removeItem('aikon_drive_exp');
        await signOut(auth);
    };

    const resetPassword = async (email: string) => {
        await sendPasswordResetEmail(auth, email);
    };

    const updateEmailAddress = async (newEmail: string) => {
        if (auth.currentUser) {
            await updateEmail(auth.currentUser, newEmail);
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
        
        await deleteUserDocument(uid);
        await auth.currentUser.delete();
        
        setCurrentUser(null);
    };

    return (
        <AuthContext.Provider value={{ 
            currentUser, 
            googleAccessToken, 
            driveAccessToken,
            loading, 
            login, 
            loginWithGoogle, 
            register, 
            logout, 
            resetPassword, 
            updateEmailAddress, 
            updateCurrentUser, 
            deleteAccount, 
            connectGmail, 
            disconnectGmail,
            connectDrive,
            disconnectDrive
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
