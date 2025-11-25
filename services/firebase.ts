import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, User } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { Content } from '@google/genai';
import { Task, ChatListItem, UserProfile } from '../types';

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
            age: ''
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
        age: ''
    };
};

export const updateUserProfile = async (userId: string, profileData: Partial<UserProfile>): Promise<void> => {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, profileData);
};

export const deleteUserDocument = async (userId: string): Promise<void> => {
    await deleteDoc(doc(db, "users", userId));
};

// --- Local Storage Data Persistence for Chats & Tasks (Kept as per previous logic, but Profile moved to Firestore) ---

const USER_DATA_PREFIX = 'aikon_user_';

// Helper to get all data for a user (Local Storage)
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

// Helper to save all data for a user (Local Storage)
const saveUserLocalData = (userId: string, data: any) => {
    localStorage.setItem(`${USER_DATA_PREFIX}${userId}`, JSON.stringify(data));
};

export const createChat = async (userId: string): Promise<string> => {
    const userData = getUserLocalData(userId);
    const newChatId = Date.now().toString();
    if (!userData.chats) userData.chats = {};
    userData.chats[newChatId] = {
        id: newChatId,
        title: 'New Chat',
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        history: [],
    };
    saveUserLocalData(userId, userData);
    return newChatId;
};

export const getChatList = async (userId: string): Promise<ChatListItem[]> => {
    const userData = getUserLocalData(userId);
    const chats = userData.chats || {};
    return Object.values(chats)
        .map((chat: any) => ({
            id: chat.id,
            title: chat.title,
            createdAt: chat.createdAt,
        }))
        .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
};

export const updateChatTitle = async (userId: string, chatId: string, title: string): Promise<void> => {
    const userData = getUserLocalData(userId);
    if (userData.chats && userData.chats[chatId]) {
        userData.chats[chatId].title = title;
        saveUserLocalData(userId, userData);
    }
};

export const deleteAllChatsForUser = async (userId: string): Promise<void> => {
    const userData = getUserLocalData(userId);
    userData.chats = {};
    saveUserLocalData(userId, userData);
};

export const saveChatHistory = async (userId: string, chatId: string, history: Content[]): Promise<void> => {
    const userData = getUserLocalData(userId);
    if (userData.chats && userData.chats[chatId]) {
        userData.chats[chatId].history = history;
        saveUserLocalData(userId, userData);
    }
};

export const getChatHistory = async (userId: string, chatId: string): Promise<Content[] | null> => {
    const userData = getUserLocalData(userId);
    if (userData.chats && userData.chats[chatId]) {
        return userData.chats[chatId].history || [];
    }
    return [];
};


// --- Task Management using Local Storage ---

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