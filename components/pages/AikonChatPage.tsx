import React, { useState, useRef, useEffect } from 'react';
import { Message, FileAttachment } from '../../types';
import { streamMessageToChat, generateImage, generateQRCode, generateWebsiteCode, editImage, generateSpeech } from '../../services/geminiService';
import { sendEmail } from '../../services/emailService';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import MessageBubble from '../MessageBubble';
import LiveCallInterface from '../LiveCallInterface';

interface AikonChatPageProps {
    onBack: () => void;
    onProfile: () => void;
}

const MotionDiv = motion.div as any;

const AikonChatPage: React.FC<AikonChatPageProps> = ({ onBack, onProfile }) => {
    const { currentUser, googleAccessToken, connectGmail, disconnectGmail } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [files, setFiles] = useState<FileAttachment[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCallActive, setIsCallActive] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // State to handle pending actions
    const [pendingEmailAction, setPendingEmailAction] = useState<{to: string, subject: string, body: string, msgId: string} | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Auto-retry email sending when token becomes available
    useEffect(() => {
        if (googleAccessToken && pendingEmailAction) {
            executePendingEmail(googleAccessToken, pendingEmailAction);
        }
    }, [googleAccessToken, pendingEmailAction]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleConnectGmail = async () => {
        try {
            await connectGmail();
            showToast("Gmail Connected Successfully!");
        } catch (error) {
            console.error("Gmail Connection Failed", error);
            showToast("Failed to connect Gmail.");
        }
    };

    const executePendingEmail = async (token: string, action: {to: string, subject: string, body: string, msgId: string}) => {
        setMessages(prev => prev.map(m => m.id === action.msgId ? { ...m, text: m.text.replace("I need access to your Gmail to send this. Please connect your account below.", "Access granted. Sending email... 📧"), status: 'sent' } : m));
        
        // Remove the connect button message if it exists
        setMessages(prev => prev.filter(m => m.text !== 'CONNECT_GMAIL_ACTION'));

        const result = await sendEmail(token, action.to, action.subject, action.body);
                             
        if (result.success) {
            setMessages(prev => prev.map(m => m.id === action.msgId ? { 
                ...m, 
                text: `✅ Email sent successfully to ${action.to}.`, 
                status: 'sent' 
            } : m));
        } else {
             // Handle Auth Errors
             if (result.message.includes('insufficient authentication scopes') || result.message.includes('Authentication failed')) {
                disconnectGmail(); // Clear bad token so user can try connecting again
                setMessages(prev => prev.map(m => m.id === action.msgId ? { 
                    ...m, 
                    text: `❌ ${result.message}\n\nPlease try connecting Gmail again.`, 
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

    const handleSendMessage = async () => {
        if (!input.trim() && files.length === 0) return;

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
        setPendingEmailAction(null); // Clear previous pending actions

        try {
            const history = messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
            const { stream } = await streamMessageToChat(history, userMsg.text, userMsg.attachments || [], null, currentUser);

            let fullText = '';
            const msgId = Date.now().toString();
            
            // Initial empty AI message with 'streaming' status
            setMessages(prev => [...prev, { id: msgId, text: '', sender: 'ai', timestamp: new Date(), status: 'streaming' }]);

            for await (const chunk of stream) {
                const chunkText = chunk.text || '';
                fullText += chunkText;
                // Keep status as streaming while data arrives
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: fullText, status: 'streaming' } : m));
            }
            
            // Robust JSON Tool Call Extraction
            // We search for the *last* valid JSON object that looks like a tool call to avoid partial matches inside text
            const jsonMatch = fullText.match(/\{[\s\S]*"tool_call"[\s\S]*\}/);

            if (jsonMatch) {
                try {
                    const jsonStr = jsonMatch[0];
                    const toolData = JSON.parse(jsonStr);
                    const toolName = toolData.tool_call;

                    const cleanText = fullText.replace(jsonMatch[0], '').trim();
                    const displayText = cleanText || (toolName === 'send_email' ? "Processing your email request..." : "Generating content...");

                    setMessages(prev => prev.map(m => m.id === msgId ? { 
                        ...m, 
                        text: displayText, 
                        status: 'streaming' 
                    } : m));

                    if (toolName === 'generate_image') {
                        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: "Generating your imagination 🖼..." } : m));
                        try {
                            const imgUrl = await generateImage(toolData.prompt);
                            if (imgUrl) {
                                setMessages(prev => prev.map(m => m.id === msgId ? { 
                                    ...m, 
                                    text: cleanText || `Here is the image for: "${toolData.prompt}"`, 
                                    generatedImage: { prompt: toolData.prompt, url: imgUrl },
                                    status: 'sent'
                                } : m));
                            } else {
                                throw new Error("Image generation failed");
                            }
                        } catch (e) {
                           setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: "Sorry, I encountered an error generating the image.", status: 'sent' } : m));
                        }
                    } else if (toolName === 'send_email') {
                         const { to, subject, body } = toolData;
                         
                         if (!googleAccessToken) {
                             // Token missing, prompt user
                             // We save the msgId so we can update this specific bubble later
                             setPendingEmailAction({ to, subject, body, msgId });
                             
                             setMessages(prev => prev.map(m => m.id === msgId ? {
                                 ...m,
                                 text: cleanText + "\n\nI need access to your Gmail to send this. Please connect your account below.",
                                 status: 'sent',
                             } : m));
                             // We will inject a special "System" message with the button
                             setMessages(prev => [...prev, {
                                 id: Date.now().toString() + '_sys',
                                 text: 'CONNECT_GMAIL_ACTION', // Special flag to render component
                                 sender: 'ai',
                                 timestamp: new Date(),
                                 status: 'sent'
                             }]);
                             
                         } else {
                             // Token exists, send email
                             setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: "Sending email... 📧" } : m));
                             const result = await sendEmail(googleAccessToken, to, subject, body);
                             
                             if (result.success) {
                                 setMessages(prev => prev.map(m => m.id === msgId ? { 
                                     ...m, 
                                     text: cleanText + `\n\n✅ Email sent successfully to ${to}.`, 
                                     status: 'sent' 
                                 } : m));
                             } else {
                                 // Check for auth errors to offer reconnection
                                 if (result.message.includes('insufficient authentication scopes') || result.message.includes('Authentication failed')) {
                                     disconnectGmail();
                                     // Re-prompt for connection
                                     setPendingEmailAction({ to, subject, body, msgId });
                                     setMessages(prev => prev.map(m => m.id === msgId ? { 
                                        ...m, 
                                        text: cleanText + `\n\n❌ ${result.message}\n\nI need to refresh your Gmail permissions. Please connect again below.`, 
                                        status: 'sent' 
                                     } : m));
                                     setMessages(prev => [...prev, {
                                         id: Date.now().toString() + '_sys',
                                         text: 'CONNECT_GMAIL_ACTION',
                                         sender: 'ai',
                                         timestamp: new Date(),
                                         status: 'sent'
                                     }]);
                                 } else {
                                    setMessages(prev => prev.map(m => m.id === msgId ? { 
                                        ...m, 
                                        text: cleanText + `\n\n❌ ${result.message}`, 
                                        status: 'sent' 
                                    } : m));
                                 }
                             }
                         }
                    }

                } catch (e) {
                    console.error("Failed to parse tool call JSON", e);
                    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent' } : m));
                }
            } else {
                // Mark as sent when stream is totally done
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent' } : m));
            }

        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now().toString(), text: "Sorry, something went wrong.", sender: 'ai', timestamp: new Date(), status: 'sent' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                setFiles(prev => [...prev, { name: file.name, base64, mimeType: file.type }]);
            };
            reader.readAsDataURL(file);
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
                    <button onClick={() => { setMessages([]); setInput(''); }} className="w-full py-3.5 px-4 bg-slate-900 hover:bg-brand-600 text-white rounded-xl shadow-lg shadow-slate-900/10 hover:shadow-brand-600/30 transition-all duration-300 flex items-center justify-between group transform hover:-translate-y-0.5 cursor-pointer">
                        <div className="flex items-center gap-3">
                            <i className="ph-bold ph-plus-circle text-xl"></i>
                            <span className="font-semibold text-sm">New Conversation</span>
                        </div>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-white/20 px-2 py-0.5 rounded">⌘N</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
                    <nav className="space-y-1">
                        <button onClick={onBack} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors group cursor-pointer">
                            <i className="ph-duotone ph-house group-hover:text-brand-600"></i> Back to Home
                        </button>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-brand-700 bg-brand-50 rounded-lg border border-brand-100 transition-colors"><i className="ph-fill ph-chat-circle-dots"></i> Aikon Chat</a>
                        <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors group"><i className="ph-duotone ph-image group-hover:text-accent-500"></i> Imagine Studio</a>
                    </nav>
                </div>

                <div className="p-4 border-t border-slate-100 bg-white/50 backdrop-blur-sm">
                    <div onClick={onProfile} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/80 transition cursor-pointer group">
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
                            <div className="text-xs text-slate-500 truncate">Pro Plan Active</div>
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
                                <span className="text-sm font-semibold text-slate-700">Model: Aikon V1</span>
                                <i className="ph-bold ph-caret-down text-xs text-slate-400"></i>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Chat Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth pb-32 relative z-10">
                    {messages.length === 0 ? (
                        <div className="max-w-3xl mx-auto mt-10 md:mt-20 flex flex-col items-center animate-slide-up">
                            <div className="relative mb-8 group">
                                <div className="absolute -inset-4 bg-gradient-to-tr from-brand-400 to-accent-400 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition duration-500"></div>
                                <div className="relative w-24 h-24 bg-white rounded-3xl flex items-center justify-center text-4xl shadow-xl border border-slate-100">
                                    <span className="bg-gradient-to-br from-brand-600 to-accent-600 bg-clip-text text-transparent font-bold">Ai</span>
                                </div>
                            </div>
                            <h2 className="text-3xl md:text-5xl font-heading font-bold text-slate-800 mb-4 text-center">Namaste, <span className="bg-gradient-to-r from-brand-600 to-accent-600 bg-clip-text text-transparent">{currentUser?.displayName || 'Friend'}</span> 👋</h2>
                            <p className="text-lg text-slate-500 text-center max-w-xl mb-10 leading-relaxed">
                                I'm Aikon, your intelligent companion. I can code, create art, send emails, and help you build the future. <br /> <span className="text-sm font-medium text-brand-500">How can we innovate today?</span>
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full px-2">
                                {[
                                    { icon: 'ph-envelope-simple', color: 'text-red-500', title: 'Gmail Assistant', desc: 'Send emails instantly.', prompt: 'Send an email to boss@company.com saying I will be late.' },
                                    { icon: 'ph-code', color: 'text-emerald-500', title: 'Code Assistant', desc: 'Generate Python/JS scripts & debug.', prompt: 'Write a Python script to visualize stock market data.' },
                                    { icon: 'ph-paint-brush-broad', color: 'text-accent-500', title: 'Visual Creation', desc: 'Generate stunning AI art.', prompt: 'Create a futuristic image of a temple on Mars.' },
                                    { icon: 'ph-rocket-launch', color: 'text-blue-500', title: 'Strategic Planning', desc: 'Brainstorm ideas & roadmaps.', prompt: 'Help me plan a product launch for next week.' }
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
                                                    To send emails on your behalf, I need your permission to access Gmail. This is a one-time setup.
                                                </p>
                                                <button 
                                                    onClick={handleConnectGmail}
                                                    className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold shadow-md transition-all flex items-center justify-center gap-2"
                                                >
                                                    <i className="ph-bold ph-google-logo"></i> Connect Gmail
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
                                placeholder="Message Aikon..."
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