
import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { NavigationProps, FileAttachment, Message, Source, Task, ChatListItem, MessageSender, Workflow, WorkflowStep, CanvasFiles, UserProfile, VirtualFile, StructuredToolOutput, Persona, PresentationData, WordData, ExcelData, CodeExecutionHistoryItem, InteractiveChartData } from '../../types';
import { streamMessageToChat, generateImage, editImage, fetchVideoFromUri, generatePlan, runWorkflowStep, performGoogleSearch, browseWebpage, summarizeDocument, generateSpeech, generatePresentationContent, generateWordContent, generateExcelContent, analyzeBrowsedContent, generateVideo, executePythonCode, aikonPersonaInstruction, classifyIntentAndSelectPersona, generateWebsiteCode, getLiveFunctionDeclarations, generateProactiveGreeting, generateAwayReport } from '../../services/geminiService';
import { fetchWeather } from '../../services/weatherService';
import { GenerateVideosOperation, Content, GenerateContentResponse, GoogleGenAI, Modality, GroundingChunk, Blob as GenAI_Blob, LiveServerMessage, FunctionDeclaration } from '@google/genai';
import { parseMarkdown, renderParagraph, createPptxFile, createDocxFile, createXlsxFile, createPdfFile } from '../../utils/markdown';
import CodeBlock from '../CodeBlock';
import CodeCanvas from '../CodeCanvas';
import TaskList from '../TaskList';
import SettingsModal from '../SettingsModal';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../LoadingSpinner';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import WeatherCard from '../WeatherCard';
import InteractiveChart from '../InteractiveChart';
import { getTasks } from '../../services/firebase';

// Add a global type definition for the aistudio window object to avoid TypeScript errors.
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
    interface Window {
        aistudio?: AIStudio;
    }
}

// Mock Contacts Database for Demo purposes
const CONTACTS: { [key: string]: string } = {
    "Mom": "1234567890",
    "Dad": "0987654321",
    "Boss": "5550123456",
    "Emergency": "911"
};

// Sound effects utility
const playSound = (src: string, volume: number = 0.5) => {
    try {
        const audio = new Audio(src);
        audio.volume = volume;
        audio.play().catch(e => console.warn(`Could not play sound ${src}:`, e));
    } catch (e) {
        console.warn("Audio API not available.");
    }
};

// Haptic Feedback Helper
const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15); // Light tap
    }
};


// Audio processing functions
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
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

function createBlob(data: Float32Array): GenAI_Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const DEFAULT_PERSONAS: Persona[] = [
    {
        name: 'Legal Document Reviewer',
        icon: '📖',
        description: 'Analyzes legal documents for key clauses, risks, and inconsistencies with formal, objective language.',
        systemInstruction: `You are an expert legal document reviewer specializing in INDIAN law. Your role is to carefully read any legal text provided and provide analysis, citations, and practical guidance. Always advise consulting a licensed attorney.`
    },
    {
        name: 'Study Buddy',
        icon: '🎓',
        description: 'Explains complex topics using fun, cartoon-style images like a helpful friend.',
        systemInstruction: `You are 'Study Buddy', a friendly and fun AI tutor. Explain topics by generating simple, cartoon-style images. If a topic is better explained with text, ask the user first. For visual explanations, use the 'create_storyboard' tool.`
    },
    {
        name: 'Writing Assistant',
        icon: '📝',
        description: 'A supportive assistant to help brainstorm, outline, and improve writing.',
        systemInstruction: `You are an expert writing assistant. Analyze text for clarity, conciseness, and flow. Rewrite it to be more effective and provide a summary of improvements.`
    },
    {
        name: 'Fitness Advice',
        icon: '🍎',
        description: 'A motivational fitness coach providing safe, evidence-based fitness and nutrition advice.',
        systemInstruction: `You are a certified fitness and nutrition coach. Provide personalized workout plans and dietary advice. Always include a disclaimer to consult a doctor before starting any new regimen.`
    },
    {
        name: 'Personal Finance Assistant',
        icon: '💰',
        description: 'Helps with budgeting, saving strategies, and basic financial literacy.',
        systemInstruction: `You are a personal finance assistant. Help users create budgets, understand financial concepts, and save money. Do not provide investment advice or specific stock recommendations.`
    },
    {
        name: 'Developer Sandbox',
        icon: '💻',
        description: 'An environment for coding, file management, and technical problem solving.',
        systemInstruction: `You are an expert software developer. You can write and execute Python code, manage files, and help with debugging. Use the code execution tool frequently.`
    }
];

// --- ACTION LAUNCHER COMPONENT ---
const ActionLaunchCard: React.FC<{ 
    action: string; 
    target: string; 
    query?: string;
}> = ({ action, target, query }) => {
    const [status, setStatus] = useState<'idle' | 'launching' | 'done'>('idle');

    const performAction = () => {
        setStatus('launching');
        triggerHaptic();
        setTimeout(() => {
            try {
                if (action === 'call') {
                    const number = CONTACTS[target] || (target.match(/^\d+$/) ? target : null);
                    if (number) {
                        window.location.href = `tel:${number}`;
                    } else {
                        alert(`Could not find number for ${target}`);
                    }
                } else if (action === 'open_app') {
                    const appName = target.toLowerCase();
                    if (appName.includes('youtube')) {
                        const url = query ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` : 'https://www.youtube.com';
                        window.open(url, '_blank');
                    } else if (appName.includes('spotify')) {
                        const url = query ? `https://open.spotify.com/search/${encodeURIComponent(query)}` : 'https://open.spotify.com';
                        window.open(url, '_blank');
                    } else if (appName.includes('google')) {
                        const url = `https://www.google.com/search?q=${encodeURIComponent(query || target)}`;
                        window.open(url, '_blank');
                    } else if (appName.includes('instagram')) {
                         const url = `https://www.instagram.com/${query?.replace('@', '') || ''}`;
                         window.open(url, '_blank');
                    } else {
                         window.open(`https://www.google.com/search?q=${encodeURIComponent(target + ' ' + (query||''))}`, '_blank');
                    }
                } else if (action === 'navigation') {
                     window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`, '_blank');
                } else if (action === 'email') {
                     window.open(`mailto:${target}?subject=${encodeURIComponent(query || '')}`, '_blank');
                }
            } catch (e) {
                console.error("Launch failed", e);
            }
            setStatus('done');
        }, 500);
    };

    // Try auto-launch ONCE on mount
    useEffect(() => {
        performAction();
    }, []);

    if (status === 'done') {
         return (
            <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-4 my-2 flex items-center gap-3">
                <div className="bg-green-500 text-black rounded-full p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </div>
                <span className="text-green-200 font-medium text-sm">Action Launched</span>
                <button onClick={performAction} className="text-xs underline text-green-400 ml-auto">Launch Again</button>
            </div>
         );
    }

    return (
        <div className="bg-amber-900/20 border border-amber-500/50 rounded-xl p-4 my-2">
            <div className="flex items-center justify-between mb-3">
                <span className="text-amber-400 font-bold uppercase text-xs tracking-wider">Action Required</span>
                {status === 'launching' && <span className="text-xs text-amber-200 animate-pulse">Launching...</span>}
            </div>
            <h4 className="text-lg font-bold text-white mb-1 capitalize">{action.replace('_', ' ')}: {target}</h4>
            {query && <p className="text-sm text-gray-400 mb-4">"{query}"</p>}
            
            <button 
                onClick={performAction}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg shadow-lg shadow-amber-500/20 transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
                {status === 'launching' ? 'Launching...' : `Tap to Confirm ${action === 'call' ? 'Call' : 'Launch'}`}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
            <p className="text-[10px] text-gray-500 mt-2 text-center">If action didn't start automatically, tap the button above.</p>
        </div>
    );
}


// --- SUB-COMPONENTS ---

const MobileMenu: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    activePersona: Persona;
    personas: Persona[];
    onSelectPersona: (p: Persona) => void;
    isAgentMode: boolean;
    toggleAgentMode: () => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
    openSettings: () => void;
    openCodeCanvas: () => void;
}> = ({ isOpen, onClose, activePersona, personas, onSelectPersona, isAgentMode, toggleAgentMode, isDarkMode, toggleTheme, openSettings, openCodeCanvas }) => {
    if (!isOpen) return null;

    return (
        <>
            <motion.div 
                className="mobile-sheet-backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
            />
            <div className={`mobile-command-center ${isOpen ? 'open' : ''}`}>
                <div className="mobile-cc-handle" onClick={onClose}></div>
                
                <h3 className="text-white font-bold text-lg mb-4 pl-1">Quick Actions</h3>
                <div className="mobile-grid">
                     <div className={`mobile-action-btn ${isAgentMode ? 'active' : ''}`} onClick={() => { triggerHaptic(); toggleAgentMode(); }}>
                         <div className="icon-box">🤖</div>
                         <span>Agent</span>
                     </div>
                     <div className={`mobile-action-btn`} onClick={() => { triggerHaptic(); toggleTheme(); }}>
                         <div className="icon-box">{isDarkMode ? '🌙' : '☀️'}</div>
                         <span>Theme</span>
                     </div>
                     <div className={`mobile-action-btn`} onClick={() => { triggerHaptic(); openCodeCanvas(); onClose(); }}>
                         <div className="icon-box">💻</div>
                         <span>Code</span>
                     </div>
                     <div className={`mobile-action-btn`} onClick={() => { triggerHaptic(); openSettings(); onClose(); }}>
                         <div className="icon-box">⚙️</div>
                         <span>Settings</span>
                     </div>
                </div>

                <h3 className="text-white font-bold text-lg mb-4 pl-1">Select Persona</h3>
                <div className="overflow-x-auto pb-4 flex gap-3 scrollbar-none">
                    {personas.map(p => (
                        <button 
                            key={p.name}
                            onClick={() => { triggerHaptic(); onSelectPersona(p); onClose(); }}
                            className={`flex flex-col items-center p-3 rounded-2xl min-w-[80px] transition-all border ${activePersona.name === p.name ? 'bg-white/10 border-amber-400/50' : 'bg-transparent border-transparent'}`}
                        >
                             <span className="text-3xl mb-2">{p.icon}</span>
                             <span className={`text-[10px] font-medium text-center leading-tight ${activePersona.name === p.name ? 'text-amber-400' : 'text-gray-500'}`}>{p.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
};


const MessageLogItem: React.FC<{
    msg: Message;
    userProfile: UserProfile | null;
    onCopy: (text: string) => void;
    onRegenerate: () => void;
    isLastAiMessage: boolean;
}> = ({ msg, userProfile, onCopy, onRegenerate, isLastAiMessage }) => {
    const isUser = msg.sender === 'user';
    const [showActions, setShowActions] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyClick = () => {
        triggerHaptic();
        onCopy(msg.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div 
            className={`message-log-item ${isUser ? 'user' : 'ai'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
            onClick={() => setShowActions(!showActions)} // Toggle actions on click for mobile
        >
            <div className="message-bubble-wrapper">
                {!isUser && (
                    <div className="message-avatar ai-avatar">
                         <img src="/short_logo.jpeg" alt="Aikon" />
                    </div>
                )}
                <div className="relative group w-full max-w-[85%]">
                    <div className={`message-content-wrapper ${msg.status === 'streaming' ? 'streaming' : ''}`}>
                        {isUser && msg.attachments && msg.attachments.length > 0 && (
                             <div className="user-attachments-container mb-3">
                                {msg.attachments.map((file, idx) => (
                                    <div key={idx} className="relative">
                                        {file.mimeType.startsWith('image/') ? (
                                            <img src={file.base64} alt={file.name} />
                                        ) : (
                                            <div className="file-attachment-chip">
                                                <span>📎 {file.name}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                             </div>
                        )}

                        <div className="message-content">
                            {/* Thinking Indicator for AI */}
                            {!isUser && msg.text === '' && msg.status === 'streaming' && (
                                <div className="flex items-center gap-2 text-gray-400 italic text-sm mb-2 animate-pulse">
                                    <span>Thinking...</span>
                                </div>
                            )}

                             {msg.generatedImage && (
                                <div className="mb-4">
                                    {msg.generatedImage.isLoading ? (
                                        <div className={`skeleton-loader aspect-${msg.generatedImage.aspectRatio?.replace(':', '-') || '1-1'}`}>
                                            <span>Generating Image...</span>
                                        </div>
                                    ) : msg.generatedImage.url ? (
                                        <img src={msg.generatedImage.url} alt={msg.generatedImage.prompt} className="rounded-lg w-full max-w-md shadow-lg" />
                                    ) : null}
                                </div>
                            )}
                            
                            {/* Real World Action Launcher */}
                            {msg.actionData && (
                                <ActionLaunchCard 
                                    action={msg.actionData.action} 
                                    target={msg.actionData.target} 
                                    query={msg.actionData.query} 
                                />
                            )}

                             {msg.editedImage && (
                                <div className="mb-4 flex gap-2">
                                    <div className="w-1/2">
                                        <p className="text-xs text-gray-500 mb-1">Original</p>
                                        <img src={msg.editedImage.beforeUrl} alt="Original" className="rounded-lg w-full shadow-md opacity-60" />
                                    </div>
                                    <div className="w-1/2">
                                         <p className="text-xs text-gray-500 mb-1">Edited</p>
                                         {msg.editedImage.isLoading ? (
                                            <div className="skeleton-loader aspect-1-1"><span>Editing...</span></div>
                                         ) : msg.editedImage.afterUrl ? (
                                            <img src={msg.editedImage.afterUrl} alt="Edited" className="rounded-lg w-full shadow-lg" />
                                         ) : null}
                                    </div>
                                </div>
                            )}

                            {msg.generatedVideo && (
                                <div className="mb-4">
                                    {msg.generatedVideo.status === 'generating' ? (
                                        <div className="skeleton-loader aspect-16-9"><span>Creating Video...</span></div>
                                    ) : msg.generatedVideo.url ? (
                                        <video src={msg.generatedVideo.url} controls className="rounded-lg w-full max-w-md shadow-lg" />
                                    ) : (
                                         <div className="p-4 bg-red-900/20 text-red-400 rounded-lg text-sm">Video generation failed.</div>
                                    )}
                                </div>
                            )}
                            
                            {msg.weatherData && (
                                <div className="mb-4">
                                    <WeatherCard data={msg.weatherData} />
                                </div>
                            )}
                            
                            {msg.storyboardImages && (
                                <div className="storyboard-grid">
                                    {msg.storyboardImages.map((panel, idx) => (
                                        <div key={idx} className="storyboard-panel">
                                            {panel.url ? (
                                                 <img src={panel.url} alt={`Panel ${idx + 1}`} />
                                            ) : (
                                                <div className="skeleton-loader aspect-1-1 h-full"><span>Panel {idx+1}</span></div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {msg.segments ? (
                                msg.segments.map((segment, idx) => (
                                    <React.Fragment key={idx}>
                                        {segment.type === 'paragraph' ? (
                                            <div dangerouslySetInnerHTML={{ __html: renderParagraph(segment.content) }} />
                                        ) : (
                                            <CodeBlock code={segment.content} language={segment.language} filename={segment.filename} />
                                        )}
                                    </React.Fragment>
                                ))
                            ) : (
                                <div dangerouslySetInnerHTML={{ __html: renderParagraph(msg.text) }} />
                            )}

                            {msg.workflow && (
                                <div className="mt-4">
                                    <WorkflowBubble workflow={msg.workflow} />
                                </div>
                            )}
                            
                            {msg.interactiveChartData && (
                                <div className="mt-4 bg-white/5 p-2 rounded-xl border border-white/10">
                                    <InteractiveChart chartData={msg.interactiveChartData} theme="dark" />
                                </div>
                            )}

                            {msg.generatedFile && (
                                <div className="mt-2">
                                    {msg.generatedFile.type === 'pptx' && <PptPreviewCard fileData={msg.generatedFile} />}
                                    {(msg.generatedFile.type === 'docx' || msg.generatedFile.type === 'pdf' || msg.generatedFile.type === 'xlsx') && (
                                        <div className="file-generated-output">
                                             <span>{msg.generatedFile.type?.toUpperCase()}</span>
                                             <p>Generated: <strong>{msg.generatedFile.filename}</strong></p>
                                             <button 
                                                onClick={() => {
                                                    if(msg.generatedFile?.type === 'docx') createDocxFile(msg.generatedFile.data as WordData);
                                                    else if(msg.generatedFile?.type === 'pdf') createPdfFile(msg.generatedFile.data as WordData);
                                                    else createXlsxFile(msg.generatedFile!.data as ExcelData);
                                                }}
                                                className="text-xs bg-amber-500 text-black px-2 py-1 rounded font-bold hover:bg-amber-400"
                                            >
                                                Download
                                             </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                             {msg.generatedWebsite && (
                                <div className="mt-4 bg-[#1e1e1e] rounded-lg border border-gray-700 p-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-amber-400 font-bold flex items-center gap-2">
                                            <span className="text-xl">🌐</span> Website Generated
                                        </h4>
                                        {msg.generatedWebsite.isLoading ? (
                                            <span className="text-xs text-gray-400 animate-pulse">Building...</span>
                                        ) : (
                                            <span className="text-xs text-green-400">Ready</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-300 mb-3">Topic: {msg.generatedWebsite.topic}</p>
                                    {!msg.generatedWebsite.isLoading && (
                                        <button 
                                            className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-md font-semibold text-sm transition-colors"
                                            onClick={() => {
                                                const event = new CustomEvent('openWebsitePreview', { detail: msg.generatedWebsite });
                                                window.dispatchEvent(event);
                                            }}
                                        >
                                            Preview & Download
                                        </button>
                                    )}
                                </div>
                            )}

                            {msg.generatedQRCode && (
                                <div className="mt-4 qr-code-output">
                                    <img src={msg.generatedQRCode.dataUrl} alt="QR Code" />
                                    <p>{msg.generatedQRCode.text}</p>
                                </div>
                            )}
                            
                             {msg.codeExecutionResult && (
                                <div className="code-execution-result">
                                    <div className="code-execution-header">Python Execution Output</div>
                                    <div className="code-execution-output">
                                        {msg.codeExecutionResult.output.includes('[PLOT_GENERATED]') ? (
                                            <img src={msg.codeExecutionResult.output.replace('[PLOT_GENERATED]\n', '')} alt="Generated Plot" />
                                        ) : (
                                            msg.codeExecutionResult.output
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {msg.audioUrl && (
                                <div className="mt-2">
                                    <audio src={msg.audioUrl} controls className="w-full h-8" />
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Action Buttons (Copy / Regenerate) */}
                    {!isUser && (
                        <AnimatePresence>
                            {showActions && (
                                <motion.div 
                                    className="absolute -bottom-6 left-0 flex gap-2"
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                >
                                    <button 
                                        onClick={handleCopyClick}
                                        className="text-xs text-gray-500 hover:text-white flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full backdrop-blur-md"
                                    >
                                        {copied ? (
                                            <span>✓ Copied</span>
                                        ) : (
                                            <span>Copy</span>
                                        )}
                                    </button>
                                    {isLastAiMessage && (
                                        <button 
                                            onClick={() => { triggerHaptic(); onRegenerate(); }}
                                            className="text-xs text-gray-500 hover:text-white flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full backdrop-blur-md"
                                        >
                                            Re-generate
                                        </button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}
                </div>
                {isUser && (
                    <div className="message-avatar user-avatar">
                        {userProfile?.photoURL ? <img src={userProfile.photoURL} alt="User" /> : (userProfile?.displayName?.[0] || 'U')}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

const ChatComposer: React.FC<{
    input: string;
    setInput: (val: string) => void;
    onSend: () => void;
    files: FileAttachment[];
    setFiles: React.Dispatch<React.SetStateAction<FileAttachment[]>>;
    isLoading: boolean;
    fileInputRef: React.RefObject<HTMLInputElement>;
    onDictate: () => void;
    isRecording: boolean;
}> = ({ input, setInput, onSend, files, setFiles, isLoading, fileInputRef, onDictate, isRecording }) => {

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            triggerHaptic();
            onSend();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
             triggerHaptic();
             Array.from(e.target.files).forEach((file: File) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result as string;
                    const base64Data = base64.split(',')[1];
                    setFiles(prev => [...prev, { name: file.name, base64: base64Data, mimeType: file.type }]);
                };
                reader.readAsDataURL(file);
            });
            e.target.value = '';
        }
    };

    const removeFile = (index: number) => {
        triggerHaptic();
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="chat-composer-container">
             <AnimatePresence>
                {files.length > 0 && (
                    <motion.div 
                        className="composer-file-preview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                    >
                        <div className="composer-file-preview-inner">
                             <div className="composer-multi-file-container">
                                {files.map((file, idx) => (
                                    <div key={idx} className="composer-file-thumb">
                                         {file.mimeType.startsWith('image/') ? (
                                            <img src={`data:${file.mimeType};base64,${file.base64}`} alt={file.name} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-700 text-xs text-center p-1 break-words text-white">
                                                {file.name.split('.').pop()?.toUpperCase()}
                                            </div>
                                        )}
                                        <button onClick={() => removeFile(idx)} className="remove-attachment-btn">×</button>
                                    </div>
                                ))}
                             </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="chat-composer">
                <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                <button 
                    className="composer-icon-button" 
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach files"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </button>
                
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isRecording ? "Listening..." : "Ask Aikon..."}
                    className="composer-textarea"
                    rows={1}
                />
                
                {/* Voice Dictation Button */}
                <button 
                    className={`composer-icon-button ${isRecording ? 'text-red-500 recording-pulse' : ''}`} 
                    onClick={onDictate}
                    title={isRecording ? "Stop Recording" : "Start Dictation"}
                >
                     {isRecording ? (
                         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                     ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                     )}
                </button>

                <button 
                    className="composer-icon-button composer-send-button"
                    onClick={onSend}
                    disabled={(!input.trim() && files.length === 0) || isLoading}
                >
                    {isLoading ? (
                        <span className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    )}
                </button>
            </div>
        </div>
    );
};

const WorkflowBubble: React.FC<{ workflow: Workflow }> = ({ workflow }) => {
    const [expanded, setExpanded] = useState(false);
    
    return (
        <div className="workflow-container">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-2">
                    <div className="typing-indicator task-workflow"><span></span></div>
                    <h4 className="font-bold text-white">Autonomous Agent Workflow</h4>
                </div>
                 <span className="text-xs text-gray-500">{expanded ? 'Hide' : 'Show'} Details</span>
            </div>
            <p className="text-sm text-gray-400 mt-1">Goal: {workflow.goal}</p>
            
            {expanded && (
                <div className="mt-4 space-y-3">
                    <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Execution Plan</h5>
                    {workflow.steps.map((step, idx) => (
                        <div key={idx} className="text-sm border-l-2 border-gray-700 pl-3 py-1">
                            <div className="flex items-center gap-2 mb-1">
                                <StepIcon status={step.status} />
                                <span className="text-xs font-bold text-gray-300">Step {idx + 1}</span>
                                <StatusPill status={step.status} />
                            </div>
                            <p className="text-gray-400">{step.summary}</p>
                            {step.tool_output && (
                                <div className="workflow-step-tool-output">
                                    <details>
                                        <summary>View Output</summary>
                                        <div className="output-content">
                                            {JSON.stringify(step.tool_output, null, 2)}
                                        </div>
                                    </details>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
    const colors: {[key:string]: string} = {
        'pending': 'bg-gray-700 text-gray-300',
        'running': 'bg-amber-500/20 text-amber-400 animate-pulse',
        'completed': 'bg-green-500/20 text-green-400',
        'error': 'bg-red-500/20 text-red-400'
    };
    return <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${colors[status] || colors.pending}`}>{status}</span>
};

const ToolIcon: React.FC<{ name: string }> = ({ name }) => {
    if (name.includes('search')) return <span>🔍</span>;
    if (name.includes('write')) return <span>✍️</span>;
    if (name.includes('create')) return <span>📄</span>;
    return <span>🛠️</span>;
};

const StepIcon: React.FC<{ status: string }> = ({ status }) => {
    if (status === 'completed') return <span className="text-green-500">✓</span>;
    if (status === 'error') return <span className="text-red-500">✕</span>;
    if (status === 'running') return <span className="text-amber-500">➜</span>;
    return <span className="text-gray-600">○</span>;
};

const PptPreviewCard: React.FC<{ fileData: any }> = ({ fileData }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    return (
        <div 
            className="ppt-preview-card"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="ppt-preview-image-container">
                {fileData.previewImageUrl ? (
                    <img src={fileData.previewImageUrl} alt="Slide Preview" className="ppt-preview-image" />
                ) : (
                    <div className="ppt-preview-no-image">
                        <div className="flex flex-col items-center gap-2">
                            <PptIcon size={24} />
                            <span className="text-xs">Preview Unavailable</span>
                        </div>
                    </div>
                )}
            </div>
            <div className="ppt-preview-content">
                <div className="ppt-preview-header">
                    <PptIcon size={16} />
                    <span>POWERPOINT PRESENTATION</span>
                </div>
                <h3 className="ppt-preview-title">{fileData.filename}</h3>
                <p className="text-xs text-gray-500 mt-1">Generated by AikonAI</p>
            </div>
            <div className="ppt-preview-footer">
                 <button 
                    onClick={() => createPptxFile(fileData.data as PresentationData, fileData.filename.replace('.pptx', ''))}
                    className="ppt-preview-download-btn"
                >
                    Download .PPTX
                </button>
            </div>
        </div>
    );
};

const PptIcon = ({ size = 24 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8"></path><path d="M8 17h8"></path><path d="M10 9h4"></path></svg>
);

const WebsitePreview: React.FC<{ websiteData: any, onClose: () => void }> = ({ websiteData, onClose }) => {
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

    const downloadHtml = () => {
        const blob = new Blob([websiteData.htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'website.html';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col">
            <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-center px-4 relative">
                <div className="absolute left-4 flex items-center gap-4">
                    <h3 className="text-white font-bold">Website Preview</h3>
                    <div className="flex bg-zinc-800 rounded-md p-1">
                        <button onClick={() => setViewMode('desktop')} className={`p-1 rounded ${viewMode === 'desktop' ? 'bg-zinc-600 text-white' : 'text-gray-400'}`}>🖥️</button>
                        <button onClick={() => setViewMode('mobile')} className={`p-1 rounded ${viewMode === 'mobile' ? 'bg-zinc-600 text-white' : 'text-gray-400'}`}>📱</button>
                    </div>
                </div>
                <div className="flex gap-2 absolute right-4">
                    <button onClick={downloadHtml} className="bg-amber-600 text-white px-3 py-1 rounded text-sm hover:bg-amber-500">Download HTML</button>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
            </div>
            <div className="flex-grow bg-zinc-800 flex items-center justify-center p-4 overflow-hidden">
                <motion.div 
                    className="bg-white h-full shadow-2xl transition-all duration-300"
                    style={{ width: viewMode === 'mobile' ? '375px' : '100%', maxWidth: viewMode === 'mobile' ? '375px' : '1200px' }}
                >
                    <iframe 
                        srcDoc={websiteData.htmlContent}
                        className="w-full h-full border-0" 
                        title="Preview" 
                        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups" 
                    />
                </motion.div>
            </div>
        </div>
    );
};

// --- LIVE CONVERSATION COMPONENTS ---

interface LiveVisualContent {
    type: 'image' | 'weather' | 'website' | 'text' | 'search_result' | 'code';
    data: any;
}

const LiveConversationOverlay: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    status: 'connecting' | 'connected' | 'error' | 'idle';
    volume: number;
    liveContent: LiveVisualContent | null;
    isUploadRequested: boolean;
    onUpload: () => void;
}> = ({ isOpen, onClose, status, volume, liveContent, isUploadRequested, onUpload }) => {
    if (!isOpen) return null;

    return (
        <div className="live-overlay">
            <div className="live-content w-full h-full relative">
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-6 right-6 z-50 text-white/50 hover:text-white bg-black/20 p-2 rounded-full backdrop-blur-md transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>

                {/* Main Centered Orb */}
                <div className="flex flex-col items-center justify-center h-full pb-20 relative">
                    <div className={`live-orb ${status === 'connected' ? 'connected' : ''} z-10`}>
                        <div 
                            className="live-orb-inner" 
                            style={{ 
                                transform: `scale(${1 + volume})`,
                                transition: 'transform 0.05s ease-out' // Faster reaction for volume
                            }}
                        />
                    </div>
                    
                    <p className="live-status mt-8 z-10 text-amber-200/80 font-medium tracking-wider uppercase text-xs">
                        {status === 'connecting' && "Connecting to Aikon..."}
                        {status === 'connected' && "Listening..."}
                        {status === 'error' && "Connection Error"}
                    </p>

                    {/* Visual Stage for Content (Images, Weather, etc.) */}
                    <AnimatePresence>
                        {liveContent && (
                            <motion.div 
                                className="mt-8 max-w-lg w-full px-4 z-20 absolute top-[60%] md:top-[55%]"
                                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                            >
                                <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-h-[40vh] overflow-y-auto">
                                    {liveContent.type === 'weather' && (
                                        <div className="flex justify-center">
                                            <WeatherCard data={liveContent.data} />
                                        </div>
                                    )}
                                    {liveContent.type === 'image' && (
                                        <div className="flex flex-col items-center">
                                            <img src={liveContent.data.url} alt="Generated" className="rounded-lg w-full max-h-64 object-contain shadow-lg mb-2" />
                                            <p className="text-xs text-gray-400 italic text-center">{liveContent.data.prompt}</p>
                                        </div>
                                    )}
                                    {liveContent.type === 'website' && (
                                        <div className="text-center">
                                            <div className="bg-zinc-800 rounded-lg p-4 mb-3">
                                                <span className="text-4xl">🌐</span>
                                            </div>
                                            <h4 className="text-white font-bold">Website Ready</h4>
                                            <p className="text-sm text-gray-400 mb-4">Topic: {liveContent.data.topic}</p>
                                            <button 
                                                onClick={() => {
                                                    const event = new CustomEvent('openWebsitePreview', { detail: liveContent.data });
                                                    window.dispatchEvent(event);
                                                }}
                                                className="bg-amber-500 text-black px-4 py-2 rounded-lg font-bold text-sm hover:bg-amber-400 w-full"
                                            >
                                                View Website
                                            </button>
                                        </div>
                                    )}
                                     {liveContent.type === 'text' && (
                                        <div className="text-center">
                                            <div className="bg-zinc-800 rounded-lg p-3 mb-2 inline-block">
                                                <span className="text-2xl">🚀</span>
                                            </div>
                                            <p className="text-white font-semibold">{liveContent.data}</p>
                                        </div>
                                    )}
                                    {liveContent.type === 'search_result' && (
                                        <div className="text-left">
                                            <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
                                                <span className="text-xl">🔍</span>
                                                <h4 className="text-white font-bold text-sm">Search Results</h4>
                                            </div>
                                            <p className="text-gray-300 text-sm leading-relaxed mb-3 max-h-32 overflow-y-auto">
                                                {liveContent.data.text}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {liveContent.data.sources.slice(0, 3).map((src: any, idx: number) => (
                                                    <a key={idx} href={src.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-amber-400 truncate max-w-[100px]">
                                                        {src.title}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {liveContent.type === 'code' && (
                                        <div className="text-left">
                                            <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
                                                <span className="text-xl">💻</span>
                                                <h4 className="text-white font-bold text-sm">Python Output</h4>
                                            </div>
                                            <pre className="text-xs text-green-400 bg-black/50 p-2 rounded font-mono overflow-x-auto">
                                                {liveContent.data.output}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Bottom Toolbar */}
                <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 z-50">
                    <AnimatePresence>
                        {isUploadRequested && (
                            <motion.button 
                                initial={{ scale: 0, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0, y: 20 }}
                                onClick={onUpload}
                                className="absolute bottom-20 px-6 py-3 bg-amber-500 text-black font-bold rounded-full shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-bounce flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                Tap to Upload Image
                            </motion.button>
                        )}
                    </AnimatePresence>
                    
                    <motion.button 
                        onClick={onClose} 
                        className="px-8 py-4 bg-red-600 rounded-full text-white font-bold hover:bg-red-500 transition-colors shadow-lg flex items-center gap-2"
                        whileTap={{ scale: 0.95 }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/></svg>
                        End Call
                    </motion.button>
                </div>
            </div>
        </div>
    );
};

const SessionFileManager: React.FC<{ files: VirtualFile[], onOpenFile: (filename: string) => void }> = ({ files, onOpenFile }) => {
    if (files.length === 0) return null;
    return (
        <div className="flex items-center gap-2 overflow-x-auto py-2 px-4 bg-black/20 border-b border-white/5">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Session Files:</span>
            {files.map((file, idx) => (
                <button 
                    key={idx}
                    onClick={() => onOpenFile(file.name)}
                    className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-2 py-1 rounded border border-zinc-700 transition-colors"
                >
                    <span>📄</span>
                    {file.name}
                </button>
            ))}
        </div>
    );
};

const CodeHistoryPanel: React.FC<{ history: CodeExecutionHistoryItem[] }> = ({ history }) => {
    if (history.length === 0) return null;
    return (
        <div className="code-history-panel">
             <div className="code-history-header">
                <h3 className="text-white font-bold">Code Execution History</h3>
            </div>
            <div className="code-history-list">
                {history.map(item => (
                    <div key={item.id} className="code-history-item">
                        <div className="code-history-item-code">
                             <pre className="text-xs text-gray-300">{item.code}</pre>
                        </div>
                        <div className="code-history-item-footer">
                            <span className="code-history-timestamp">{item.timestamp.toLocaleTimeString()}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Helper to extract and parse JSON more robustly
const extractJsonFromText = (text: string): any | null => {
    try {
        // 1. Try finding a code block first
        const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) return JSON.parse(codeBlockMatch[1]);

        // 2. Try finding the first '{' and last '}' for a complete object
        const firstOpen = text.indexOf('{');
        const lastClose = text.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose > firstOpen) {
             const potentialJson = text.substring(firstOpen, lastClose + 1);
             return JSON.parse(potentialJson);
        }
        
        // 3. Try parsing the whole text if it looks like JSON
        if (text.trim().startsWith('{')) {
             return JSON.parse(text.trim());
        }
    } catch (e) {
        // Parsing failed, fall through to repair attempts
    }
    
    // 4. Repair attempt for truncated JSON (common with tool calls)
    const firstOpen = text.indexOf('{');
    if (firstOpen !== -1) {
        const potentialJson = text.substring(firstOpen); // Take everything from first brace
        // Try appending closing characters to fix truncated JSON
        const closers = ['}', '"}', '"} }', '"]', '"] }', '"] } }'];
        for (const closer of closers) {
            try {
                return JSON.parse(potentialJson + closer);
            } catch (e) {}
        }
    }

    return null;
};

// --- MAIN PAGE COMPONENT ---

const AikonChatPage: React.FC<NavigationProps> = ({ navigateTo }) => {
    const { currentUser, updateCurrentUser } = useAuth();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [files, setFiles] = useState<FileAttachment[]>([]);
    const [isAgentMode, setIsAgentMode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [activePersona, setActivePersona] = useState<Persona>(DEFAULT_PERSONAS[0]);
    const [showPersonaMenu, setShowPersonaMenu] = useState(false);
    const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
    const [sessionFiles, setSessionFiles] = useState<VirtualFile[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isCodeCanvasOpen, setIsCodeCanvasOpen] = useState(false);
    const [codeHistory, setCodeHistory] = useState<CodeExecutionHistoryItem[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showLiveOverlay, setShowLiveOverlay] = useState(false);
    const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [liveVolume, setLiveVolume] = useState(0);
    const [liveContent, setLiveContent] = useState<LiveVisualContent | null>(null);
    const [generatedWebsiteData, setGeneratedWebsiteData] = useState<any>(null);
    const [isDarkMode, setIsDarkMode] = useState(true);
    
    // State for Live Image Upload Request
    const [isUploadRequested, setIsUploadRequested] = useState(false);
    const [pendingUploadRequestId, setPendingUploadRequestId] = useState<string | null>(null);
    const [uploadedLiveImage, setUploadedLiveImage] = useState<FileAttachment | null>(null);

    // Mobile specific state
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    // Refs
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const liveFileInputRef = useRef<HTMLInputElement>(null);
    const liveClientRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const audioQueueRef = useRef<AudioBuffer[]>([]);
    const isPlayingRef = useRef(false);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const recognitionRef = useRef<any>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const nextStartTimeRef = useRef<number>(0);

    const allPersonas = [...DEFAULT_PERSONAS, ...(currentUser?.customPersonas || [])];

    // Device detection
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Theme Management
    useEffect(() => {
        document.body.classList.remove('dark-theme-body');
        if (isDarkMode) {
            document.body.classList.add('dark-theme-chat');
            document.body.classList.remove('light-theme-chat');
        } else {
            document.body.classList.add('light-theme-chat');
            document.body.classList.remove('dark-theme-chat');
        }
        return () => {
            document.body.classList.remove('dark-theme-chat');
            document.body.classList.remove('light-theme-chat');
            document.body.classList.add('dark-theme-body');
        };
    }, [isDarkMode]);

    // Initialization
    useEffect(() => {
        const defaultPersona: Persona = {
             name: 'AikonAI',
             icon: '🧠',
             description: 'The core Aikon experience.',
             systemInstruction: aikonPersonaInstruction
        };
        setActivePersona(defaultPersona);

        const initAgent = async () => {
            const lastVisit = localStorage.getItem('aikon_last_visit');
            const now = Date.now();
            if (lastVisit) {
                const hoursAway = (now - parseInt(lastVisit)) / (1000 * 60 * 60);
                if (hoursAway > 1) {
                     setIsLoading(true);
                     const report = await generateAwayReport(currentUser, hoursAway, tasks);
                     const msg: Message = { id: Date.now().toString(), text: report, sender: 'ai', timestamp: new Date(), status: 'sent' };
                     setMessages(prev => [...prev, msg]);
                     setIsLoading(false);
                } else {
                     const greeting = await generateProactiveGreeting(currentUser, new Date(), tasks);
                     const msg: Message = { id: Date.now().toString(), text: greeting, sender: 'ai', timestamp: new Date(), status: 'sent' };
                     setMessages(prev => [...prev, msg]);
                }
            } else {
                 const greeting = await generateProactiveGreeting(currentUser, new Date(), tasks);
                 const msg: Message = { id: Date.now().toString(), text: greeting, sender: 'ai', timestamp: new Date(), status: 'sent' };
                 setMessages(prev => [...prev, msg]);
            }
            localStorage.setItem('aikon_last_visit', now.toString());
        };
        initAgent();
        const handleUnload = () => localStorage.setItem('aikon_last_visit', Date.now().toString());
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, [currentUser, tasks]);

    useEffect(() => {
        const loadTasks = async () => {
            if (currentUser) {
                const loadedTasks = await getTasks(currentUser.uid);
                setTasks(loadedTasks);
            }
        };
        loadTasks();
    }, [currentUser]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        const handleOpenPreview = (e: any) => setGeneratedWebsiteData(e.detail);
        window.addEventListener('openWebsitePreview', handleOpenPreview);
        return () => window.removeEventListener('openWebsitePreview', handleOpenPreview);
    }, []);

    // Voice Dictation Logic
    const handleDictation = useCallback(() => {
        triggerHaptic();
        if (isRecording) {
            recognitionRef.current?.stop();
            return;
        }

        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        if (!SpeechRecognition) {
            alert("Voice dictation is not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsRecording(true);
        recognition.onend = () => setIsRecording(false);
        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsRecording(false);
        };
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(prev => prev + (prev ? ' ' : '') + transcript);
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, [isRecording]);


    const handleSendMessage = async () => {
        if (!input.trim() && files.length === 0) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: input,
            sender: 'user',
            timestamp: new Date(),
            status: 'sent',
            attachments: files
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setFiles([]);
        setIsLoading(true);
        playSound('/sounds/send_message.mp3');
        triggerHaptic();

        // Agentic Persona Switching
        if (activePersona.name === 'AikonAI' && !isAgentMode) {
             const detectedPersonaName = await classifyIntentAndSelectPersona(input);
             if (detectedPersonaName !== 'AikonAI') {
                 const newPersona = allPersonas.find(p => p.name === detectedPersonaName);
                 if (newPersona) {
                     setActivePersona(newPersona);
                     setMessages(prev => [...prev, {
                         id: Date.now().toString(),
                         text: `*Switching to ${newPersona.icon} ${newPersona.name} mode...*`,
                         sender: 'ai',
                         timestamp: new Date(),
                         status: 'sent',
                         segments: [{ type: 'paragraph', content: `*Switching to ${newPersona.icon} ${newPersona.name} mode...*` }]
                     }]);
                 }
             }
        }

        try {
            if (isAgentMode) {
                const planResult = await generatePlan(input);
                if ('error' in planResult) {
                    setMessages(prev => [...prev, { id: Date.now().toString(), text: planResult.error, sender: 'ai', timestamp: new Date(), status: 'sent' }]);
                    setIsLoading(false);
                    return;
                }

                const initialWorkflow: Workflow = {
                    goal: input,
                    plan: planResult.plan,
                    steps: planResult.plan.map(step => ({ summary: step, status: 'pending' })),
                    status: 'running',
                    finalContent: null
                };

                const workflowMsgId = Date.now().toString();
                setMessages(prev => [...prev, {
                    id: workflowMsgId,
                    text: "Starting workflow...",
                    sender: 'ai',
                    timestamp: new Date(),
                    status: 'streaming',
                    workflow: initialWorkflow
                }]);

                await runWorkflow(initialWorkflow, workflowMsgId);

            } else {
                const history = messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
                const { stream } = await streamMessageToChat(history, input, files, null, currentUser, undefined, activePersona.systemInstruction);

                let fullText = '';
                const msgId = Date.now().toString();
                setMessages(prev => [...prev, { id: msgId, text: '', sender: 'ai', timestamp: new Date(), status: 'streaming' }]);

                for await (const chunk of stream) {
                    const chunkText = chunk.text || ''; 
                    fullText += chunkText;
                    
                    // Attempt to detect JSON tool call during stream (for speed)
                    const toolCall = extractJsonFromText(fullText);
                    if (toolCall && toolCall.tool_call) {
                        await handleToolCall(toolCall, msgId);
                        return; 
                    }

                    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: fullText, segments: parseMarkdown(fullText) } : m));
                }
                
                // Post-stream check (more robust)
                const finalToolCall = extractJsonFromText(fullText);
                if (finalToolCall && finalToolCall.tool_call) {
                     setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: "Processing request...", segments: [] } : m));
                     await handleToolCall(finalToolCall, msgId);
                } else {
                     setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent' } : m));
                }
            }
        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now().toString(), text: "Sorry, something went wrong. Please try again.", sender: 'ai', timestamp: new Date(), status: 'sent' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const executeSystemAction = (action: string, target: string, query: string = '') => {
        let message = `Okay, I'm setting that up for you. Please confirm below.`;
        // Just return the text message. The message rendering component handles the ActionLauncher display via actionData.
        return message;
    };

    const handleToolCall = async (tool: any, msgId: string) => {
        // Image Gen
        if (tool.tool_call === 'generate_image') {
             const imgData = await generateImage(tool.prompt);
             setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: "Here is your image:", generatedImage: { prompt: tool.prompt, url: imgData || undefined, isLoading: false } } : m));
        }
        // Website Gen
        else if (tool.tool_call === 'generate_website') {
             const html = await generateWebsiteCode(tool.topic, tool.style, tool.features);
             setMessages(prev => prev.map(m => m.id === msgId ? { 
                 ...m, 
                 text: "I've designed the website for you.", 
                 generatedWebsite: { topic: tool.topic, htmlContent: html, isLoading: false }
             } : m));
        }
        // Storyboard
        else if (tool.tool_call === 'create_storyboard') {
             const prompts = tool.prompts;
             const images = await Promise.all(prompts.map((p: string) => generateImage(p)));
             setMessages(prev => prev.map(m => m.id === msgId ? {
                 ...m,
                 text: "Here is your storyboard:",
                 storyboardImages: images.map((url, i) => ({ prompt: prompts[i], url: url || '' }))
             } : m));
        }
        // Python
        else if (tool.tool_call === 'execute_python_code') {
             const result = await executePythonCode(tool.code, sessionFiles);
             setMessages(prev => prev.map(m => m.id === msgId ? {
                 ...m,
                 text: "Code executed.",
                 codeExecutionResult: { code: tool.code, output: result }
             } : m));
             setCodeHistory(prev => [...prev, { id: Date.now().toString(), code: tool.code, timestamp: new Date() }]);
        }
        // Real World Action
        else if (tool.tool_call === 'perform_real_world_action') {
             const text = executeSystemAction(tool.action, tool.target, tool.query);
             setMessages(prev => prev.map(m => m.id === msgId ? {
                 ...m,
                 text: text,
                 actionData: { action: tool.action, target: tool.target, query: tool.query }
             } : m));
        }
        // Weather
        else if (tool.tool_call === 'get_weather') {
            const weather = await fetchWeather(tool.city);
            if ('error' in weather) {
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: weather.error } : m));
            } else {
                setMessages(prev => prev.map(m => m.id === msgId ? {
                    ...m,
                    text: `Current weather in ${tool.city}`,
                    weatherData: weather
                } : m));
            }
        }
        // Documents
        else if (tool.tool_call === 'create_powerpoint') {
             const data = await generatePresentationContent(tool.topic, tool.num_slides || 5);
             if('error' in data) {
                 setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: data.error } : m));
             } else {
                 setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: "Here is your presentation.", generatedFile: { type: 'pptx', filename: `${tool.topic.replace(/ /g, '_')}.pptx`, message: "Presentation Ready", data: data } } : m));
             }
        }
        else if (tool.tool_call === 'create_word_document' || tool.tool_call === 'create_pdf_document') {
             const data = await generateWordContent(tool.topic, tool.sections);
             if('error' in data) {
                 setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: data.error } : m));
             } else {
                 const type = tool.tool_call === 'create_word_document' ? 'docx' : 'pdf';
                 setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: "Here is your document.", generatedFile: { type: type, filename: `${tool.topic.replace(/ /g, '_')}.${type}`, message: "Document Ready", data: data } } : m));
             }
        }
         else if (tool.tool_call === 'create_excel_spreadsheet') {
             const data = await generateExcelContent(tool.data_description, tool.columns);
             if('error' in data) {
                 setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: data.error } : m));
             } else {
                 setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: "Here is your spreadsheet.", generatedFile: { type: 'xlsx', filename: `${tool.filename || 'spreadsheet'}.xlsx`, message: "Spreadsheet Ready", data: { filename: tool.filename, ...data } } } : m));
             }
        }

        setIsLoading(false);
    };

    const runWorkflow = async (workflow: Workflow, msgId: string) => {
        let currentWorkflow = { ...workflow };
        setActiveWorkflow(currentWorkflow);

        // Simple loop to execute steps
        for (let i = 0; i < currentWorkflow.plan.length; i++) {
            const stepSummary = currentWorkflow.plan[i];
            
            // Update step to running
            currentWorkflow.steps[i].status = 'running';
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, workflow: { ...currentWorkflow } } : m));

            // Call AI to get the tool for this step
            const stepResult = await runWorkflowStep(currentWorkflow.goal, currentWorkflow.plan, currentWorkflow.steps.slice(0, i));
            
            if ('error' in stepResult) {
                currentWorkflow.steps[i].status = 'error';
                currentWorkflow.status = 'error';
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, workflow: { ...currentWorkflow } } : m));
                return;
            }

            // Execute the tool (simplified: just simulate delay and mock output for now, usually would call real tools)
            await new Promise(resolve => setTimeout(resolve, 2000)); 
            
            // Simulate output
            const mockOutput: StructuredToolOutput = { type: 'text', content: `Completed step: ${stepSummary}. Action taken: ${stepResult.tool_call.name}` };

            currentWorkflow.steps[i].status = 'completed';
            currentWorkflow.steps[i].tool_call = stepResult.tool_call;
            currentWorkflow.steps[i].tool_output = mockOutput;
            
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, workflow: { ...currentWorkflow } } : m));
        }
        
        currentWorkflow.status = 'completed';
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, workflow: { ...currentWorkflow }, text: "Workflow completed successfully." } : m));
        setActiveWorkflow(null);
    };

    // --- LIVE CONVERSATION LOGIC ---
    
    const startLiveConversation = async () => {
        try {
            setShowLiveOverlay(true);
            setLiveStatus('connecting');
            setLiveContent(null);
            setIsUploadRequested(false);
            setPendingUploadRequestId(null);
            setUploadedLiveImage(null);

            // Ensure AudioContext is resumed (fix for "button not working")
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext({ sampleRate: 24000 });
            }
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            const inputCtx = new AudioContext({ sampleRate: 16000 });
            
            // 2. Get Microphone Stream
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream;

            // 3. Connect to Gemini Live
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const config: any = {
                 model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                 callbacks: {
                     onopen: async () => {
                         setLiveStatus('connected');
                         
                         // Setup Input Processing
                         const source = inputCtx.createMediaStreamSource(stream);
                         const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                         
                         processor.onaudioprocess = (e) => {
                             const inputData = e.inputBuffer.getChannelData(0);
                             const pcmData = createBlob(inputData); 
                             
                             if (sessionPromiseRef.current) {
                                 sessionPromiseRef.current.then((session) => {
                                     session.sendRealtimeInput({ media: pcmData });
                                 });
                             }
                             
                             // Volume meter
                             let sum = 0;
                             for(let i=0; i<inputData.length; i++) sum += inputData[i]*inputData[i];
                             setLiveVolume(Math.sqrt(sum/inputData.length) * 5);
                         };
                         
                         source.connect(processor);
                         processor.connect(inputCtx.destination);
                         
                         // Cleanup on close
                         (processor as any).shutdown = () => {
                             source.disconnect();
                             processor.disconnect();
                         };
                     },
                     onmessage: async (msg: LiveServerMessage) => {
                         // Handle Audio Output
                         const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                         if (audioData) {
                             const buffer = await decodeAudioData(decode(audioData), audioContextRef.current!, 24000, 1);
                             playAudioBuffer(buffer);
                         }
                         
                         // Handle Interruption
                         if (msg.serverContent?.interrupted) {
                             audioQueueRef.current = [];
                             if (currentSourceRef.current) {
                                 currentSourceRef.current.stop();
                             }
                             isPlayingRef.current = false;
                             nextStartTimeRef.current = 0;
                         }
                         
                         // Handle Tool Calls from Live Session
                         if (msg.toolCall) {
                             for (const fc of msg.toolCall.functionCalls) {
                                 // Execute function (Visual only for now in overlay)
                                 if (fc.name === 'generate_image') {
                                      const prompt = fc.args['prompt'] as string;
                                      setLiveContent({ type: 'text', data: "Generating Image..." });
                                      const img = await generateImage(prompt);
                                      if (img) setLiveContent({ type: 'image', data: { url: img, prompt: prompt } });
                                      sessionPromiseRef.current?.then(s => s.sendToolResponse({ functionResponses: { name: fc.name, id: fc.id, response: { result: "Image displayed to user" } } }));
                                 } 
                                 else if (fc.name === 'get_weather') {
                                     const city = fc.args['city'] as string;
                                     const weather = await fetchWeather(city);
                                     if (!('error' in weather)) setLiveContent({ type: 'weather', data: weather });
                                     sessionPromiseRef.current?.then(s => s.sendToolResponse({ functionResponses: { name: fc.name, id: fc.id, response: { result: "Weather card displayed to user" } } }));
                                 }
                                 else if (fc.name === 'google_search') {
                                     const query = fc.args['query'] as string;
                                     setLiveContent({ type: 'text', data: "Searching Google..." });
                                     const searchRes = await performGoogleSearch(query);
                                     setLiveContent({ type: 'search_result', data: searchRes });
                                     // Send a summary back to the model so it can talk about it
                                     sessionPromiseRef.current?.then(s => s.sendToolResponse({ 
                                         functionResponses: { 
                                             name: fc.name, 
                                             id: fc.id, 
                                             response: { result: searchRes.text ? searchRes.text.substring(0, 500) : "No results found." } 
                                         } 
                                     }));
                                 }
                                 else if (fc.name === 'execute_python_code') {
                                     const code = fc.args['code'] as string;
                                     setLiveContent({ type: 'text', data: "Running Python..." });
                                     const output = await executePythonCode(code);
                                     setLiveContent({ type: 'code', data: { code: code, output: output } });
                                     sessionPromiseRef.current?.then(s => s.sendToolResponse({ 
                                         functionResponses: { name: fc.name, id: fc.id, response: { result: output } } 
                                     }));
                                 }
                                 else if (fc.name === 'request_image_upload') {
                                     // Show upload button
                                     setIsUploadRequested(true);
                                     setPendingUploadRequestId(fc.id);
                                     setLiveContent({ type: 'text', data: "Waiting for upload..." });
                                     // We do NOT send a response yet. We wait for the user to upload.
                                 }
                                 else if (fc.name === 'edit_image') {
                                      if (uploadedLiveImage) {
                                          const instruction = fc.args['instruction'] as string;
                                          setLiveContent({ type: 'text', data: "Editing Image..." });
                                          const result = await editImage(uploadedLiveImage, instruction);
                                          if (result) setLiveContent({ type: 'image', data: { url: result, prompt: instruction } });
                                          sessionPromiseRef.current?.then(s => s.sendToolResponse({ functionResponses: { name: fc.name, id: fc.id, response: { result: "Image edited and displayed" } } }));
                                      } else {
                                          sessionPromiseRef.current?.then(s => s.sendToolResponse({ functionResponses: { name: fc.name, id: fc.id, response: { result: "Error: No image uploaded yet." } } }));
                                      }
                                 }
                                 else if (fc.name === 'generate_website') {
                                     const topic = fc.args['topic'] as string;
                                     const style = fc.args['style'] as string;
                                     const features = fc.args['features'] as string[];
                                     const html = await generateWebsiteCode(topic, style, features);
                                     setLiveContent({ type: 'website', data: { topic: topic, htmlContent: html } });
                                     sessionPromiseRef.current?.then(s => s.sendToolResponse({ functionResponses: { name: fc.name, id: fc.id, response: { result: "Website generated and displayed" } } }));
                                 }
                                 else {
                                     // Default response for other tools
                                     sessionPromiseRef.current?.then(s => s.sendToolResponse({ functionResponses: { name: fc.name, id: fc.id, response: { result: "Action completed" } } }));
                                 }
                             }
                         }
                     },
                     onclose: () => {
                         setLiveStatus('idle');
                         setShowLiveOverlay(false);
                     },
                     onerror: (err: any) => {
                         console.error("Live Error:", err);
                         setLiveStatus('error');
                     }
                 },
                 config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
                    },
                    systemInstruction: `${aikonPersonaInstruction}

**LIVE VOICE MODE SPECIFIC INSTRUCTIONS:**
You are currently in a real-time voice conversation with the user.
1. **Conciseness:** Keep your spoken responses relatively short and conversational. Avoid long monologues unless asked.
2. **Tools:** You have access to tools. Use them proactively as described below.

IMPORTANT RULES FOR LIVE MODE:
1. VISUALS: If the user asks for something visual (image, weather, website), use the corresponding tool immediately.
2. SEARCH: If asked for current events or facts, use 'google_search'.
3. EDITING: If the user wants to edit an image, FIRST call 'request_image_upload' to get the file. Once they upload it, you will receive a confirmation, THEN call 'edit_image'.
4. CODE: If asked for math or logic, use 'execute_python_code'.
5. Be conversational but proactive with tools.
`,
                    tools: [{ functionDeclarations: getLiveFunctionDeclarations() }]
                 }
            };

            const sessionPromise = ai.live.connect(config);
            sessionPromiseRef.current = sessionPromise;

        } catch (error: any) {
            console.error("Failed to start live conversation:", error);
            setLiveStatus('error');
            alert(`Failed to start call: ${error.message}`); // Feedback
            setShowLiveOverlay(false);
        }
    };
    
    const playAudioBuffer = (buffer: AudioBuffer) => {
        audioQueueRef.current.push(buffer);
        if (!isPlayingRef.current) {
            playNextBuffer();
        }
    };
    
    const playNextBuffer = () => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            return;
        }
        
        isPlayingRef.current = true;
        const buffer = audioQueueRef.current.shift();
        if (!buffer || !audioContextRef.current) return;
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        currentSourceRef.current = source;
        
        const currentTime = audioContextRef.current.currentTime;
        // Ensure nextStartTime is at least current time to avoid scheduling in the past
        if (nextStartTimeRef.current < currentTime) {
            nextStartTimeRef.current = currentTime;
        }
        
        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += buffer.duration;
        
        source.onended = () => {
            playNextBuffer();
        };
    };

    const endLiveConversation = () => {
        audioStreamRef.current?.getTracks().forEach(t => t.stop());
        audioContextRef.current?.close();
        // Close session logic would go here if the SDK exposes a close method directly on the session object
        // For now, reloading or navigating away is the cleanest full disconnect, but we update state
        setLiveStatus('idle');
        setShowLiveOverlay(false);
        setLiveContent(null);
        sessionPromiseRef.current = null;
    };
    
    const handleLiveFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0 && sessionPromiseRef.current) {
             const file = e.target.files[0];
             const reader = new FileReader();
             reader.onloadend = async () => {
                 const base64 = (reader.result as string).split(',')[1];
                 
                 // Store internally for 'edit_image' usage
                 setUploadedLiveImage({ name: file.name, mimeType: file.type, base64: base64 });

                 sessionPromiseRef.current?.then(session => {
                     // Send image to model context
                     session.sendRealtimeInput({ 
                         media: { mimeType: file.type, data: base64 } 
                     });
                     
                     // If this was requested via tool call, resolve that tool call now
                     if (isUploadRequested && pendingUploadRequestId) {
                         session.sendToolResponse({
                             functionResponses: {
                                 name: 'request_image_upload',
                                 id: pendingUploadRequestId,
                                 response: { result: "User has uploaded the image. You can now proceed with 'edit_image' or analysis." }
                             }
                         });
                         setIsUploadRequested(false);
                         setPendingUploadRequestId(null);
                     }
                 });

                 // Give feedback
                 setLiveContent({ type: 'text', data: "Image Uploaded" });
             };
             reader.readAsDataURL(file);
        }
    };

    // Rendering Helpers for Conditional Header
    const renderDesktopHeader = () => (
         <header className="chat-header">
                <div className="flex items-center gap-3">
                    <img src="/long_logo.jpeg" alt="Aikon Logo" className="chat-header-logo rounded-md" />
                    <div className="hidden md:block">
                        <h1 className="font-bold text-white text-lg tracking-tight">AIKON STUDIO</h1>
                        <p className="text-xs text-gray-500">Engineered by Aditya Jain</p>
                    </div>
                </div>
                <div className="chat-header-actions">
                     <div className="agent-toggle">
                        <span className={`text-xs font-bold mr-2 ${isAgentMode ? 'text-amber-400' : 'text-gray-500'}`}>Agent Mode</span>
                        <button className={`toggle-switch ${isAgentMode ? 'on' : ''}`} onClick={() => { triggerHaptic(); setIsAgentMode(!isAgentMode); }}>
                            <div className="toggle-thumb" />
                        </button>
                    </div>
                    <button onClick={startLiveConversation} className="text-amber-400 border border-amber-400 hover:bg-amber-400 hover:text-black px-3 py-1 rounded-full flex items-center gap-1 transition-all" title="Start Voice Call"><span>🎙️</span> Call</button>
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="theme-toggle-button" title="Toggle Theme">{isDarkMode ? '☀️' : '🌙'}</button>
                    <button onClick={() => setIsCodeCanvasOpen(true)} title="Code Canvas"><span className="mr-1">💻</span> Code</button>
                    <button onClick={() => setIsSettingsOpen(true)}>Settings</button>
                    <button onClick={() => navigateTo('home')}>Exit</button>
                </div>
        </header>
    );

    const renderMobileHeader = () => (
         <header className="chat-header mobile">
             <div className="flex items-center gap-3">
                <img src="/short_logo.jpeg" alt="Logo" className="w-8 h-8 rounded-full shadow-md" />
                {activePersona.name !== 'AikonAI' && (
                    <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full">
                        <span className="text-xs">{activePersona.icon}</span>
                        <span className="text-[10px] font-bold text-white uppercase">{activePersona.name}</span>
                    </div>
                )}
             </div>
             <div className="flex gap-2">
                 <button onClick={() => { triggerHaptic(); startLiveConversation(); }} className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/50">
                     🎙️
                 </button>
                 <button onClick={() => { triggerHaptic(); setIsMobileMenuOpen(true); }} className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/10">
                     ☰
                 </button>
             </div>
         </header>
    );

    return (
        <div className="chat-page-container">
            {isMobile ? renderMobileHeader() : renderDesktopHeader()}

            <div ref={chatContainerRef} className="message-log-container">
                {messages.length === 0 && (
                    <div className="chat-welcome-screen">
                        <img src="/short_logo.jpeg" alt="Aikon" className="welcome-logo rounded-2xl shadow-2xl" />
                        <h2 className="welcome-title">How can I help?</h2>
                         {currentUser && (
                            <p className="text-gray-400 mt-4 text-lg">Welcome back, {currentUser.displayName || currentUser.aboutYou}.</p>
                        )}
                        <div className="welcome-actions">
                            <button className="action-pill" onClick={() => { setInput("Explain quantum computing"); handleSendMessage(); }}><span>⚛️</span> Explain quantum computing</button>
                            <button className="action-pill" onClick={() => { setInput("Write a python script to parse CSV"); handleSendMessage(); }}><span>🐍</span> Write a python script</button>
                            <button className="action-pill" onClick={() => { setInput("Create a marketing plan for a coffee shop"); handleSendMessage(); }}><span>☕</span> Create marketing plan</button>
                            <button className="action-pill" onClick={startLiveConversation}><span>🎙️</span> Start Voice Call</button>
                        </div>
                    </div>
                )}
                
                {messages.map((msg, index) => (
                    <MessageLogItem 
                        key={msg.id} 
                        msg={msg} 
                        userProfile={currentUser} 
                        onCopy={(text) => navigator.clipboard.writeText(text)}
                        onRegenerate={() => {
                             const lastUserMsg = messages.slice(0, index).reverse().find(m => m.sender === 'user');
                             if (lastUserMsg) { setInput(lastUserMsg.text); handleSendMessage(); }
                        }}
                        isLastAiMessage={index === messages.length - 1 && msg.sender === 'ai'}
                    />
                ))}
            </div>

            {/* Desktop Persona Selector */}
            {!isMobile && (
                <div className="chat-actions-bar">
                    <div className="chat-actions-inner">
                        <div className="persona-menu-container relative">
                            <button className="active-persona-indicator" onClick={() => setShowPersonaMenu(!showPersonaMenu)}>
                                <span>{activePersona.icon}</span>
                                <span className="font-bold">{activePersona.name}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${showPersonaMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            <AnimatePresence>
                                {showPersonaMenu && (
                                    <motion.div className="persona-menu" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                                        {allPersonas.map(persona => (
                                            <div key={persona.name} className={`persona-menu-item ${activePersona.name === persona.name ? 'selected' : ''}`} onClick={() => { setActivePersona(persona); setShowPersonaMenu(false); }}>
                                                 <div className="persona-tooltip-wrapper w-full flex items-center gap-2">
                                                    <span className="icon">{persona.icon}</span>
                                                    <span>{persona.name}</span>
                                                    {persona.isCustom && <span className="text-[10px] bg-zinc-700 text-gray-300 px-1 rounded">Custom</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            )}

            <ChatComposer 
                input={input} 
                setInput={setInput} 
                onSend={handleSendMessage} 
                files={files}
                setFiles={setFiles}
                isLoading={isLoading}
                fileInputRef={fileInputRef}
                onDictate={handleDictation}
                isRecording={isRecording}
            />
            
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} profile={currentUser} onSave={updateCurrentUser} onDeleteAllChats={() => setMessages([])} />
            <CodeCanvas files={{}} isVisible={isCodeCanvasOpen} onClose={() => setIsCodeCanvasOpen(false)} />
            
            {generatedWebsiteData && <WebsitePreview websiteData={generatedWebsiteData} onClose={() => setGeneratedWebsiteData(null)} />}

            <input type="file" ref={liveFileInputRef} className="hidden" onChange={handleLiveFileUpload} />
            <LiveConversationOverlay 
                isOpen={showLiveOverlay} 
                onClose={endLiveConversation} 
                status={liveStatus} 
                volume={liveVolume} 
                liveContent={liveContent} 
                isUploadRequested={isUploadRequested}
                onUpload={() => liveFileInputRef.current?.click()} 
            />

            {/* Mobile Command Center Bottom Sheet */}
            <AnimatePresence>
                {isMobile && isMobileMenuOpen && (
                    <MobileMenu 
                        isOpen={isMobileMenuOpen}
                        onClose={() => setIsMobileMenuOpen(false)}
                        activePersona={activePersona}
                        personas={allPersonas}
                        onSelectPersona={setActivePersona}
                        isAgentMode={isAgentMode}
                        toggleAgentMode={() => setIsAgentMode(!isAgentMode)}
                        isDarkMode={isDarkMode}
                        toggleTheme={() => setIsDarkMode(!isDarkMode)}
                        openSettings={() => setIsSettingsOpen(true)}
                        openCodeCanvas={() => setIsCodeCanvasOpen(true)}
                    />
                )}
            </AnimatePresence>

        </div>
    );
};

export default AikonChatPage;
