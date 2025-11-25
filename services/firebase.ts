import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, User } from "firebase/auth";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    deleteDoc, 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    getDocs,
    serverTimestamp,
    limit,
    Timestamp,
    writeBatch
} from "firebase/firestore";
import { Content } from '@google/genai';
import { Task, ChatListItem, UserProfile, Message, ChatSession, UserConnections } from '../types';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBjYtrHqwMtmjPK6eX_VZqS9nDJDkbxpUk",
  authDomain: "aikonai10.firebaseapp.com",
  projectId: "aikonai10",
  storageBucket: "aikonai10.firebasestorage.app",
  messagingSenderId: "917159525687",
  appId: "1:917159525687:web:9e116f345c85c624772eb2",
  measurementId: "G-E1B95P668Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// NOTE: We do NOT add the gmail.send scope here globally.
// This ensures the initial login is "normal" (profile only).
// We request the gmail scope dynamically in AuthContext.connectGmail().

// --- Firestore User Profile Management ---

export const syncUserToFirestore = async (user: User, additionalData?: { name?: string, photoFileName?: string }) => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        const userData: UserProfile = {
            uid: user.uid,
            displayName: additionalData?.name || user.displayName || 'User',
            email: user.email,
            photoURL: additionalData?.photoFileName || user.photoURL || null,
            aboutYou: additionalData?.name || user.displayName || 'Friend',
            customInstructions: '',
            onboardingCompleted: true,
            pin: '',
            customPersonas: [],
            bio: '',
            age: '',
            connections: {}
        };
        await setDoc(userRef, userData);
        return userData;
    } else {
        return userSnap.data() as UserProfile;
    }
}

export const getUserProfile = async (user: { uid: string }): Promise<UserProfile> => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        return userSnap.data() as UserProfile;
    }
    // Fallback if somehow doc is missing but user is authed (should be handled by sync)
    return {
        uid: user.uid,
        displayName: 'User',
        email: null,
        photoURL: null,
        pin: '',
        aboutYou: 'Friend',
        onboardingCompleted: false,
        bio: '',
        age: '',
        connections: {}
    };
};

export const updateUserProfile = async (userId: string, profileData: Partial<UserProfile>): Promise<void> => {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, profileData);
};

export const updateUserConnections = async (userId: string, connectionData: UserConnections): Promise<void> => {
    const userRef = doc(db, "users", userId);
    // Use merge behavior by creating an object with dot notation if needed, but here simple update works
    // However, since connections is a map, we want to merge it.
    // The safest way with Firestore updateDoc on a map field is tricky if we want to merge deep fields
    // but updateDoc with dot notation works: "connections.gmail": true
    
    const updates: any = {};
    if (connectionData.gmail !== undefined) updates["connections.gmail"] = connectionData.gmail;
    if (connectionData.gmailEmail !== undefined) updates["connections.gmailEmail"] = connectionData.gmailEmail;
    if (connectionData.connectedAt !== undefined) updates["connections.connectedAt"] = connectionData.connectedAt;

    await updateDoc(userRef, updates);
};

export const deleteUserDocument = async (userId: string): Promise<void> => {
    // Delete all chats first
    const chats = await getUserChats(userId);
    for (const chat of chats) {
        await deleteChatSession(userId, chat.id);
    }
    // Delete user doc
    await deleteDoc(doc(db, "users", userId));
};

// --- Firestore Chat History Management ---

export const getUserChats = async (userId: string): Promise<ChatSession[]> => {
    try {
        const chatsRef = collection(db, "users", userId, "chats");
        const q = query(chatsRef, orderBy("updatedAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ChatSession));
    } catch (error) {
        console.error("Error fetching chats:", error);
        return [];
    }
};

export const createNewChatSession = async (userId: string, title: string = "New Chat"): Promise<ChatSession | null> => {
    try {
        const chatsRef = collection(db, "users", userId, "chats");
        
        // Check Limit
        const existingChats = await getDocs(chatsRef);
        if (existingChats.size >= 10) {
            throw new Error("CHAT_LIMIT_REACHED");
        }

        const newChatData = {
            title,
            userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        const docRef = await addDoc(chatsRef, newChatData);
        
        // Return constructed object immediately (ignoring serverTimestamp latency for UI)
        return {
            id: docRef.id,
            ...newChatData,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        } as ChatSession;
    } catch (error) {
        console.error("Error creating chat:", error);
        if ((error as Error).message === "CHAT_LIMIT_REACHED") throw error;
        return null;
    }
};

export const storeMessage = async (userId: string, chatId: string, message: Message): Promise<void> => {
    try {
        const messagesRef = collection(db, "users", userId, "chats", chatId, "messages");
        
        // Sanitize message object for Firestore (remove undefined)
        const msgData = JSON.parse(JSON.stringify(message));
        
        // Add timestamp if missing or convert Date to Firestore Timestamp compatible format
        msgData.timestamp = serverTimestamp();

        // Save message to subcollection
        await addDoc(messagesRef, msgData);

        // Update parent chat's updatedAt
        const chatRef = doc(db, "users", userId, "chats", chatId);
        await updateDoc(chatRef, { updatedAt: serverTimestamp() });
        
    } catch (error) {
        console.error("Error storing message:", error);
    }
};

export const loadChatMessages = async (userId: string, chatId: string): Promise<Message[]> => {
    try {
        const messagesRef = collection(db, "users", userId, "chats", chatId, "messages");
        const q = query(messagesRef, orderBy("timestamp", "asc"));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                // Convert Firestore Timestamp back to Date
                timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date()
            } as Message;
        });
    } catch (error) {
        console.error("Error loading messages:", error);
        return [];
    }
};

export const deleteChatSession = async (userId: string, chatId: string): Promise<void> => {
    try {
        const chatRef = doc(db, "users", userId, "chats", chatId);
        const messagesRef = collection(db, "users", userId, "chats", chatId, "messages");
        
        // Delete all messages in subcollection (Client-side deletion of subcollections)
        const messagesSnap = await getDocs(messagesRef);
        const batch = writeBatch(db);
        
        messagesSnap.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();

        // Delete parent doc
        await deleteDoc(chatRef);
    } catch (error) {
        console.error("Error deleting chat:", error);
    }
};

export const updateChatSessionTitle = async (userId: string, chatId: string, title: string): Promise<void> => {
    const chatRef = doc(db, "users", userId, "chats", chatId);
    await updateDoc(chatRef, { title });
};


// --- Task Management using Local Storage (Kept as requested or could move to Firestore later) ---

const USER_DATA_PREFIX = 'aikon_user_';

const getUserLocalData = (userId: string) => {
    const data = localStorage.getItem(`${USER_DATA_PREFIX}${userId}`);
    if (data) {
        return JSON.parse(data);
    }
    return {
        chats: {},
        tasks: [],
    };
};

const saveUserLocalData = (userId: string, data: any) => {
    localStorage.setItem(`${USER_DATA_PREFIX}${userId}`, JSON.stringify(data));
};

export const getTasks = async (userId: string): Promise<Task[]> => {
    const userData = getUserLocalData(userId);
    return (userData.tasks || []).sort((a: Task, b: Task) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
};

export const addTask = async (userId: string, description: string): Promise<Task | null> => {
    const userData = getUserLocalData(userId);
    const newTask: Task = {
        id: Date.now().toString(),
        description,
        completed: false,
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
    };
    userData.tasks = [newTask, ...(userData.tasks || [])];
    saveUserLocalData(userId, userData);
    return newTask;
};

export const updateTaskStatus = async (userId: string, taskId: string, completed: boolean): Promise<void> => {
    const userData = getUserLocalData(userId);
    const taskIndex = (userData.tasks || []).findIndex((t: Task) => t.id === taskId);
    if (taskIndex > -1) {
        userData.tasks[taskIndex].completed = completed;
        saveUserLocalData(userId, userData);
    }
};

export const completeTaskByDescription = async (userId: string, description: string): Promise<Task | null> => {
    const userData = getUserLocalData(userId);
    const taskIndex = (userData.tasks || []).findIndex((t: Task) => t.description === description && !t.completed);
    if (taskIndex > -1) {
        userData.tasks[taskIndex].completed = true;
        saveUserLocalData(userId, userData);
        return userData.tasks[taskIndex];
    }
    return null;
};

export type { Task };