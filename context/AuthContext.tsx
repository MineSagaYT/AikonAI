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
    calendarAccessToken: string | null;
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
    connectCalendar: () => Promise<void>;
    disconnectCalendar: () => void;
}

const AuthContext = createContext<AuthContextType>({ 
    currentUser: null,
    googleAccessToken: null,
    driveAccessToken: null,
    calendarAccessToken: null,
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
    connectCalendar: async () => {},
    disconnectCalendar: () => {},
});

// Helper to manage token persistence
const persistToken = (key: string, token: string) => {
    localStorage.setItem(key, token);
    localStorage.setItem(`${key}_exp`, (Date.now() + 55 * 60 * 1000).toString());
};

const clearToken = (key: string) => {
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}_exp`);
};

const getValidToken = (key: string): string | null => {
    const token = localStorage.getItem(key);
    const exp = localStorage.getItem(`${key}_exp`);
    
    if (token && exp) {
        const expTime = parseInt(exp, 10);
        if (Date.now() < expTime) {
            return token;
        } else {
            // Expired, clear it
            clearToken(key);
            return null;
        }
    }
    return null;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
    const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
    const [calendarAccessToken, setCalendarAccessToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Initial Hydration
    useEffect(() => {
        const gmailToken = getValidToken('aikon_gmail_token');
        if (gmailToken) setGoogleAccessToken(gmailToken);

        const driveToken = getValidToken('aikon_drive_token');
        if (driveToken) setDriveAccessToken(driveToken);

        const calToken = getValidToken('aikon_calendar_token');
        if (calToken) setCalendarAccessToken(calToken);
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is authenticated by Firebase
                if (user.emailVerified) {
                    try {
                        const userProfile = await syncUserToFirestore(user);
                        setCurrentUser(userProfile);
                    } catch (error) {
                        console.error("Error fetching user profile:", error);
                        setCurrentUser(null);
                    }
                } else {
                    // Logged in but not verified
                    setCurrentUser(null);
                }
            } else {
                // User is explicitly signed out or no session exists
                setCurrentUser(null);
                
                // Only clear tokens if we are sure the user is gone
                setGoogleAccessToken(null);
                clearToken('aikon_gmail_token');

                setDriveAccessToken(null);
                clearToken('aikon_drive_token');

                setCalendarAccessToken(null);
                clearToken('aikon_calendar_token');
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const login = async (email: string, pass: string) => {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        if (!userCredential.user.emailVerified) {
            await signOut(auth); 
            throw new Error("EMAIL_NOT_VERIFIED");
        }
    };

    const loginWithGoogle = async () => {
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
            persistToken('aikon_gmail_token', token);

            const gmailEmail = result.user.email || undefined;
            await updateUserConnections(auth.currentUser.uid, {
                gmail: true,
                gmailEmail: gmailEmail,
                connectedAt: new Date().toISOString()
            });

            if (currentUser) {
                setCurrentUser(prev => prev ? ({
                    ...prev,
                    connections: { ...prev.connections, gmail: true, gmailEmail }
                }) : null);
            }
        }
    };

    const disconnectGmail = async () => {
        setGoogleAccessToken(null);
        clearToken('aikon_gmail_token');

        if (auth.currentUser && currentUser) {
             await updateUserConnections(auth.currentUser.uid, { gmail: false });
             setCurrentUser(prev => prev ? ({
                ...prev,
                connections: { ...prev.connections, gmail: false }
            }) : null);
        }
    };

    const connectDrive = async () => {
        const scopeProvider = new GoogleAuthProvider();
        scopeProvider.addScope('https://www.googleapis.com/auth/drive');
        
        const result = await signInWithPopup(auth, scopeProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        
        if (credential?.accessToken && auth.currentUser) {
            const token = credential.accessToken;
            setDriveAccessToken(token);
            persistToken('aikon_drive_token', token);

            const driveEmail = result.user.email || undefined;
            await updateUserConnections(auth.currentUser.uid, {
                drive: true,
                driveEmail: driveEmail,
            });

            if (currentUser) {
                setCurrentUser(prev => prev ? ({
                    ...prev,
                    connections: { ...prev.connections, drive: true, driveEmail }
                }) : null);
            }
        }
    };

    const disconnectDrive = async () => {
        setDriveAccessToken(null);
        clearToken('aikon_drive_token');

        if (auth.currentUser && currentUser) {
             await updateUserConnections(auth.currentUser.uid, { drive: false });
             setCurrentUser(prev => prev ? ({
                ...prev,
                connections: { ...prev.connections, drive: false }
            }) : null);
        }
    };

    const connectCalendar = async () => {
        const scopeProvider = new GoogleAuthProvider();
        scopeProvider.addScope('https://www.googleapis.com/auth/calendar');
        
        const result = await signInWithPopup(auth, scopeProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        
        if (credential?.accessToken && auth.currentUser) {
            const token = credential.accessToken;
            setCalendarAccessToken(token);
            persistToken('aikon_calendar_token', token);

            const calendarEmail = result.user.email || undefined;
            await updateUserConnections(auth.currentUser.uid, {
                calendar: true,
                calendarEmail: calendarEmail,
            });

            if (currentUser) {
                setCurrentUser(prev => prev ? ({
                    ...prev,
                    connections: { ...prev.connections, calendar: true, calendarEmail }
                }) : null);
            }
        }
    };

    const disconnectCalendar = async () => {
        setCalendarAccessToken(null);
        clearToken('aikon_calendar_token');

        if (auth.currentUser && currentUser) {
             await updateUserConnections(auth.currentUser.uid, { calendar: false });
             setCurrentUser(prev => prev ? ({
                ...prev,
                connections: { ...prev.connections, calendar: false }
            }) : null);
        }
    };

    const register = async (email: string, pass: string, name: string, photoFile?: File) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;
        
        await updateProfile(user, { displayName: name });
        await syncUserToFirestore(user, { name: name, photoFileName: photoFile?.name });
        await sendEmailVerification(user);
        await signOut(auth);
    };

    const logout = async () => {
        setGoogleAccessToken(null);
        setDriveAccessToken(null);
        setCalendarAccessToken(null);
        clearToken('aikon_gmail_token');
        clearToken('aikon_drive_token');
        clearToken('aikon_calendar_token');
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
            calendarAccessToken,
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
            disconnectDrive,
            connectCalendar, 
            disconnectCalendar
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);