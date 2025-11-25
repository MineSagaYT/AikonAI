import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
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
export const googleProvider = new GoogleAuthProvider();

// --- Local Storage Data Persistence (Keeping this for user data isolation by UID) ---

const USER_DATA_PREFIX = 'aikon_user_';

// Helper to get all data for a user
const getUserData = (userId: string) => {
    const data = localStorage.getItem(`${USER_DATA_PREFIX}${userId}`);
    if (data) {
        return JSON.parse(data);
    }
    // Return a default structure if no user data exists
    return {
        profile: {
            uid: userId,
            displayName: userId,
            email: null,
            photoURL: null,
            customInstructions: '',
            aboutYou: userId,
            onboardingCompleted: false,
            pin: '', 
        },
        chats: {},
        tasks: [],
    };
};

// Helper to save all data for a user
const saveUserData = (userId: string, data: any) => {
    localStorage.setItem(`${USER_DATA_PREFIX}${userId}`, JSON.stringify(data));
};


export const getUserProfile = async (user: { uid: string }): Promise<UserProfile> => {
    const userData = getUserData(user.uid);
    return userData.profile;
};

export const updateUserProfile = async (userId: string, profileData: Partial<UserProfile>): Promise<void> => {
    const userData = getUserData(userId);
    userData.profile = { ...userData.profile, ...profileData };
    saveUserData(userId, userData);
};

export const createChat = async (userId: string): Promise<string> => {
    const userData = getUserData(userId);
    const newChatId = Date.now().toString();
    userData.chats[newChatId] = {
        id: newChatId,
        title: 'New Chat',
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        history: [],
    };
    saveUserData(userId, userData);
    return newChatId;
};

export const getChatList = async (userId: string): Promise<ChatListItem[]> => {
    const userData = getUserData(userId);
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
    const userData = getUserData(userId);
    if (userData.chats && userData.chats[chatId]) {
        userData.chats[chatId].title = title;
        saveUserData(userId, userData);
    }
};

export const deleteAllChatsForUser = async (userId: string): Promise<void> => {
    const userData = getUserData(userId);
    userData.chats = {};
    saveUserData(userId, userData);
};

export const saveChatHistory = async (userId: string, chatId: string, history: Content[]): Promise<void> => {
    const userData = getUserData(userId);
    if (userData.chats && userData.chats[chatId]) {
        userData.chats[chatId].history = history;
        saveUserData(userId, userData);
    }
};

export const getChatHistory = async (userId: string, chatId: string): Promise<Content[] | null> => {
    const userData = getUserData(userId);
    if (userData.chats && userData.chats[chatId]) {
        return userData.chats[chatId].history || [];
    }
    return [];
};


// --- Task Management using Local Storage ---

export const getTasks = async (userId: string): Promise<Task[]> => {
    const userData = getUserData(userId);
    return (userData.tasks || []).sort((a: Task, b: Task) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
};

export const addTask = async (userId: string, description: string): Promise<Task | null> => {
    const userData = getUserData(userId);
    const newTask: Task = {
        id: Date.now().toString(),
        description,
        completed: false,
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
    };
    userData.tasks = [newTask, ...(userData.tasks || [])];
    saveUserData(userId, userData);
    return newTask;
};

export const updateTaskStatus = async (userId: string, taskId: string, completed: boolean): Promise<void> => {
    const userData = getUserData(userId);
    const taskIndex = (userData.tasks || []).findIndex((t: Task) => t.id === taskId);
    if (taskIndex > -1) {
        userData.tasks[taskIndex].completed = completed;
        saveUserData(userId, userData);
    }
};

export const completeTaskByDescription = async (userId: string, description: string): Promise<Task | null> => {
    const userData = getUserData(userId);
    const taskIndex = (userData.tasks || []).findIndex((t: Task) => t.description === description && !t.completed);
    if (taskIndex > -1) {
        userData.tasks[taskIndex].completed = true;
        saveUserData(userId, userData);
        return userData.tasks[taskIndex];
    }
    return null;
};

export type { Task };