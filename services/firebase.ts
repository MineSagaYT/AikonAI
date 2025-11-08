
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    query, 
    where, 
    orderBy, 
    getDocs, 
    addDoc, 
    serverTimestamp, 
    updateDoc,
    limit,
    writeBatch
} from '@firebase/firestore';
import { Content } from '@google/genai';
import { Task, ChatListItem, UserProfile } from '../types';

// IMPORTANT: Replace with your actual Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBjYtrHqwMtmjPK6eX_VZqS9nDJDkbxpUk",
  authDomain: "aikonai10.firebaseapp.com",
  projectId: "aikonai10",
  storageBucket: "aikonai10.firebasestorage.app",
  messagingSenderId: "917159525687",
  appId: "1:917159525687:web:434555844601fc33772eb2",
  measurementId: "G-EZVNL8DL3C"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export type { User }; // Export the User type from firebase/auth
export type { Task }; // Re-export the Task type for use in other components

const provider = new GoogleAuthProvider();

export const signInWithGoogle = async (): Promise<User | null> => {
    try {
        const result = await signInWithPopup(auth, provider);
        // Ensure user profile exists after sign-in
        await getUserProfile(result.user);
        return result.user;
    } catch (error) {
        console.error("Error during Google sign-in:", error);
        return null;
    }
};

export const logout = async (): Promise<void> => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out:", error);
    }
};


export const getUserProfile = async (user: User): Promise<UserProfile> => {
    const userDocRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
    } else {
        // If profile doesn't exist, create it
        const newUserProfile: UserProfile = {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            customInstructions: '',
            aboutYou: '',
        };
        await setDoc(userDocRef, newUserProfile);
        return newUserProfile;
    }
};

export const updateUserProfile = async (userId: string, profileData: Partial<UserProfile>): Promise<void> => {
    try {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, profileData);
    } catch (error) {
        console.error("Error updating user profile:", error);
    }
};

export const createChat = async (userId: string): Promise<string> => {
    try {
        const chatsCollectionRef = collection(db, 'users', userId, 'chats');
        const newChatDoc = await addDoc(chatsCollectionRef, {
            title: 'New Chat',
            createdAt: serverTimestamp(),
            history: [],
        });
        return newChatDoc.id;
    } catch (error) {
        console.error("Error creating new chat:", error);
        throw error;
    }
};

export const getChatList = async (userId: string): Promise<ChatListItem[]> => {
    try {
        const chatsCollectionRef = collection(db, 'users', userId, 'chats');
        const q = query(chatsCollectionRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ChatListItem));
    } catch (error) {
        console.error("Error getting chat list:", error);
        return [];
    }
};

export const updateChatTitle = async (userId: string, chatId: string, title: string): Promise<void> => {
    try {
        const chatDocRef = doc(db, 'users', userId, 'chats', chatId);
        await updateDoc(chatDocRef, { title });
    } catch (error) {
        console.error("Error updating chat title:", error);
    }
};

export const deleteAllChatsForUser = async (userId: string): Promise<void> => {
    try {
        const chatsCollectionRef = collection(db, 'users', userId, 'chats');
        const querySnapshot = await getDocs(chatsCollectionRef);
        
        const batch = writeBatch(db);
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
    } catch (error) {
        console.error("Error deleting all chats:", error);
    }
};


/**
 * Saves the chat history for a given user and chat to Firestore.
 * @param userId The UID of the user.
 * @param chatId The ID of the specific chat.
 * @param history The chat history array to save.
 */
export const saveChatHistory = async (userId: string, chatId: string, history: Content[]): Promise<void> => {
    try {
        const chatDocRef = doc(db, 'users', userId, 'chats', chatId);
        await updateDoc(chatDocRef, { history });
    } catch (error) {
        console.error("Error saving chat history:", error);
    }
};

/**
 * Retrieves the chat history for a given user and chat from Firestore.
 * @param userId The UID of the user.
 * @param chatId The ID of the specific chat.
 * @returns The chat history array or null if not found/error.
 */
export const getChatHistory = async (userId: string, chatId: string): Promise<Content[] | null> => {
    try {
        const chatDocRef = doc(db, 'users', userId, 'chats', chatId);
        const docSnap = await getDoc(chatDocRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && Array.isArray(data.history)) {
                 return data.history as Content[];
            }
        }
        return []; // Return empty array if no history
    } catch (error) {
        console.error("Error retrieving chat history:", error);
        return null;
    }
};

/**
 * Retrieves all tasks for a given user from Firestore, ordered by creation time.
 * @param userId The UID of the user.
 * @returns An array of tasks or an empty array if none found.
 */
export const getTasks = async (userId: string): Promise<Task[]> => {
    try {
        const tasksColRef = collection(db, 'tasks');
        const q = query(tasksColRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const tasks: Task[] = [];
        querySnapshot.forEach((doc) => {
            tasks.push({ id: doc.id, ...doc.data() } as Task);
        });
        return tasks;
    } catch (error) {
        console.error("Error retrieving tasks:", error);
        return [];
    }
};

/**
 * Adds a new task for a given user to Firestore.
 * @param userId The UID of the user.
 * @param description The content of the task.
 * @returns The newly created task object or null on failure.
 */
export const addTask = async (userId: string, description: string): Promise<Task | null> => {
    try {
        const tasksColRef = collection(db, 'tasks');
        const docRef = await addDoc(tasksColRef, {
            userId,
            description,
            completed: false,
            createdAt: serverTimestamp(),
        });
        const newDocSnap = await getDoc(docRef);
        if (newDocSnap.exists()) {
            return { id: newDocSnap.id, ...newDocSnap.data() } as Task;
        }
        return null;
    } catch (error) {
        console.error("Error adding task:", error);
        return null;
    }
};

/**
 * Updates the completion status of a specific task.
 * @param userId The UID of the user - used for authorization in security rules (not implemented here)
 * @param taskId The ID of the task document.
 * @param completed The new completion status.
 */
export const updateTaskStatus = async (userId: string, taskId: string, completed: boolean): Promise<void> => {
    try {
        const taskDocRef = doc(db, 'tasks', taskId);
        await updateDoc(taskDocRef, { completed });
    } catch (error) {
        console.error("Error updating task status:", error);
    }
};

/**
 * Finds an uncompleted task by its description and updates its status to complete.
 * @param userId The UID of the user.
 * @param description The description of the task to complete.
 * @returns The updated task or null if not found/error.
 */
export const completeTaskByDescription = async (userId: string, description: string): Promise<Task | null> => {
    try {
        const tasksColRef = collection(db, 'tasks');
        const q = query(tasksColRef,
            where('userId', '==', userId),
            where('description', '==', description), 
            where('completed', '==', false),
            orderBy('createdAt', 'asc'), // Get the oldest one first
            limit(1)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const taskToCompleteDoc = querySnapshot.docs[0];
            await updateDoc(taskToCompleteDoc.ref, { completed: true });
            const updatedDocSnap = await getDoc(taskToCompleteDoc.ref);
             if (updatedDocSnap.exists()) {
                return { id: updatedDocSnap.id, ...updatedDocSnap.data() } as Task;
            }
        }
        return null; // Task not found
    } catch (error) {
        console.error("Error completing task by description:", error);
        return null;
    }
};