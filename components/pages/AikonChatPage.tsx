
import React, { useState, useRef, useEffect } from 'react';
import { NavigationProps, FileAttachment, Message, WeatherData } from '../../types';
import { 
    streamMessageToChat, 
    aikonPersonaInstruction, 
    generateImage, 
    performGoogleSearch, 
    editImage, 
    generateVideo, 
    generateSpeech, 
    generateQRCode, 
    generateWebsiteCode, 
    executePythonCode 
} from '../../services/geminiService';
import { fetchWeather } from '../../services/weatherService';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { parseMarkdown, renderParagraph } from '../../utils/markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

const MotionDiv = motion.div as any;
const MotionButton = motion.button as any;
const MotionImg = motion.img as any;

// Helper function definitions to avoid import issues
function createBlob(data: Float32Array): any {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return {
    data: base64,
    mimeType: 'audio/pcm;rate=16000',
  };
}

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


const AikonChatPage: React.FC<NavigationProps> = ({ navigateTo }) => {
    const { currentUser } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [files, setFiles] = useState<FileAttachment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    // Image Viewer State
    const [viewingImage, setViewingImage] = useState<{ url: string, prompt: string } | null>(null);
    const [imageZoom, setImageZoom] = useState(1);
    
    // Theme State
    const [isDark, setIsDark] = useState(false);

    // Live State
    const [isLiveActive, setIsLiveActive] = useState(false);
    const [liveStatus, setLiveStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputAreaRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setIsDark(document.documentElement.classList.contains('dark'));
    }, []);

    const toggleTheme = () => {
        if (isDark) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
            setIsDark(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
            setIsDark(true);
        }
    };

    // Scroll to bottom on new message
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // Reset zoom when image closes
    useEffect(() => {
        if (!viewingImage) setImageZoom(1);
    }, [viewingImage]);

    // --- JSON PARSING HELPER ---
    const tryParseToolCall = (text: string): any | null => {
        try {
            // 1. Try direct parse
            return JSON.parse(text);
        } catch (e) {
            // 2. Try extracting from markdown block
            const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match) {
                try {
                    return JSON.parse(match[1]);
                } catch (e2) {
                    // ignore
                }
            }
            // 3. Try finding a JSON object pattern in raw text
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                try {
                    return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
                } catch (e3) {
                    // ignore
                }
            }
        }
        return null;
    };

    // --- TOOL EXECUTION LOGIC ---
    const executeTool = async (msgId: string, toolCall: any) => {
        const toolName = toolCall.tool_call;
        
        // Helper to update message with loading state text
        const updateStatus = (text: string) => {
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: text, segments: undefined } : m));
        };

        // Helper to append result to message
        const updateResult = (updates: Partial<Message>) => {
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, ...updates, status: 'sent' } : m));
        };

        try {
            switch (toolName) {
                case 'generate_image':
                    updateStatus('Generating your Imagination 🖼.....');
                    const imgUrl = await generateImage(toolCall.prompt);
                    if (imgUrl) {
                        updateResult({ 
                            text: `Generated: ${toolCall.prompt}`,
                            generatedImage: { prompt: toolCall.prompt, url: imgUrl } 
                        });
                    } else {
                        updateStatus('Sorry, image generation failed.');
                    }
                    break;
                
                case 'edit_image':
                    // We need a source image. In Aikon's flow, this implies the user attached an image 
                    // and asked to edit it. So we look at the 'files' state from the time the message was sent.
                    // However, 'files' state is cleared after send. We need to rely on the fact that
                    // the executeTool is running in response to the CURRENT message context.
                    // IMPORTANT: For this to work, the 'editImage' service needs the file content.
                    // We assume the MOST RECENT user message has the attachment.
                    const lastUserMsg = messages.filter(m => m.sender === 'user').pop();
                    const sourceImage = lastUserMsg?.attachments?.find(f => f.mimeType.startsWith('image/'));

                    if (!sourceImage) {
                         updateStatus('I need an image to edit. Please upload one first.');
                         return;
                    }

                    updateStatus('Applying your edits 🖌....');
                    const editedImgUrl = await editImage(sourceImage, toolCall.instruction || toolCall.prompt); // Handle varied arg names
                     if (editedImgUrl) {
                        updateResult({ 
                            text: `Edited image based on: ${toolCall.instruction || toolCall.prompt}`,
                            generatedImage: { prompt: toolCall.instruction || toolCall.prompt, url: editedImgUrl } 
                        });
                    } else {
                        updateStatus('Sorry, image editing failed.');
                    }
                    break;

                case 'google_search':
                    updateStatus('Searching the live web 🌐.....');
                    const searchRes = await performGoogleSearch(toolCall.query);
                    updateResult({ 
                        text: searchRes.text || "Found some results:",
                        sources: searchRes.sources 
                    });
                    break;

                case 'generate_qr_code':
                    updateStatus('Creating QR Code 🏁.....');
                    const qrUrl = await generateQRCode(toolCall.text);
                    updateResult({
                        text: 'Here is your QR Code:',
                        generatedQRCode: { text: toolCall.text, dataUrl: qrUrl }
                    });
                    break;

                case 'generate_website':
                    updateStatus('Coding your website 💻.....');
                    const code = await generateWebsiteCode(toolCall.topic, toolCall.style, toolCall.features);
                    updateResult({
                        text: `I've designed a ${toolCall.style} website for "${toolCall.topic}".`,
                        generatedWebsite: { topic: toolCall.topic, htmlContent: code }
                    });
                    break;

                case 'execute_python_code':
                    updateStatus('Running Python script 🐍.....');
                    const output = await executePythonCode(toolCall.code);
                    updateResult({
                        text: `Executed Code:\n\`\`\`python\n${toolCall.code}\n\`\`\`\n\n**Output:**\n\`\`\`\n${output}\n\`\`\``,
                        segments: parseMarkdown(`Executed Code:\n\`\`\`python\n${toolCall.code}\n\`\`\`\n\n**Output:**\n\`\`\`\n${output}\n\`\`\``)
                    });
                    break;
                
                case 'get_weather':
                    updateStatus('Checking the forecast ☁️.....');
                    const weather = await fetchWeather(toolCall.city);
                    if ('error' in weather) {
                        updateStatus(weather.error);
                    } else {
                         updateResult({
                             text: `Current weather in ${weather.city}:`,
                             weatherData: weather as WeatherData
                         });
                    }
                    break;

                case 'text_to_speech':
                     updateStatus('Synthesizing voice 🗣️.....');
                     const audioData = await generateSpeech(toolCall.text);
                     if (audioData) {
                         updateResult({
                             text: toolCall.text,
                             audioUrl: `data:audio/mp3;base64,${audioData}`
                         });
                     } else {
                         updateStatus('Failed to generate speech.');
                     }
                     break;

                default:
                    // If unknown tool, just show the JSON (fallback)
                    updateStatus(`Tool call: ${JSON.stringify(toolCall)}`);
            }
        } catch (e) {
            console.error("Tool execution error:", e);
            updateStatus("An error occurred while performing the action.");
        }
    };


    const handleSendMessage = async (text: string = input) => {
        if (!text.trim() && files.length === 0) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: text,
            sender: 'user',
            timestamp: new Date(),
            status: 'sent',
            attachments: [...files]
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setFiles([]);
        setIsLoading(true);

        try {
            const history = messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
            const { stream } = await streamMessageToChat(history, userMsg.text, userMsg.attachments || [], null, currentUser, undefined, aikonPersonaInstruction);
            
            const msgId = Date.now().toString();
            setMessages(prev => [...prev, { id: msgId, text: '', sender: 'ai', timestamp: new Date(), status: 'streaming' }]);

            let fullText = '';
            for await (const chunk of stream) {
                const chunkText = chunk.text || '';
                fullText += chunkText;
                // Only update text while streaming, don't parse markdown continuously to save perf and avoid flicker
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: fullText } : m));
            }
            
            // Post-stream: Check for Tool Call JSON
            const toolCall = tryParseToolCall(fullText);
            if (toolCall && toolCall.tool_call) {
                // It is a tool call! Execute it.
                await executeTool(msgId, toolCall);
            } else {
                // Standard text response, parse markdown finally
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent', segments: parseMarkdown(fullText) } : m));
            }

        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { id: Date.now().toString(), text: "Sorry, I encountered an error connecting to the brain.", sender: 'ai', timestamp: new Date(), status: 'sent' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            Array.from(e.target.files).forEach((file: File) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    setFiles(prev => [...prev, { name: file.name, base64: base64, mimeType: file.type }]);
                };
                reader.readAsDataURL(file);
            });
            e.target.value = '';
        }
    };

    const handleDownloadImage = () => {
        if (!viewingImage) return;
        const a = document.createElement('a');
        a.href = viewingImage.url;
        a.download = `aikon-generated-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleTriggerEdit = () => {
        if (!viewingImage) return;
        
        // Convert the current URL (base64) into a FileAttachment format
        // Data URL format: data:image/png;base64,....
        const [meta, base64] = viewingImage.url.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        
        const newFile: FileAttachment = {
            name: 'edited-image-source.png',
            base64: base64,
            mimeType: mimeType
        };

        // Add to files
        setFiles([newFile]);
        
        // Close modal
        setViewingImage(null);
        setImageZoom(1);

        // Focus input
        setTimeout(() => {
            inputAreaRef.current?.focus();
        }, 100);
    };

    const toggleLive = async () => {
        if (isLiveActive) {
            setIsLiveActive(false);
            audioContextRef.current?.close();
            sessionPromiseRef.current = null;
            return;
        }

        setIsLiveActive(true);
        setLiveStatus('connecting');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContextRef.current = new AudioContext({ sampleRate: 24000 });
            const inputCtx = new AudioContext({ sampleRate: 16000 });
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: { 
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
                    systemInstruction: aikonPersonaInstruction
                },
                callbacks: {
                    onopen: () => {
                        setLiveStatus('connected');
                        const source = inputCtx.createMediaStreamSource(stream);
                        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                        processor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmData = createBlob(inputData);
                            sessionPromise.then(sess => sess.sendRealtimeInput({ media: pcmData }));
                        };
                        source.connect(processor);
                        processor.connect(inputCtx.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                         const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                         if (audioData) {
                             const buffer = await decodeAudioData(decode(audioData), audioContextRef.current!, 24000, 1);
                             const source = audioContextRef.current!.createBufferSource();
                             source.buffer = buffer;
                             source.connect(audioContextRef.current!.destination);
                             source.start();
                         }
                    }
                }
            });
            sessionPromiseRef.current = sessionPromise;
        } catch (e) {
            console.error("Live Error", e);
            setLiveStatus('error');
            setTimeout(() => setIsLiveActive(false), 2000);
        }
    };

    // Determine greeting name
    const greetingName = currentUser?.displayName && currentUser.displayName !== 'Guest' 
        ? currentUser.displayName.split(' ')[0] 
        : 'Friend';

    return (
        <div className="flex h-screen w-full bg-slate-50 dark:bg-[#050505] text-slate-800 dark:text-gray-100 font-sans overflow-hidden chat-gradient-bg transition-colors duration-300">
            
            {/* Image Modal */}
            <AnimatePresence>
                {viewingImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => setViewingImage(null)}
                    >
                        {/* Toolbar */}
                        <motion.div 
                            initial={{ y: -50 }}
                            animate={{ y: 0 }}
                            className="absolute top-4 left-0 right-0 flex justify-center gap-4 z-20 pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button onClick={() => setImageZoom(z => Math.max(0.5, z - 0.5))} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md">
                                <i className="ph-bold ph-minus"></i>
                            </button>
                            <button onClick={() => setImageZoom(z => Math.min(3, z + 0.5))} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md">
                                <i className="ph-bold ph-plus"></i>
                            </button>
                            <button onClick={handleDownloadImage} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white font-medium flex items-center gap-2 backdrop-blur-md">
                                <i className="ph-bold ph-download-simple"></i> Download
                            </button>
                            <button 
                                onClick={handleTriggerEdit}
                                className="px-4 py-2 bg-brand-primary hover:bg-brand-600 rounded-full text-white font-medium flex items-center gap-2 shadow-lg shadow-brand-primary/20"
                            >
                                <i className="ph-bold ph-paint-brush"></i> Edit Image
                            </button>
                            <button onClick={() => setViewingImage(null)} className="p-3 bg-white/10 hover:bg-red-500/20 hover:text-red-500 rounded-full text-white backdrop-blur-md">
                                <i className="ph-bold ph-x"></i>
                            </button>
                        </motion.div>

                        <div className="w-full h-full flex items-center justify-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <MotionImg 
                                src={viewingImage.url} 
                                alt="Zoomed View"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                animate={{ scale: imageZoom }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                drag
                                dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }}
                            />
                        </div>
                        <div className="absolute bottom-6 bg-black/50 px-4 py-2 rounded-full text-white text-sm font-medium backdrop-blur-md">
                            {viewingImage.prompt}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sidebar (Overlay on Mobile, Relative on Desktop) */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="absolute inset-0 bg-black/30 backdrop-blur-sm z-50 md:hidden"
                        />
                        <motion.div 
                            initial={{ x: -300 }}
                            animate={{ x: 0 }}
                            exit={{ x: -300 }}
                            className="absolute inset-y-0 left-0 z-50 w-72 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-r border-gray-200 dark:border-white/5 shadow-2xl flex flex-col md:relative md:bg-white/80 md:dark:bg-[#0a0a0a]/50 md:shadow-none"
                        >
                            <div className="p-6 pt-safe">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white shadow-md">
                                        <i className="ph-bold ph-brain"></i>
                                    </div>
                                    <span className="font-heading font-bold text-xl tracking-tight text-slate-800 dark:text-white">AikonAi</span>
                                </div>
                                <button 
                                    onClick={() => { setIsSidebarOpen(false); setMessages([]); }}
                                    className="w-full py-3 bg-brand-primary text-white rounded-xl font-semibold shadow-lg shadow-brand-primary/25 hover:shadow-brand-primary/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                                >
                                    <i className="ph-bold ph-plus"></i> New Chat
                                </button>
                            </div>
                            <div className="flex-grow px-4 overflow-y-auto space-y-1">
                                <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Workspace</p>
                                {/* Workspace Links */}
                                <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:text-brand-primary dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors group">
                                    <i className="ph-duotone ph-image group-hover:text-brand-accent"></i> Imagine Studio
                                </a>
                                <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:text-brand-primary dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors group">
                                    <i className="ph-duotone ph-code group-hover:text-green-500"></i> Dev Sandbox
                                </a>
                            </div>
                            <div className="p-4 border-t border-gray-100 dark:border-white/5 pb-safe">
                                <div className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-accent to-purple-500 text-white flex items-center justify-center font-bold text-xs">
                                        {currentUser?.displayName?.[0] || 'G'}
                                    </div>
                                    <div className="flex-grow overflow-hidden">
                                        <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{currentUser?.displayName || 'Guest User'}</p>
                                        <p className="text-xs text-slate-500 dark:text-gray-400">Free Plan</p>
                                    </div>
                                    <button onClick={toggleTheme} className="text-slate-400 hover:text-brand-primary transition p-2">
                                        <i className={`ph-bold ${isDark ? 'ph-sun' : 'ph-moon'}`}></i>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full relative w-full">
                
                {/* Header */}
                <header className="flex-none h-14 md:h-20 flex items-center justify-between px-4 md:px-6 z-40 bg-white/95 dark:bg-[#050505]/95 backdrop-blur-xl border-b border-gray-100 dark:border-white/5 md:bg-transparent md:dark:bg-transparent md:border-none md:absolute md:top-0 md:w-full">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-700 dark:text-gray-200">
                            <i className="ph-bold ph-list text-xl"></i>
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100/50 dark:bg-white/5 md:bg-white/60 md:dark:bg-black/40 md:backdrop-blur-md rounded-full border border-gray-200/50 dark:border-white/5 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-brand-primary relative">
                                <span className="absolute inset-0 rounded-full bg-brand-primary animate-ping opacity-75"></span>
                            </span>
                            <span className="text-xs md:text-sm font-semibold text-slate-700 dark:text-gray-200">Model: Aikon V1</span>
                            <i className="ph-bold ph-caret-down text-xs text-slate-400"></i>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <AnimatePresence>
                            {isLiveActive && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-red-500 text-white rounded-full text-sm font-bold shadow-lg mr-2"
                                >
                                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                    {liveStatus === 'connecting' ? 'Connecting...' : 'Live On Air'}
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <button onClick={toggleLive} className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${isLiveActive ? 'bg-red-100 text-red-500 animate-pulse' : 'bg-gray-100 dark:bg-white/5 md:bg-white/60 md:dark:bg-black/40 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-gray-300 shadow-sm'}`}>
                            <i className={`ph-fill ${isLiveActive ? 'ph-phone-disconnect' : 'ph-phone-call'} text-lg`}></i>
                        </button>
                        <button onClick={() => navigateTo('home')} className="w-9 h-9 flex items-center justify-center bg-gray-100 dark:bg-white/5 md:bg-white/60 md:dark:bg-black/40 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-gray-300 rounded-full shadow-sm transition-all">
                            <i className="ph-bold ph-sign-out text-lg"></i>
                        </button>
                    </div>
                </header>

                {/* Chat Scroll Area */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto w-full relative">
                    <div className="min-h-full flex flex-col">
                        
                        {/* Desktop Spacer for floating header */}
                        <div className="hidden md:block h-20 flex-none"></div>

                        {/* Content Container */}
                        <div className="flex-1 px-4 md:px-0 pb-4 md:pb-40 pt-6 md:pt-0 max-w-3xl mx-auto w-full">
                            
                            {messages.length === 0 ? (
                                /* Welcome Screen */
                                <div className="flex flex-col items-center justify-center text-center py-8 md:py-12">
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="w-20 h-20 md:w-24 md:h-24 bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-2xl flex items-center justify-center mb-6 md:mb-8 ring-1 ring-gray-100 dark:ring-white/5"
                                    >
                                        <span className="font-heading font-bold text-3xl md:text-4xl gradient-text">Ai</span>
                                    </motion.div>
                                    <motion.h1 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 }}
                                        className="text-3xl md:text-5xl font-heading font-bold text-slate-900 dark:text-white mb-3 md:mb-4 px-4"
                                    >
                                        Namaste, <span className="gradient-text">{greetingName}</span> <span className="inline-block animate-wave origin-bottom-right">👋</span>
                                    </motion.h1>
                                    <motion.p 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="text-base md:text-lg text-slate-500 dark:text-gray-400 max-w-sm md:max-w-lg mb-8 md:mb-12 font-light px-6"
                                    >
                                        I'm Aikon, your intelligent companion. I can code, create art, and help you build the future.
                                    </motion.p>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl px-2">
                                        {[
                                            { icon: 'ph-code', text: "Generate a React Dashboard" },
                                            { icon: 'ph-paint-brush', text: "Design a modern logo" },
                                            { icon: 'ph-airplane-tilt', text: "Plan a trip to Kyoto" },
                                            { icon: 'ph-translate', text: "Translate English to Hindi" }
                                        ].map((prompt, i) => (
                                            <motion.button 
                                                key={i}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.3 + (i * 0.1) }}
                                                onClick={() => handleSendMessage(prompt.text)}
                                                className="p-4 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 hover:border-brand-primary/30 dark:hover:border-brand-primary/30 rounded-2xl text-left flex items-center gap-3 shadow-sm hover:shadow-md transition-all group active:scale-95"
                                            >
                                                <div className="p-2 bg-slate-50 dark:bg-white/10 rounded-lg text-brand-primary dark:text-brand-secondary group-hover:bg-brand-primary/10 transition-colors">
                                                    <i className={`ph-duotone ${prompt.icon} text-lg`}></i>
                                                </div>
                                                <span className="text-sm font-medium text-slate-700 dark:text-gray-200">{prompt.text}</span>
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                /* Messages List */
                                <div className="space-y-6 pb-4">
                                    {messages.map((msg, idx) => (
                                        <MotionDiv 
                                            key={msg.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`flex gap-3 md:gap-4 ${msg.sender === 'user' ? 'justify-end' : ''}`}
                                        >
                                            {msg.sender === 'ai' && (
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex-shrink-0 flex items-center justify-center text-white shadow-md mt-1">
                                                    <i className="ph-fill ph-sparkle text-xs"></i>
                                                </div>
                                            )}
                                            <div className={`max-w-[85%] md:max-w-[75%] p-3 md:p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                                msg.sender === 'user' 
                                                ? 'bg-brand-primary text-white rounded-tr-none shadow-[0_4px_15px_-3px_rgba(79,70,229,0.3)] dark:shadow-[0_4px_15px_-3px_rgba(79,70,229,0.1)]' 
                                                : 'bg-white dark:bg-[#151515] border border-gray-100 dark:border-white/5 text-slate-800 dark:text-gray-200 rounded-tl-none'
                                            }`}>
                                                {/* Attachments */}
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="flex gap-2 mb-3 flex-wrap">
                                                        {msg.attachments.map((f, i) => (
                                                            <div key={i} className="bg-black/10 dark:bg-white/10 px-2 py-1 rounded-md text-xs flex items-center gap-1">
                                                                <i className="ph-bold ph-file"></i> {f.name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Generated Image */}
                                                {msg.generatedImage && (
                                                    <div 
                                                        className="mb-3 rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-white/10 cursor-pointer hover:opacity-95 transition-opacity group relative"
                                                        onClick={() => setViewingImage({ url: msg.generatedImage!.url!, prompt: msg.generatedImage!.prompt })}
                                                    >
                                                        <img src={msg.generatedImage.url} alt={msg.generatedImage.prompt} className="w-full h-auto" />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                                                                <i className="ph-bold ph-magnifying-glass-plus text-xl"></i>
                                                            </div>
                                                        </div>
                                                        <div className="p-2 bg-gray-50 dark:bg-black/40 text-[10px] text-gray-500">
                                                            Generated: {msg.generatedImage.prompt}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Generated QR Code */}
                                                {msg.generatedQRCode && (
                                                    <div className="mb-3 flex justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-200">
                                                        <img src={msg.generatedQRCode.dataUrl} alt="QR Code" className="w-48 h-48" />
                                                    </div>
                                                )}
                                                
                                                {/* Generated Website Link */}
                                                {msg.generatedWebsite && (
                                                    <div className="mb-3 p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white"><i className="ph-bold ph-globe"></i></div>
                                                            <div>
                                                                <h4 className="font-bold">Website Ready</h4>
                                                                <p className="text-xs opacity-70">Topic: {msg.generatedWebsite.topic}</p>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                                                            onClick={() => {
                                                                const win = window.open('', '_blank');
                                                                if(win) {
                                                                    win.document.write(msg.generatedWebsite!.htmlContent);
                                                                    win.document.close();
                                                                }
                                                            }}
                                                        >
                                                            Open Preview
                                                        </button>
                                                    </div>
                                                )}
                                                
                                                {/* Audio Player */}
                                                {msg.audioUrl && (
                                                     <div className="mb-3 flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                                                        <button 
                                                            onClick={() => new Audio(msg.audioUrl).play()}
                                                            className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center hover:scale-110 transition-transform"
                                                        >
                                                            <i className="ph-fill ph-play"></i>
                                                        </button>
                                                        <div className="h-1 flex-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                            <div className="h-full w-1/3 bg-brand-primary"></div>
                                                        </div>
                                                        <span className="text-xs font-mono">Audio</span>
                                                     </div>
                                                )}

                                                {/* Text / Segments */}
                                                {msg.segments ? (
                                                    msg.segments.map((seg, i) => (
                                                        <div key={i} className={seg.type === 'code' ? 'my-3' : ''}>
                                                            {seg.type === 'code' ? (
                                                                <div className="relative group">
                                                                    <div className="absolute top-2 right-2 px-2 py-1 bg-white/10 rounded text-[10px] text-gray-300 font-mono">{seg.language}</div>
                                                                    <pre className="bg-[#1e1e2e] text-gray-300 p-3 rounded-xl overflow-x-auto text-xs font-mono border border-white/5 shadow-inner">
                                                                        <code className={`language-${seg.language}`}>{seg.content}</code>
                                                                    </pre>
                                                                </div>
                                                            ) : (
                                                                <div dangerouslySetInnerHTML={{ __html: renderParagraph(seg.content) }} className={`prose prose-sm ${msg.sender === 'user' ? 'prose-invert' : 'dark:prose-invert'}`} />
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p>{msg.text}</p>
                                                )}
                                            </div>
                                            {msg.sender === 'user' && (
                                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 flex-shrink-0 flex items-center justify-center text-gray-600 dark:text-gray-400 shadow-sm mt-1 overflow-hidden">
                                                    {currentUser?.photoURL ? <img src={currentUser.photoURL} alt="User" /> : <i className="ph-fill ph-user text-xs"></i>}
                                                </div>
                                            )}
                                        </MotionDiv>
                                    ))}
                                    {isLoading && (
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex-shrink-0 flex items-center justify-center text-white shadow-md">
                                                <i className="ph-fill ph-sparkle text-xs"></i>
                                            </div>
                                            <div className="bg-white dark:bg-[#151515] px-4 py-3 rounded-2xl rounded-tl-none border border-gray-100 dark:border-white/5 shadow-sm flex items-center gap-2">
                                                <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce"></div>
                                                <div className="w-2 h-2 bg-brand-secondary rounded-full animate-bounce delay-75"></div>
                                                <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce delay-150"></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Input Area */}
                <div className="flex-none md:absolute md:bottom-6 md:left-0 md:right-0 z-30 w-full">
                    {/* ... (Existing Input UI Code kept identical) ... */}
                    {/* Mobile Wrapper */}
                    <div className="md:hidden bg-white dark:bg-[#050505] border-t border-gray-100 dark:border-white/5 p-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                         {files.length > 0 && (
                            <div className="flex gap-2 mb-2 px-2 overflow-x-auto pb-1">
                                {files.map((f, i) => (
                                    <div key={i} className="flex-shrink-0 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 text-slate-700 dark:text-gray-300">
                                        <span className="font-bold text-brand-primary line-clamp-1 max-w-[80px]">{f.name}</span>
                                        <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500">
                                            <i className="ph-bold ph-x"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-3xl px-2 py-1.5">
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-brand-primary transition-colors">
                                <i className="ph-bold ph-plus text-lg"></i>
                            </button>
                            <input 
                                ref={inputAreaRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Message Aikon..."
                                className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-600 text-base h-10"
                                disabled={isLoading}
                            />
                             <button className="p-2 text-gray-400 hover:text-brand-primary transition-colors">
                                <i className="ph-bold ph-microphone text-lg"></i>
                            </button>
                            <button 
                                onClick={() => handleSendMessage()}
                                disabled={!input.trim() && files.length === 0}
                                className="w-9 h-9 bg-brand-primary text-white rounded-full flex items-center justify-center shadow-md disabled:opacity-50 disabled:shadow-none"
                            >
                                <i className="ph-bold ph-paper-plane-right"></i>
                            </button>
                        </div>
                    </div>

                    {/* Desktop Wrapper */}
                    <div className="hidden md:block max-w-3xl mx-auto px-4">
                        <motion.div 
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="bg-white/90 dark:bg-[#111]/90 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-brand-primary/5 dark:shadow-none border border-white/50 dark:border-white/10 p-2 pl-4 flex items-center gap-2 relative"
                        >
                            {/* Attachments Preview Desktop */}
                            {files.length > 0 && (
                                <div className="absolute -top-14 left-0 flex gap-2">
                                    {files.map((f, i) => (
                                        <div key={i} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 px-3 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg text-slate-700 dark:text-gray-300">
                                            <span className="font-bold text-brand-primary">FILE</span> {f.name}
                                            <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500">
                                                <i className="ph-bold ph-x"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-50 dark:hover:bg-white/5 rounded-full transition-colors">
                                <i className="ph-bold ph-plus text-xl"></i>
                            </button>
                            
                            <input
                                ref={inputAreaRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Message Aikon..."
                                className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-600 font-medium h-10"
                                disabled={isLoading}
                            />
                            
                            <button className="p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-50 dark:hover:bg-white/5 rounded-full transition-colors">
                                <i className="ph-bold ph-microphone text-xl"></i>
                            </button>
                            
                            <MotionButton 
                                onClick={() => handleSendMessage()}
                                disabled={!input.trim() && files.length === 0}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="w-10 h-10 bg-[#0F172A] dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center shadow-lg hover:shadow-xl disabled:opacity-50 disabled:shadow-none transition-all"
                            >
                                <i className="ph-bold ph-paper-plane-right"></i>
                            </MotionButton>
                        </motion.div>
                        <p className="text-center text-[10px] text-gray-400 dark:text-gray-600 mt-3 font-medium">
                            Aikon can make mistakes. Check important info.
                        </p>
                    </div>

                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        multiple 
                        onChange={handleFileChange} 
                    />
                </div>

            </div>
        </div>
    );
};

export default AikonChatPage;
