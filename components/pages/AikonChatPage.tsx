

import React, { useState, useRef, useEffect } from 'react';
import { Message, FileAttachment, ChatSession } from '../../types';
import { streamMessageToChat, generateImage, generateQRCode, generateWebsiteCode, editImage, generateSpeech } from '../../services/geminiService';
import { sendEmail } from '../../services/emailService';
import { listDriveFiles, createDriveFile, readDriveFile } from '../../services/googleDriveService';
import { listEvents, createEvent } from '../../services/googleCalendarService';
import { useAuth } from '../../context/AuthContext';
import { 
    getUserChats, 
    createNewChatSession, 
    loadChatMessages, 
    storeMessage, 
    deleteChatSession 
} from '../../services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import MessageBubble from '../MessageBubble';
import LiveCallInterface from '../LiveCallInterface';

interface AikonChatPageProps {
    onBack: () => void;
    onProfile: () => void;
}

const MotionDiv = motion.div as any;

const AikonChatPage: React.FC<AikonChatPageProps> = ({ onBack, onProfile }) => {
    const { 
        currentUser, 
        googleAccessToken, 
        connectGmail, 
        disconnectGmail, 
        driveAccessToken, 
        connectDrive, 
        disconnectDrive,
        calendarAccessToken,
        connectCalendar
    } = useAuth();
    
    // Core State
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [files, setFiles] = useState<FileAttachment[]>([]);
    
    // Chat Session Management
    const [chatList, setChatList] = useState<ChatSession[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [isTemporaryMode, setIsTemporaryMode] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // UI State
    const [isTyping, setIsTyping] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCallActive, setIsCallActive] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Pending Actions
    const [pendingEmailAction, setPendingEmailAction] = useState<{to: string, subject: string, body: string, msgId: string, attachments: FileAttachment[]} | null>(null);
    const [pendingDriveAction, setPendingDriveAction] = useState<{action: string, params: any, msgId: string} | null>(null);
    const [pendingCalendarAction, setPendingCalendarAction] = useState<{action: string, params: any, msgId: string} | null>(null);


    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- EFFECT: Load Chat List on Mount/Login ---
    useEffect(() => {
        const initChats = async () => {
            if (currentUser) {
                const chats = await getUserChats(currentUser.uid);
                setChatList(chats);
                
                // Load most recent chat if available
                if (chats.length > 0) {
                    handleLoadChat(chats[0].id);
                }
            } else {
                // Guest mode: clear persistence
                setChatList([]);
                setCurrentChatId(null);
                setMessages([]);
            }
        };
        initChats();
    }, [currentUser]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Auto-retry email sending
    useEffect(() => {
        if (googleAccessToken && pendingEmailAction) {
            executePendingEmail(googleAccessToken, pendingEmailAction);
        }
    }, [googleAccessToken, pendingEmailAction]);

    // Auto-retry Drive action
    useEffect(() => {
        if (driveAccessToken && pendingDriveAction) {
            executePendingDriveAction(driveAccessToken, pendingDriveAction);
        }
    }, [driveAccessToken, pendingDriveAction]);

    // Auto-retry Calendar action
    useEffect(() => {
        if (calendarAccessToken && pendingCalendarAction) {
            executePendingCalendarAction(calendarAccessToken, pendingCalendarAction);
        }
    }, [calendarAccessToken, pendingCalendarAction]);


    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // --- Chat Session Handlers ---

    const handleCreateNewChat = async () => {
        if (!currentUser) return; // Guests just reset local state
        
        if (chatList.length >= 10) {
            showToast("Chat limit reached (Max 10). Please delete old chats.");
            return;
        }

        try {
            const newChat = await createNewChatSession(currentUser.uid, `New Chat ${new Date().toLocaleDateString()}`);
            if (newChat) {
                setChatList(prev => [newChat, ...prev]);
                setCurrentChatId(newChat.id);
                setMessages([]); // Clear view for new chat
                setIsTemporaryMode(false); // Reset temp mode
                if (window.innerWidth < 768) setIsSidebarOpen(false);
            }
        } catch (error: any) {
            if (error.message === "CHAT_LIMIT_REACHED") {
                showToast("Chat limit reached (Max 10).");
            } else {
                showToast("Failed to create new chat.");
            }
        }
    };

    const handleLoadChat = async (chatId: string) => {
        if (!currentUser) return;
        if (chatId === currentChatId) return;

        setIsLoadingHistory(true);
        try {
            const history = await loadChatMessages(currentUser.uid, chatId);
            setMessages(history);
            setCurrentChatId(chatId);
            setIsTemporaryMode(false); // Loading a saved chat implies persistence
            if (window.innerWidth < 768) setIsSidebarOpen(false);
        } catch (error) {
            console.error("Failed to load chat", error);
            showToast("Failed to load chat history.");
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
        e.stopPropagation();
        if (!currentUser) return;
        if (!window.confirm("Delete this chat permanently?")) return;

        try {
            await deleteChatSession(currentUser.uid, chatId);
            setChatList(prev => prev.filter(c => c.id !== chatId));
            
            // If deleting current chat, reset view
            if (currentChatId === chatId) {
                setMessages([]);
                setCurrentChatId(null);
            }
        } catch (error) {
            showToast("Failed to delete chat.");
        }
    };

    const handleNewConversationGuest = () => {
        setMessages([]);
        setFiles([]);
        setInput('');
        setCurrentChatId(null);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };


    // --- Core Chat Logic ---

    const handleConnectGmail = async () => {
        try {
            await connectGmail();
            showToast("Gmail Connected Successfully!");
        } catch (error) {
            console.error("Gmail Connection Failed", error);
            showToast("Failed to connect Gmail.");
        }
    };
    
    const handleConnectDrive = async () => {
        try {
            await connectDrive();
            showToast("Google Drive Connected Successfully!");
        } catch (error) {
            console.error("Drive Connection Failed", error);
            showToast("Failed to connect Google Drive.");
        }
    };

    const handleConnectCalendar = async () => {
        try {
            await connectCalendar();
            showToast("Google Calendar Connected Successfully!");
        } catch (error) {
             console.error("Calendar Connection Failed", error);
             showToast("Failed to connect Google Calendar.");
        }
    }

    const executePendingEmail = async (token: string, action: {to: string, subject: string, body: string, msgId: string, attachments: FileAttachment[]}) => {
        setMessages(prev => prev.map(m => m.id === action.msgId ? { ...m, text: m.text.replace("I need access to your Gmail to send this. Please connect your account below.", "Access granted. Sending email... 📧"), status: 'sent' } : m));
        setMessages(prev => prev.filter(m => m.text !== 'CONNECT_GMAIL_ACTION'));

        const result = await sendEmail(token, action.to, action.subject, action.body, action.attachments);
                             
        if (result.success) {
            const updatedMsg = { 
                id: action.msgId, 
                text: `✅ ${result.message}`, 
                status: 'sent' as const,
                timestamp: new Date(),
                sender: 'ai' as const
            };
            setMessages(prev => prev.map(m => m.id === action.msgId ? { ...m, ...updatedMsg } : m));
        } else {
             if (result.message.includes('UNAUTHENTICATED') || result.message.includes('Authentication failed')) {
                setMessages(prev => prev.map(m => m.id === action.msgId ? { 
                    ...m, 
                    text: `❌ ${result.message}\n\nSession expired. Please reconnect Gmail.`, 
                    status: 'sent' 
                } : m));
            } else {
                setMessages(prev => prev.map(m => m.id === action.msgId ? { 
                    ...m, 
                    text: `❌ ${result.message}`, 
                    status: 'sent' 
                } : m));
            }
        }
        setPendingEmailAction(null);
    };

    const executePendingDriveAction = async (token: string, action: {action: string, params: any, msgId: string}) => {
        setMessages(prev => prev.map(m => m.id === action.msgId ? { ...m, text: "Access granted. Processing Google Drive request... 📂", status: 'sent' } : m));
        setMessages(prev => prev.filter(m => m.text !== 'CONNECT_DRIVE_ACTION'));

        let resultMsg = "";
        let success = false;

        if (action.action === 'list_files') {
            const res = await listDriveFiles(token, action.params.query);
            if (res.success && res.files) {
                success = true;
                if (res.files.length === 0) {
                    resultMsg = "No files found matching criteria.";
                } else {
                    resultMsg = `### 📂 Found ${res.files.length} files:\n\n` + 
                        res.files.map(f => `* **${f.name}** (ID: \`${f.id}\`) - [Open](${f.webViewLink})`).join('\n');
                }
            } else {
                 if (res.message === 'UNAUTHENTICATED') {
                    resultMsg = "Session expired. Please reconnect Drive.";
                 } else {
                    resultMsg = `Failed to list files: ${res.message}`;
                 }
            }
        } else if (action.action === 'create_file') {
            const res = await createDriveFile(token, action.params.fileName, action.params.content, action.params.mimeType);
            if (res.success) {
                success = true;
                resultMsg = `✅ File **${action.params.fileName}** created successfully!\n\n[Open in Drive](${res.webViewLink})`;
            } else {
                 if (res.message === 'UNAUTHENTICATED') resultMsg = "Session expired. Please reconnect Drive.";
                 else resultMsg = `Failed to create file: ${res.message}`;
            }
        } else if (action.action === 'read_file') {
            const res = await readDriveFile(token, action.params.fileId);
            if (res.success) {
                success = true;
                resultMsg = `### 📄 File Content:\n\n\`\`\`\n${res.content}\n\`\`\``;
            } else {
                 if (res.message === 'UNAUTHENTICATED') resultMsg = "Session expired. Please reconnect Drive.";
                 else resultMsg = `Failed to read file: ${res.message}`;
            }
        }

        // Update the message bubble
        setMessages(prev => prev.map(m => m.id === action.msgId ? { ...m, text: resultMsg, status: 'sent' } : m));

        // Persist
        if (currentUser && !isTemporaryMode && currentChatId) {
             storeMessage(currentUser.uid, currentChatId, {
                id: action.msgId,
                text: resultMsg,
                sender: 'ai',
                timestamp: new Date(),
                status: 'sent'
             });
        }
        
        setPendingDriveAction(null);
    };

    const executePendingCalendarAction = async (token: string, action: {action: string, params: any, msgId: string}) => {
        setMessages(prev => prev.map(m => m.id === action.msgId ? { ...m, text: "Access granted. Accessing Calendar... 📅", status: 'sent' } : m));
        setMessages(prev => prev.filter(m => m.text !== 'CONNECT_CALENDAR_ACTION'));

        let resultMsg = "";

        if (action.action === 'list_events') {
            const res = await listEvents(token, action.params.timeMin, action.params.timeMax);
            if (res.success && res.events) {
                if (res.events.length === 0) {
                    resultMsg = "You have no events scheduled for this period.";
                } else {
                    resultMsg = `### 📅 Upcoming Events:\n\n` + 
                        res.events.map(e => {
                            const time = e.start.dateTime ? new Date(e.start.dateTime).toLocaleString() : 'All Day';
                            return `* **${e.summary}**\n  * 🕒 ${time}\n  * [View Event](${e.htmlLink})`;
                        }).join('\n');
                }
            } else {
                if (res.message === 'UNAUTHENTICATED') resultMsg = "Session expired. Please reconnect Calendar.";
                else resultMsg = `Failed to fetch events: ${res.message}`;
            }
        } else if (action.action === 'create_event') {
            const res = await createEvent(token, {
                summary: action.params.summary,
                description: action.params.description,
                location: action.params.location,
                start: action.params.start,
                end: action.params.end
            });

            if (res.success) {
                resultMsg = `✅ Event **${action.params.summary}** scheduled successfully!\n\n[View in Calendar](${res.eventLink})`;
            } else {
                if (res.message === 'UNAUTHENTICATED') resultMsg = "Session expired. Please reconnect Calendar.";
                else resultMsg = `Failed to create event: ${res.message}`;
            }
        }

        setMessages(prev => prev.map(m => m.id === action.msgId ? { ...m, text: resultMsg, status: 'sent' } : m));

        // Persist
        if (currentUser && !isTemporaryMode && currentChatId) {
             storeMessage(currentUser.uid, currentChatId, {
                id: action.msgId,
                text: resultMsg,
                sender: 'ai',
                timestamp: new Date(),
                status: 'sent'
             });
        }
        
        setPendingCalendarAction(null);
    };

    const handleSendMessage = async () => {
        if (!input.trim() && files.length === 0) return;

        // --- 1. SETUP CHAT ID IF NEEDED ---
        let activeChatId = currentChatId;

        if (currentUser && !isTemporaryMode && !activeChatId) {
            try {
                const newChat = await createNewChatSession(currentUser.uid, `New Chat ${new Date().toLocaleDateString()}`);
                if (newChat) {
                    setChatList(prev => [newChat, ...prev]);
                    activeChatId = newChat.id;
                    setCurrentChatId(newChat.id);
                } else {
                    if (chatList.length >= 10) {
                        showToast("Chat limit reached. Using Temporary Mode.");
                        setIsTemporaryMode(true);
                    }
                }
            } catch (e) {
                console.error("Auto-create chat failed", e);
            }
        }

        // --- 2. PREPARE USER MESSAGE ---
        const userMsg: Message = {
            id: Date.now().toString(),
            text: input,
            sender: 'user',
            timestamp: new Date(),
            attachments: [...files],
            status: 'sent'
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setFiles([]);
        setIsTyping(true);
        setPendingEmailAction(null);
        setPendingDriveAction(null);
        setPendingCalendarAction(null);


        // --- 3. PERSIST USER MESSAGE ---
        if (currentUser && !isTemporaryMode && activeChatId) {
            storeMessage(currentUser.uid, activeChatId, userMsg);
        }

        try {
            const history = messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
            const { stream } = await streamMessageToChat(history, userMsg.text, userMsg.attachments || [], null, currentUser);

            let fullText = '';
            const msgId = Date.now().toString() + '_ai';
            
            // Initial empty AI message
            setMessages(prev => [...prev, { id: msgId, text: '', sender: 'ai', timestamp: new Date(), status: 'streaming' }]);

            for await (const chunk of stream) {
                const chunkText = chunk.text || '';
                fullText += chunkText;
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: fullText, status: 'streaming' } : m));
            }
            
            // Tool Logic
            const jsonMatch = fullText.match(/\{[\s\S]*"tool_call"[\s\S]*\}/);
            let finalAiMessage: Message = { 
                id: msgId, 
                text: fullText, 
                sender: 'ai', 
                timestamp: new Date(), 
                status: 'sent' 
            };

            if (jsonMatch) {
                try {
                    const jsonStr = jsonMatch[0];
                    const toolData = JSON.parse(jsonStr);
                    const toolName = toolData.tool_call;
                    const cleanText = fullText.replace(jsonMatch[0], '').trim();
                    const displayText = cleanText || "Processing request...";

                    finalAiMessage = { ...finalAiMessage, text: displayText };
                    setMessages(prev => prev.map(m => m.id === msgId ? finalAiMessage : m));

                    if (toolName === 'generate_image') {
                        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: "Generating your imagination 🖼..." } : m));
                        const imgUrl = await generateImage(toolData.prompt);
                        
                        finalAiMessage = {
                            ...finalAiMessage,
                            text: cleanText || `Here is the image for: "${toolData.prompt}"`,
                            generatedImage: imgUrl ? { prompt: toolData.prompt, url: imgUrl } : undefined,
                        };
                        setMessages(prev => prev.map(m => m.id === msgId ? finalAiMessage : m));

                    } else if (toolName === 'send_email') {
                         const { to, subject, body } = toolData;
                         const attachments = userMsg.attachments || [];
                         
                         if (!googleAccessToken) {
                             setPendingEmailAction({ to, subject, body, msgId, attachments });
                             finalAiMessage.text = cleanText + (currentUser?.connections?.gmail 
                                ? "\n\nSession expired. Please reconnect Gmail below to send."
                                : "\n\nI need access to your Gmail to send this. Please connect your account below.");
                             
                             setMessages(prev => prev.map(m => m.id === msgId ? finalAiMessage : m));
                             setMessages(prev => [...prev, {
                                 id: Date.now().toString() + '_sys',
                                 text: 'CONNECT_GMAIL_ACTION',
                                 sender: 'ai',
                                 timestamp: new Date(),
                                 status: 'sent'
                             }]);
                             
                         } else {
                             // ... existing email send logic ...
                             const attText = attachments.length > 0 ? " (with attachments)" : "";
                             setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: `Sending email${attText}... 📧` } : m));
                             const result = await sendEmail(googleAccessToken, to, subject, body, attachments);
                             finalAiMessage.text = cleanText + `\n\n${result.success ? '✅' : '❌'} ${result.message}`;
                             setMessages(prev => prev.map(m => m.id === msgId ? finalAiMessage : m));
                             
                             if (!result.success && (result.message.includes('Authentication failed') || result.message.includes('UNAUTHENTICATED'))) {
                                 setPendingEmailAction({ to, subject, body, msgId, attachments });
                                 setMessages(prev => [...prev, { id: Date.now().toString() + '_sys', text: 'CONNECT_GMAIL_ACTION', sender: 'ai', timestamp: new Date(), status: 'sent' }]);
                             }
                         }

                    } else if (toolName === 'drive_action') {
                        if (!driveAccessToken) {
                             setPendingDriveAction({ action: toolData.action, params: toolData, msgId });
                             finalAiMessage.text = cleanText + (currentUser?.connections?.drive
                                ? "\n\nSession expired. Please reconnect Google Drive."
                                : "\n\nI need access to your Google Drive to do this. Please connect your account below.");
                             
                             setMessages(prev => prev.map(m => m.id === msgId ? finalAiMessage : m));
                             setMessages(prev => [...prev, {
                                 id: Date.now().toString() + '_sys',
                                 text: 'CONNECT_DRIVE_ACTION',
                                 sender: 'ai',
                                 timestamp: new Date(),
                                 status: 'sent'
                             }]);
                        } else {
                             // Execute immediately
                             setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: "Processing Google Drive request... 📂" } : m));
                             await executePendingDriveAction(driveAccessToken, { action: toolData.action, params: toolData, msgId });
                             // executePendingDriveAction handles final message update
                             return; // Skip default persistence as executePendingDriveAction handles it
                        }
                    } else if (toolName === 'calendar_action') {
                        if (!calendarAccessToken) {
                            setPendingCalendarAction({ action: toolData.action, params: toolData, msgId });
                            finalAiMessage.text = cleanText + (currentUser?.connections?.calendar
                                ? "\n\nSession expired. Please reconnect Google Calendar."
                                : "\n\nI need access to your Google Calendar to do this. Please connect your account below.");
                            
                            setMessages(prev => prev.map(m => m.id === msgId ? finalAiMessage : m));
                            setMessages(prev => [...prev, {
                                id: Date.now().toString() + '_sys',
                                text: 'CONNECT_CALENDAR_ACTION',
                                sender: 'ai',
                                timestamp: new Date(),
                                status: 'sent'
                            }]);
                        } else {
                            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: "Accessing Calendar... 📅" } : m));
                            await executePendingCalendarAction(calendarAccessToken, { action: toolData.action, params: toolData, msgId });
                            return;
                        }
                    }

                } catch (e) {
                    console.error("Tool Error", e);
                }
            } else {
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent' } : m));
            }

            // --- 4. PERSIST AI MESSAGE ---
            if (currentUser && !isTemporaryMode && activeChatId) {
                storeMessage(currentUser.uid, activeChatId, finalAiMessage);
            }

        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now().toString(), text: "Sorry, something went wrong.", sender: 'ai', timestamp: new Date(), status: 'sent' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files).map((file: File) => {
                return new Promise<FileAttachment>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve({ name: file.name, base64, mimeType: file.type });
                    };
                    reader.readAsDataURL(file);
                });
            });

            Promise.all(newFiles).then(attachments => {
                setFiles(prev => [...prev, ...attachments]);
            });
        }
    };

    return (
        <div className="flex h-full w-full max-w-[1600px] mx-auto relative z-10 bg-[#F8FAFC]">
            {/* Live Call Interface Overlay */}
            <AnimatePresence>
                {isCallActive && (
                    <LiveCallInterface 
                        onClose={() => setIsCallActive(false)} 
                        userProfile={currentUser}
                    />
                )}
            </AnimatePresence>

            {/* Mobile Overlay */}
            <div 
                className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsSidebarOpen(false)}
            />

            {/* SIDEBAR */}
            <aside className={`absolute md:relative w-80 h-full bg-white/80 backdrop-blur-2xl border-r border-slate-200 z-40 transition-all duration-300 ease-in-out flex flex-col shadow-2xl md:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="h-20 flex items-center px-6 gap-3 border-b border-slate-100 justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={onBack}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-accent-500 flex items-center justify-center text-white shadow-sm">
                            <i className="ph-bold ph-brain text-xl"></i>
                        </div>
                        <h1 className="font-bold text-xl tracking-tight text-slate-800">Aikon<span className="text-brand-600">Ai</span></h1>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-800 transition"><i className="ph-bold ph-x text-xl"></i></button>
                </div>

                <div className="p-4">
                    <button 
                        onClick={currentUser ? handleCreateNewChat : handleNewConversationGuest} 
                        className="w-full py-3.5 px-4 bg-slate-900 hover:bg-brand-600 text-white rounded-xl shadow-lg shadow-slate-900/10 hover:shadow-brand-600/30 transition-all duration-300 flex items-center justify-between group transform hover:-translate-y-0.5 cursor-pointer"
                    >
                        <div className="flex items-center gap-3">
                            <i className="ph-bold ph-plus-circle text-xl"></i>
                            <span className="font-semibold text-sm">New Conversation</span>
                        </div>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-2">
                    <div className="mb-4">
                        <div className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">History</div>
                        {currentUser ? (
                            chatList.length === 0 ? (
                                <p className="px-3 text-sm text-slate-400 italic">No chat history.</p>
                            ) : (
                                <div className="space-y-1">
                                    {chatList.map((chat) => (
                                        <div 
                                            key={chat.id} 
                                            onClick={() => handleLoadChat(chat.id)}
                                            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${currentChatId === chat.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <i className={`ph-duotone ${currentChatId === chat.id ? 'ph-chat-circle-dots text-brand-500' : 'ph-chat-circle text-slate-400'}`}></i>
                                                <span className="truncate">{chat.title}</span>
                                            </div>
                                            <button 
                                                onClick={(e) => handleDeleteChat(e, chat.id)}
                                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity p-1"
                                                title="Delete Chat"
                                            >
                                                <i className="ph-bold ph-trash"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            <p className="px-3 text-sm text-slate-400 italic">Sign in to view history.</p>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-white/50 backdrop-blur-sm">
                    <nav className="space-y-1 mb-4">
                        <button onClick={onBack} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors group cursor-pointer">
                            <i className="ph-duotone ph-house group-hover:text-brand-600"></i> Back to Home
                        </button>
                    </nav>
                    <div onClick={onProfile} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/80 transition cursor-pointer group border border-transparent hover:border-slate-100">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-accent-500 p-0.5 shadow-sm group-hover:scale-105 transition overflow-hidden">
                                {currentUser?.photoURL ? (
                                    <img src={currentUser.photoURL.startsWith('http') || currentUser.photoURL.startsWith('data:') ? currentUser.photoURL : `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=random`} alt="Profile" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center font-bold text-brand-700 text-sm">
                                        {currentUser?.displayName?.charAt(0) || 'G'}
                                    </div>
                                )}
                            </div>
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-slate-800 truncate">{currentUser?.displayName || 'Guest'}</div>
                            <div className="text-xs text-slate-500 truncate">{currentUser ? 'Pro Plan Active' : 'Sign in to sync'}</div>
                        </div>
                        <i className="ph-bold ph-gear text-slate-400 group-hover:text-brand-600"></i>
                    </div>
                </div>
            </aside>

            {/* MAIN AREA */}
            <main className="flex-1 flex flex-col h-full relative bg-[#F8FAFC]">
                {/* Interactive Background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                     <div className="soft-blob w-[500px] h-[500px] bg-indigo-300 top-[-20%] left-[-10%] mix-blend-multiply opacity-30"></div>
                     <div className="soft-blob w-[400px] h-[400px] bg-pink-300 bottom-[-10%] right-[-5%] mix-blend-multiply opacity-30"></div>
                </div>

                {/* Top Bar */}
                <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-slate-200/50 bg-white/60 backdrop-blur-md z-20">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                            <i className="ph-bold ph-list text-xl"></i>
                        </button>
                        <div className="relative group">
                            <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm hover:border-brand-400 transition-colors">
                                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-brand-500 to-accent-500"></span>
                                <span className="text-sm font-semibold text-slate-700">Aikon V1</span>
                            </button>
                        </div>
                    </div>
                    
                    {currentUser && (
                        <div className="flex items-center gap-2">
                             <label className="flex items-center gap-2 cursor-pointer group">
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        checked={isTemporaryMode} 
                                        onChange={() => {
                                            if (!isTemporaryMode) {
                                                // Switching TO temp mode
                                                setMessages([]); // Clear view for fresh start
                                                setCurrentChatId(null);
                                            } else {
                                                // Switching BACK from temp mode
                                                // Reload latest chat if exists
                                                if (chatList.length > 0) handleLoadChat(chatList[0].id);
                                            }
                                            setIsTemporaryMode(!isTemporaryMode);
                                        }} 
                                        className="sr-only peer" 
                                    />
                                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                </div>
                                <span className={`text-xs font-semibold ${isTemporaryMode ? 'text-amber-600' : 'text-slate-400 group-hover:text-slate-600'} transition-colors`}>Temporary Chat</span>
                            </label>
                        </div>
                    )}
                </header>

                {/* Chat Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth pb-32 relative z-10">
                    {isLoadingHistory ? (
                        <div className="flex justify-center mt-20">
                            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="max-w-3xl mx-auto mt-10 md:mt-20 flex flex-col items-center animate-slide-up">
                            <div className="relative mb-8 group">
                                <div className="absolute -inset-4 bg-gradient-to-tr from-brand-400 to-accent-400 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition duration-500"></div>
                                <div className="relative w-24 h-24 bg-white rounded-3xl flex items-center justify-center text-4xl shadow-xl border border-slate-100">
                                    <span className="bg-gradient-to-br from-brand-600 to-accent-600 bg-clip-text text-transparent font-bold">Ai</span>
                                </div>
                            </div>
                            <h2 className="text-3xl md:text-5xl font-heading font-bold text-slate-800 mb-4 text-center">Namaste, <span className="bg-gradient-to-r from-brand-600 to-accent-600 bg-clip-text text-transparent">{currentUser?.displayName || 'Friend'}</span> 👋</h2>
                            <p className="text-lg text-slate-500 text-center max-w-xl mb-10 leading-relaxed">
                                {isTemporaryMode ? (
                                    <span className="text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-full text-sm border border-amber-100"><i className="ph-bold ph-warning-circle"></i> Temporary Mode: Chats are not saved.</span>
                                ) : (
                                    "I'm Aikon, your intelligent companion. I can code, create art, send emails, manage your Drive files, schedule your Calendar events, and help you build the future."
                                )}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full px-2">
                                {[
                                    { icon: 'ph-envelope-simple', color: 'text-red-500', title: 'Gmail Assistant', desc: 'Send emails instantly.', prompt: 'Send an email to boss@company.com saying I will be late.' },
                                    { icon: 'ph-google-drive-logo', color: 'text-blue-500', title: 'Drive Manager', desc: 'List & Create files.', prompt: 'Create a file named "Ideas.txt" in my Drive with some startup ideas.' },
                                    { icon: 'ph-calendar-blank', color: 'text-orange-500', title: 'Calendar', desc: 'Schedule & view events.', prompt: 'Schedule a meeting with Team tomorrow at 2 PM.' },
                                    { icon: 'ph-paint-brush-broad', color: 'text-accent-500', title: 'Visual Creation', desc: 'Generate stunning AI art.', prompt: 'Create a futuristic image of a temple on Mars.' },
                                ].map((card, idx) => (
                                    <button key={idx} onClick={() => { setInput(card.prompt); }} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-400 hover:-translate-y-1 transition-all text-left group">
                                        <div className="flex items-start justify-between mb-2">
                                            <i className={`ph-duotone ${card.icon} text-2xl ${card.color} group-hover:scale-110 transition`}></i>
                                            <i className="ph-bold ph-arrow-right -rotate-45 text-slate-300 group-hover:text-brand-500"></i>
                                        </div>
                                        <div className="font-semibold text-slate-700 mb-1">{card.title}</div>
                                        <div className="text-xs text-slate-500">{card.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-8">
                            {messages.map((msg) => {
                                if (msg.text === 'CONNECT_GMAIL_ACTION') {
                                    return (
                                        <div key={msg.id} className="flex justify-start gap-4 animate-slide-up">
                                            <div className="flex-shrink-0 mt-1">
                                                <div className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-brand-600 shadow-sm">
                                                    <i className="ph-bold ph-brain text-lg"></i>
                                                </div>
                                            </div>
                                            <div className="bg-white border border-red-100 p-6 rounded-2xl shadow-sm max-w-md">
                                                <div className="flex items-center gap-3 mb-3 text-red-600 font-bold">
                                                    <i className="ph-fill ph-warning-circle text-xl"></i>
                                                    <span>Permission Required</span>
                                                </div>
                                                <p className="text-slate-600 text-sm mb-4">
                                                    {currentUser?.connections?.gmail 
                                                        ? "Your Gmail session has expired. Please reconnect to send this email."
                                                        : "To send emails on your behalf, I need your permission to access Gmail. This is a one-time setup."}
                                                </p>
                                                <button 
                                                    onClick={handleConnectGmail}
                                                    className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold shadow-md transition-all flex items-center justify-center gap-2"
                                                >
                                                    <i className="ph-bold ph-google-logo"></i> {currentUser?.connections?.gmail ? "Reconnect Gmail" : "Connect Gmail"}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }
                                if (msg.text === 'CONNECT_DRIVE_ACTION') {
                                    return (
                                         <div key={msg.id} className="flex justify-start gap-4 animate-slide-up">
                                            <div className="flex-shrink-0 mt-1">
                                                <div className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-brand-600 shadow-sm">
                                                    <i className="ph-bold ph-brain text-lg"></i>
                                                </div>
                                            </div>
                                            <div className="bg-white border border-blue-100 p-6 rounded-2xl shadow-sm max-w-md">
                                                <div className="flex items-center gap-3 mb-3 text-blue-600 font-bold">
                                                    <i className="ph-fill ph-warning-circle text-xl"></i>
                                                    <span>Permission Required</span>
                                                </div>
                                                <p className="text-slate-600 text-sm mb-4">
                                                    {currentUser?.connections?.drive 
                                                        ? "Your Google Drive session has expired. Please reconnect."
                                                        : "To manage files on your behalf, I need your permission to access Google Drive."}
                                                </p>
                                                <button 
                                                    onClick={handleConnectDrive}
                                                    className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold shadow-md transition-all flex items-center justify-center gap-2"
                                                >
                                                    <i className="ph-bold ph-google-drive-logo"></i> {currentUser?.connections?.drive ? "Reconnect Drive" : "Connect Drive"}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }
                                if (msg.text === 'CONNECT_CALENDAR_ACTION') {
                                    return (
                                         <div key={msg.id} className="flex justify-start gap-4 animate-slide-up">
                                            <div className="flex-shrink-0 mt-1">
                                                <div className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-brand-600 shadow-sm">
                                                    <i className="ph-bold ph-brain text-lg"></i>
                                                </div>
                                            </div>
                                            <div className="bg-white border border-orange-100 p-6 rounded-2xl shadow-sm max-w-md">
                                                <div className="flex items-center gap-3 mb-3 text-orange-600 font-bold">
                                                    <i className="ph-fill ph-warning-circle text-xl"></i>
                                                    <span>Permission Required</span>
                                                </div>
                                                <p className="text-slate-600 text-sm mb-4">
                                                    {currentUser?.connections?.calendar 
                                                        ? "Your Google Calendar session has expired. Please reconnect."
                                                        : "To manage events on your behalf, I need your permission to access Google Calendar."}
                                                </p>
                                                <button 
                                                    onClick={handleConnectCalendar}
                                                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold shadow-md transition-all flex items-center justify-center gap-2"
                                                >
                                                    <i className="ph-bold ph-calendar-blank"></i> {currentUser?.connections?.calendar ? "Reconnect Calendar" : "Connect Calendar"}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }
                                return <MessageBubble key={msg.id} message={msg} />;
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    )}

                    <AnimatePresence>
                        {isTyping && (
                            <MotionDiv 
                                className="max-w-3xl mx-auto mt-4 pl-12"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.3, ease: "backIn" } }}
                            >
                                <div className="bg-white/50 border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm inline-flex items-center gap-3">
                                    <div className="flex gap-1.5">
                                        <span className="w-2 h-2 bg-brand-500 rounded-full animate-[bounce_1s_infinite]"></span>
                                        <span className="w-2 h-2 bg-brand-500 rounded-full animate-[bounce_1s_infinite_200ms]"></span>
                                        <span className="w-2 h-2 bg-brand-500 rounded-full animate-[bounce_1s_infinite_400ms]"></span>
                                    </div>
                                    <span className="text-xs text-brand-600 font-bold tracking-wide">Aikon is typing...</span>
                                </div>
                            </MotionDiv>
                        )}
                    </AnimatePresence>
                </div>

                {/* Input Area */}
                <div className="absolute bottom-0 left-0 w-full p-4 md:p-6 bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC] to-transparent z-30">
                    <div className="max-w-3xl mx-auto relative group">
                        {files.length > 0 && (
                            <div className="absolute -top-24 left-0 bg-white p-2 rounded-xl shadow-lg border border-slate-200 animate-scale-in flex gap-2">
                                {files.map((f, i) => (
                                    <div key={i} className="relative">
                                        <img src={`data:${f.mimeType};base64,${f.base64}`} className="h-20 w-20 object-cover rounded-lg border border-slate-100" />
                                        <p className="text-[10px] text-center mt-1 truncate max-w-[5rem]">{f.name}</p>
                                    </div>
                                ))}
                                <button onClick={() => setFiles([])} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition"><i className="ph-bold ph-x"></i></button>
                            </div>
                        )}

                        <div className="glass-input rounded-[28px] p-2 pr-2 flex items-end gap-2 relative">
                            <div className="flex items-center gap-1 mb-1 ml-2">
                                <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-brand-600 transition" title="Attach">
                                    <i className="ph-bold ph-plus"></i>
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                            </div>
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                                rows={1}
                                className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 placeholder-slate-400 py-3.5 px-2 resize-none max-h-32 text-[15px] leading-relaxed font-body"
                                placeholder={isTemporaryMode ? "Message Aikon (Temporary Mode)..." : "Message Aikon..."}
                            />
                            <div className="flex items-center gap-2 mb-1 mr-1">
                                <button onClick={() => setIsCallActive(true)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-brand-600 transition relative">
                                    <i className="ph-bold ph-phone-call text-lg"></i>
                                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
                                </button>
                                <button onClick={handleSendMessage} disabled={!input && files.length === 0} className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg hover:bg-brand-600 hover:scale-105 transition-all duration-300 disabled:opacity-50">
                                    <i className="ph-fill ph-paper-plane-right text-lg"></i>
                                </button>
                            </div>
                        </div>
                        <div className="text-center mt-2.5">
                            <span className="text-[10px] text-slate-400 font-medium">Aikon can make mistakes. Check important info.</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Toast */}
            {toastMessage && (
                <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 z-[200] animate-slide-down">
                    <i className="ph-fill ph-check-circle text-emerald-400"></i>
                    <span className="text-sm font-medium">{toastMessage}</span>
                </div>
            )}
        </div>
    );
};

export default AikonChatPage;
