
import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { NavigationProps, FileAttachment, Message, Source, Task, ChatListItem, MessageSender, Workflow, WorkflowStep, CanvasFiles, UserProfile, VirtualFile, StructuredToolOutput, Persona, PresentationData, WordData, ExcelData, CodeExecutionHistoryItem, InteractiveChartData } from '../../types';
import { streamMessageToChat, generateImage, editImage, fetchVideoFromUri, generatePlan, runWorkflowStep, performGoogleSearch, browseWebpage, summarizeDocument, generateSpeech, generatePresentationContent, generateWordContent, generateExcelContent, analyzeBrowsedContent, generateVideo, executePythonCode, aikonPersonaInstruction, classifyIntentAndSelectPersona, generateWebsiteCode, getLiveFunctionDeclarations, generateProactiveGreeting, generateAwayReport, generateQRCode } from '../../services/geminiService';
import { fetchWeather } from '../../services/weatherService';
import { GenerateVideosOperation, Content, GenerateContentResponse, GoogleGenAI, Modality, GroundingChunk, Blob as GenAI_Blob, LiveServerMessage, FunctionDeclaration } from '@google/genai';
import { parseMarkdown, renderParagraph, createPptxFile, createDocxFile, createXlsxFile, createPdfFile } from '../../utils/markdown';
import CodeBlock from '../CodeBlock';
import CodeCanvas from '../CodeCanvas';
import TaskList from '../TaskList';
import SettingsModal from '../SettingsModal';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
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

const MotionDiv = motion.div as any;
const MotionButton = motion.button as any;

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
        navigator.vibrate(10); // Lighter, sharper tap for professional feel
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
        icon: '⚖️',
        description: 'Analyzes legal documents for key clauses, risks, and inconsistencies.',
        systemInstruction: `You are an expert legal document reviewer specializing in INDIAN law. Your role is to carefully read any legal text provided and provide analysis, citations, and practical guidance. Always advise consulting a licensed attorney.`
    },
    {
        name: 'Study Buddy',
        icon: '🎓',
        description: 'Explains complex topics utilizing visual aids and simple analogies.',
        systemInstruction: `You are 'Study Buddy', a friendly and fun AI tutor. Explain topics by generating simple, cartoon-style images. If a topic is better explained with text, ask the user first. For visual explanations, use the 'create_storyboard' tool.`
    },
    {
        name: 'Writing Assistant',
        icon: '✍️',
        description: 'Professional editor for refining syntax, tone, and clarity.',
        systemInstruction: `You are an expert writing assistant. Analyze text for clarity, conciseness, and flow. Rewrite it to be more effective and provide a summary of improvements.`
    },
    {
        name: 'Fitness Advice',
        icon: '💪',
        description: 'Evidence-based fitness and nutrition guidance.',
        systemInstruction: `You are a certified fitness and nutrition coach. Provide personalized workout plans and dietary advice. Always include a disclaimer to consult a doctor before starting any new regimen.`
    },
    {
        name: 'Personal Finance',
        icon: '📊',
        description: 'Assistance with budgeting, saving strategies, and financial literacy.',
        systemInstruction: `You are a personal finance assistant. Help users create budgets, understand financial concepts, and save money. Do not provide investment advice or specific stock recommendations.`
    },
    {
        name: 'Developer Console',
        icon: '💻',
        description: 'Python execution environment and file manipulation.',
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
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 my-2 flex items-center gap-3">
                <div className="bg-green-500 text-black rounded-full p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 01-1.414 0l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </div>
                <span className="text-green-200 font-medium text-xs font-mono uppercase tracking-wider">Action Executed</span>
            </div>
         );
    }

    return (
        <div className="bg-amber-900/10 border border-amber-500/30 rounded-lg p-4 my-2 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
                <span className="text-amber-500/80 font-bold uppercase text-[10px] tracking-widest">System Action</span>
                {status === 'launching' && <span className="text-[10px] text-amber-200 animate-pulse font-mono">EXECUTING...</span>}
            </div>
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-500/20 rounded-md flex items-center justify-center text-amber-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                    <h4 className="text-sm font-bold text-white capitalize leading-tight">{action.replace('_', ' ')}</h4>
                    <p className="text-xs text-gray-400">{target} {query ? `• ${query}` : ''}</p>
                </div>
            </div>
            
            <button 
                onClick={performAction}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs uppercase tracking-wider rounded transition-all transform active:scale-[0.98] shadow-lg shadow-amber-900/20"
            >
                {status === 'launching' ? 'Launching...' : 'Confirm Execution'}
            </button>
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
            <MotionDiv 
                className="mobile-sheet-backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
            />
            <div className={`mobile-command-center ${isOpen ? 'open' : ''}`}>
                <div className="mobile-cc-handle" onClick={onClose}></div>
                
                <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 pl-1">System Controls</h3>
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

                <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 pl-1">Active Persona</h3>
                <div className="overflow-x-auto pb-4 flex gap-3 scrollbar-none">
                    {personas.map(p => (
                        <button 
                            key={p.name}
                            onClick={() => { triggerHaptic(); onSelectPersona(p); onClose(); }}
                            className={`flex flex-col items-center p-3 rounded-xl min-w-[80px] transition-all border ${activePersona.name === p.name ? 'bg-amber-500/10 border-amber-500/50' : 'bg-white/5 border-transparent'}`}
                        >
                             <span className="text-2xl mb-2">{p.icon}</span>
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
        <MotionDiv 
            className={`message-log-item ${isUser ? 'user' : 'ai'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
            onClick={() => setShowActions(!showActions)}
        >
            <div className="message-bubble-wrapper">
                {!isUser && (
                    <div className="message-avatar ai-avatar">
                         <img src="/short_logo.jpeg" alt="Aikon" />
                    </div>
                )}
                <div className="relative group w-full">
                    <div className={`message-content-wrapper ${msg.status === 'streaming' ? 'streaming' : ''}`}>
                        {isUser && msg.attachments && msg.attachments.length > 0 && (
                             <div className="user-attachments-container mb-3">
                                {msg.attachments.map((file, idx) => (
                                    <div key={idx} className="relative">
                                        {file.mimeType.startsWith('image/') ? (
                                            <img src={`data:${file.mimeType};base64,${file.base64}`} alt={file.name} className="max-h-40 rounded-lg border border-white/10" />
                                        ) : (
                                            <div className="file-attachment-chip bg-black/20 px-3 py-2 rounded border border-white/10 text-xs">
                                                <span>📎 {file.name}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                             </div>
                        )}

                        <div className="message-content">
                            {/* Thinking Indicator */}
                            {!isUser && msg.text === '' && msg.status === 'streaming' && (
                                <div className="flex items-center gap-2 text-gray-500 font-mono text-xs mb-2">
                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                                    <span>COMPUTING...</span>
                                </div>
                            )}

                             {msg.generatedImage && (
                                <div className="mb-4">
                                    {msg.generatedImage.isLoading ? (
                                        <div className={`skeleton-loader aspect-${msg.generatedImage.aspectRatio?.replace(':', '-') || '1-1'}`}>
                                            <span>Rendering Graphics...</span>
                                        </div>
                                    ) : msg.generatedImage.url ? (
                                        <img src={msg.generatedImage.url} alt={msg.generatedImage.prompt} className="rounded border border-white/10 w-full max-w-md shadow-2xl" />
                                    ) : null}
                                </div>
                            )}
                            
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
                                        <p className="text-[10px] uppercase text-gray-500 mb-1 font-bold">Original</p>
                                        <img src={msg.editedImage.beforeUrl} alt="Original" className="rounded border border-white/5 w-full opacity-60 grayscale hover:grayscale-0 transition-all" />
                                    </div>
                                    <div className="w-1/2">
                                         <p className="text-[10px] uppercase text-amber-500 mb-1 font-bold">Enhanced</p>
                                         {msg.editedImage.isLoading ? (
                                            <div className="skeleton-loader aspect-1-1"><span>Processing...</span></div>
                                         ) : msg.editedImage.afterUrl ? (
                                            <img src={msg.editedImage.afterUrl} alt="Edited" className="rounded border border-amber-500/30 w-full shadow-lg" />
                                         ) : null}
                                    </div>
                                </div>
                            )}

                            {msg.generatedVideo && (
                                <div className="mb-4">
                                    {msg.generatedVideo.status === 'generating' ? (
                                        <div className="skeleton-loader aspect-16-9"><span>Generating Video Frame...</span></div>
                                    ) : msg.generatedVideo.url ? (
                                        <video src={msg.generatedVideo.url} controls className="rounded w-full max-w-md shadow-lg border border-white/10" />
                                    ) : (
                                         <div className="p-4 bg-red-900/20 text-red-400 rounded border border-red-500/20 text-xs font-mono">GENERATION_FAILED</div>
                                    )}
                                </div>
                            )}
                            
                            {msg.weatherData && (
                                <div className="mb-4">
                                    <WeatherCard data={msg.weatherData} />
                                </div>
                            )}
                            
                            {msg.storyboardImages && (
                                <div className="storyboard-grid grid grid-cols-2 gap-2">
                                    {msg.storyboardImages.map((panel, idx) => (
                                        <div key={idx} className="aspect-square bg-black/20 rounded overflow-hidden border border-white/5">
                                            {panel.url ? (
                                                 <img src={panel.url} alt={`Panel ${idx + 1}`} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="skeleton-loader h-full"><span>Panel {idx+1}</span></div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {msg.segments ? (
                                msg.segments.map((segment, idx) => (
                                    <React.Fragment key={idx}>
                                        {segment.type === 'paragraph' ? (
                                            <div className="text-balance" dangerouslySetInnerHTML={{ __html: renderParagraph(segment.content) }} />
                                        ) : (
                                            <CodeBlock code={segment.content} language={segment.language} filename={segment.filename} />
                                        )}
                                    </React.Fragment>
                                ))
                            ) : (
                                <div className="text-balance" dangerouslySetInnerHTML={{ __html: renderParagraph(msg.text) }} />
                            )}

                            {msg.workflow && (
                                <div className="mt-4">
                                    <WorkflowBubble workflow={msg.workflow} />
                                </div>
                            )}
                            
                            {msg.interactiveChartData && (
                                <div className="mt-4 bg-[#18181b] p-4 rounded-lg border border-white/5">
                                    <InteractiveChart chartData={msg.interactiveChartData} theme="dark" />
                                </div>
                            )}

                            {msg.generatedFile && (
                                <div className="mt-4">
                                    {msg.generatedFile.type === 'pptx' && <PptPreviewCard fileData={msg.generatedFile} />}
                                    {(msg.generatedFile.type === 'docx' || msg.generatedFile.type === 'pdf' || msg.generatedFile.type === 'xlsx') && (
                                        <div className="flex items-center justify-between bg-[#18181b] p-3 rounded border border-white/10">
                                             <div className="flex items-center gap-3">
                                                 <div className="bg-blue-600/20 text-blue-400 p-2 rounded text-xs font-bold uppercase">{msg.generatedFile.type}</div>
                                                 <div>
                                                     <p className="text-xs text-gray-400 uppercase tracking-wider">Document Generated</p>
                                                     <p className="text-sm text-white font-medium truncate max-w-[150px]">{msg.generatedFile.filename}</p>
                                                 </div>
                                             </div>
                                             <button 
                                                onClick={() => {
                                                    if(msg.generatedFile?.type === 'docx') createDocxFile(msg.generatedFile.data as WordData);
                                                    else if(msg.generatedFile?.type === 'pdf') createPdfFile(msg.generatedFile.data as WordData);
                                                    else createXlsxFile(msg.generatedFile!.data as ExcelData);
                                                }}
                                                className="text-xs bg-white text-black px-3 py-1.5 rounded font-bold hover:bg-gray-200"
                                            >
                                                Download
                                             </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                             {msg.generatedWebsite && (
                                <div className="mt-4 bg-[#121212] rounded border border-gray-800 p-0 overflow-hidden">
                                    <div className="bg-[#18181b] px-4 py-2 border-b border-gray-800 flex justify-between items-center">
                                        <h4 className="text-gray-400 font-bold text-xs uppercase tracking-widest">Web Preview</h4>
                                        {msg.generatedWebsite.isLoading ? (
                                            <span className="text-[10px] text-amber-500 animate-pulse">COMPILING...</span>
                                        ) : (
                                            <span className="text-[10px] text-green-500">READY</span>
                                        )}
                                    </div>
                                    <div className="p-6 flex flex-col items-center text-center">
                                        <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mb-3">
                                            <span className="text-2xl">🌐</span>
                                        </div>
                                        <p className="text-white font-medium mb-1">Website Generated</p>
                                        <p className="text-xs text-gray-500 mb-4">{msg.generatedWebsite.topic}</p>
                                        
                                        {!msg.generatedWebsite.isLoading && (
                                            <button 
                                                className="px-4 py-2 bg-white text-black rounded font-bold text-xs hover:bg-gray-200 transition-colors"
                                                onClick={() => {
                                                    const event = new CustomEvent('openWebsitePreview', { detail: msg.generatedWebsite });
                                                    window.dispatchEvent(event);
                                                }}
                                            >
                                                Launch Preview
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {msg.generatedQRCode && (
                                <div className="mt-4 bg-white p-2 rounded w-fit mx-auto">
                                    <img src={msg.generatedQRCode.dataUrl} alt="QR Code" className="w-32 h-32" />
                                    <p className="text-center text-black text-[10px] mt-1 font-mono">{msg.generatedQRCode.text}</p>
                                </div>
                            )}
                            
                            {msg.audioUrl && (
                                <div className="mt-3">
                                    <audio controls src={msg.audioUrl} className="w-full max-w-xs h-8" />
                                </div>
                            )}
                            
                             {msg.codeExecutionResult && (
                                <div className="mt-4 rounded border border-white/10 overflow-hidden">
                                    <div className="bg-[#18181b] px-3 py-1.5 border-b border-white/10 flex justify-between items-center">
                                        <span className="text-[10px] text-gray-500 font-mono uppercase">Output Console</span>
                                    </div>
                                    <div className="bg-[#09090b] p-3 font-mono text-xs text-green-400 overflow-x-auto">
                                        {msg.codeExecutionResult.output.includes('[PLOT_GENERATED]') ? (
                                            <img src={msg.codeExecutionResult.output.replace('[PLOT_GENERATED]\n', '')} alt="Generated Plot" className="rounded" />
                                        ) : (
                                            msg.codeExecutionResult.output
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Action Buttons (Copy / Regenerate) */}
                    {!isUser && (
                        <AnimatePresence>
                            {showActions && (
                                <MotionDiv 
                                    className="absolute -bottom-5 left-0 flex gap-2"
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                >
                                    <button 
                                        onClick={handleCopyClick}
                                        className="text-[10px] text-gray-500 hover:text-white bg-[#18181b] border border-[#27272a] px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                                    >
                                        {copied ? 'Copied' : 'Copy'}
                                    </button>
                                    {isLastAiMessage && (
                                        <button 
                                            onClick={() => { triggerHaptic(); onRegenerate(); }}
                                            className="text-[10px] text-gray-500 hover:text-white bg-[#18181b] border border-[#27272a] px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                                        >
                                            Regenerate
                                        </button>
                                    )}
                                </MotionDiv>
                            )}
                        </AnimatePresence>
                    )}
                </div>
                {isUser && (
                    <div className="message-avatar user-avatar">
                        {userProfile?.photoURL ? <img src={userProfile.photoURL} alt="User" /> : <div>U</div>}
                    </div>
                )}
            </div>
        </MotionDiv>
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
                    <MotionDiv 
                        className="composer-file-preview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        style={{ width: '100%', maxWidth: '48rem', marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}
                    >
                        {files.map((file, idx) => (
                            <div key={idx} className="relative bg-[#27272a] p-1 rounded border border-white/10 group">
                                 {file.mimeType.startsWith('image/') ? (
                                    <img src={`data:${file.mimeType};base64,${file.base64}`} alt={file.name} className="h-12 w-12 object-cover rounded" />
                                ) : (
                                    <div className="h-12 w-12 flex items-center justify-center text-[10px] text-gray-400 font-mono">FILE</div>
                                )}
                                <button onClick={() => removeFile(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                            </div>
                        ))}
                    </MotionDiv>
                )}
            </AnimatePresence>

            <div className="chat-composer">
                <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                <button 
                    className="composer-icon-button" 
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach files"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
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
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                     ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                     )}
                </button>

                <button 
                    className="composer-icon-button composer-send-button flex items-center justify-center"
                    onClick={onSend}
                    disabled={(!input.trim() && files.length === 0) || isLoading}
                >
                    {isLoading ? (
                        <span className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    )}
                </button>
            </div>
        </div>
    );
};

const WorkflowBubble: React.FC<{ workflow: Workflow }> = ({ workflow }) => {
    const [expanded, setExpanded] = useState(false);
    
    return (
        <div className="workflow-container border border-white/10 rounded p-3 bg-[#18181b]">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                    <div>
                         <h4 className="font-bold text-white text-xs uppercase tracking-wider">Autonomous Agent</h4>
                         <p className="text-[10px] text-gray-500 font-mono">ID: {Math.random().toString(36).substr(2, 6).toUpperCase()}</p>
                    </div>
                </div>
                 <span className="text-[9px] text-gray-500 uppercase tracking-widest border border-gray-700 px-2 py-1 rounded">{expanded ? 'Minimize' : 'Details'}</span>
            </div>
            
            {expanded && (
                <div className="mt-3 space-y-3 pt-3 border-t border-white/5">
                    <div>
                        <h5 className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Objective</h5>
                        <p className="text-xs text-gray-300">{workflow.goal}</p>
                    </div>
                    
                    <div className="space-y-2">
                        <h5 className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Execution Log</h5>
                        {workflow.steps.map((step, idx) => (
                            <div key={idx} className="text-xs pl-3 py-1 border-l border-gray-700 relative">
                                <div className="flex items-center gap-2 mb-1">
                                    <StepIcon status={step.status} />
                                    <span className="text-[10px] font-mono text-gray-400">STEP {String(idx + 1).padStart(2, '0')}</span>
                                    <StatusPill status={step.status} />
                                </div>
                                <p className="text-gray-300">{step.summary}</p>
                                {step.tool_output && (
                                    <div className="mt-1 text-[9px] font-mono text-gray-600 truncate bg-black/30 p-1 rounded">
                                        Output: {JSON.stringify(step.tool_output).substring(0, 60)}...
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
    const colors: {[key:string]: string} = {
        'pending': 'bg-gray-800 text-gray-500',
        'running': 'bg-amber-900/20 text-amber-500 border-amber-500/20 animate-pulse',
        'completed': 'bg-green-900/20 text-green-500 border-green-500/20',
        'error': 'bg-red-900/20 text-red-500 border-red-500/20'
    };
    return <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest border border-transparent ${colors[status] || colors.pending}`}>{status}</span>
};

const StepIcon: React.FC<{ status: string }> = ({ status }) => {
    if (status === 'completed') return <span className="text-green-500 text-[10px]">●</span>;
    if (status === 'error') return <span className="text-red-500 text-[10px]">●</span>;
    if (status === 'running') return <span className="text-amber-500 text-[10px]">●</span>;
    return <span className="text-gray-700 text-[10px]">○</span>;
};

const PptPreviewCard: React.FC<{ fileData: any }> = ({ fileData }) => {
    return (
        <div className="flex items-center gap-4 bg-[#18181b] p-3 rounded border border-white/10">
            <div className="flex items-center justify-center bg-[#C43E1C]/10 w-12 h-12 rounded">
                <PptIcon size={24} />
            </div>
            <div className="flex-grow overflow-hidden">
                <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">PRESENTATION DECK</div>
                <h3 className="text-sm text-white font-medium truncate">{fileData.filename}</h3>
            </div>
            <div className="">
                 <button 
                    onClick={() => createPptxFile(fileData.data as PresentationData, fileData.filename.replace('.pptx', ''))}
                    className="text-xs bg-white text-black px-3 py-1.5 rounded font-bold hover:bg-gray-200 uppercase tracking-wide"
                >
                    Download
                </button>
            </div>
        </div>
    );
};

const PptIcon = ({ size = 24 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#C43E1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 18v-6"></path><path d="M8 12h8"></path></svg>
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
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
            <div className="h-14 bg-[#09090b] border-b border-white/10 flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="h-6 w-px bg-white/10 mx-2"></div>
                    <div className="flex bg-[#18181b] rounded-md p-0.5 border border-white/5">
                        <button onClick={() => setViewMode('desktop')} className={`px-3 py-1 rounded text-xs font-medium transition-all ${viewMode === 'desktop' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>Desktop</button>
                        <button onClick={() => setViewMode('mobile')} className={`px-3 py-1 rounded text-xs font-medium transition-all ${viewMode === 'mobile' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>Mobile</button>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={downloadHtml} className="text-xs font-bold text-gray-300 hover:text-white transition-colors">DOWNLOAD CODE</button>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
                </div>
            </div>
            <div className="flex-grow bg-[#0c0c0c] flex items-center justify-center p-4 overflow-hidden relative">
                <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                <MotionDiv 
                    className="bg-white h-full shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] rounded-lg overflow-hidden border border-white/10"
                    style={{ width: viewMode === 'mobile' ? '375px' : '100%', maxWidth: viewMode === 'mobile' ? '375px' : '1400px' }}
                >
                    <iframe 
                        srcDoc={websiteData.htmlContent}
                        className="w-full h-full border-0" 
                        title="Preview" 
                        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups" 
                    />
                </MotionDiv>
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
            {/* Header Info */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-50">
                <div>
                    <h2 className="text-white font-bold text-2xl tracking-tight">AIKON LIVE</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></div>
                        <p className="text-xs text-gray-400 font-mono uppercase tracking-widest">
                            {status === 'connecting' && "ESTABLISHING UPLINK..."}
                            {status === 'connected' && "CHANNEL SECURE • 24kHz"}
                            {status === 'error' && "CONNECTION FAILED"}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            {/* Main Visual Content Area */}
            <div className="flex-grow flex flex-col items-center justify-center relative z-10">
                
                {/* The Orb / Visualizer */}
                <div className="relative mb-12">
                    <div className={`live-orb ${status === 'connected' ? 'connected' : ''}`}>
                        <div 
                            className="live-orb-inner" 
                            style={{ 
                                transform: `scale(${0.8 + (volume * 0.2)})`,
                                opacity: 0.5 + (volume * 0.5),
                                transition: 'transform 0.05s ease-out, opacity 0.05s ease-out'
                            }}
                        />
                         {/* Rings */}
                        <div className="absolute inset-0 border border-white/5 rounded-full scale-110"></div>
                        <div className="absolute inset-0 border border-white/5 rounded-full scale-125 opacity-50"></div>
                    </div>
                </div>

                {/* Dynamic Content Display */}
                <AnimatePresence>
                    {liveContent && (
                        <MotionDiv 
                            className="absolute bottom-32 w-full max-w-md px-4"
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        >
                            <div className="bg-[#121212]/90 backdrop-blur-xl rounded-xl p-5 border border-white/10 shadow-2xl shadow-black/50">
                                {liveContent.type === 'weather' && (
                                    <div className="flex justify-center transform scale-90">
                                        <WeatherCard data={liveContent.data} />
                                    </div>
                                )}
                                {liveContent.type === 'image' && (
                                    <div className="flex flex-col items-center">
                                        <img src={liveContent.data.url} alt="Generated" className="rounded border border-white/10 w-full shadow-lg mb-3" />
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest text-center">{liveContent.data.prompt}</p>
                                    </div>
                                )}
                                {liveContent.type === 'website' && (
                                    <div className="text-center">
                                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/10">
                                            <span className="text-2xl">🌐</span>
                                        </div>
                                        <h4 className="text-white font-bold text-sm uppercase tracking-wide mb-1">Website Ready</h4>
                                        <p className="text-xs text-gray-400 mb-4">{liveContent.data.topic}</p>
                                        <button 
                                            onClick={() => {
                                                const event = new CustomEvent('openWebsitePreview', { detail: liveContent.data });
                                                window.dispatchEvent(event);
                                            }}
                                            className="bg-white text-black px-6 py-2 rounded font-bold text-xs hover:bg-gray-200 w-full uppercase tracking-widest"
                                        >
                                            Launch Interface
                                        </button>
                                    </div>
                                )}
                                 {liveContent.type === 'text' && (
                                    <div className="text-center py-2">
                                        <p className="text-amber-400 font-mono text-sm animate-pulse">{liveContent.data}</p>
                                    </div>
                                )}
                                {liveContent.type === 'search_result' && (
                                    <div className="text-left">
                                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                                            <span className="text-lg">🔍</span>
                                            <h4 className="text-white font-bold text-xs uppercase tracking-widest">Intelligence Found</h4>
                                        </div>
                                        <p className="text-gray-300 text-xs leading-relaxed mb-3 line-clamp-4 font-mono">
                                            {liveContent.data.text}
                                        </p>
                                    </div>
                                )}
                                {liveContent.type === 'code' && (
                                    <div className="text-left">
                                        <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
                                            <span className="text-lg">💻</span>
                                            <h4 className="text-white font-bold text-xs uppercase tracking-widest">Execution Output</h4>
                                        </div>
                                        <pre className="text-[10px] text-green-400 bg-black/50 p-3 rounded font-mono overflow-x-auto border border-white/5">
                                            {liveContent.data.output}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </MotionDiv>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col items-center justify-end z-50 bg-gradient-to-t from-black via-black/80 to-transparent h-48">
                 <AnimatePresence>
                    {isUploadRequested && (
                        <MotionButton 
                            initial={{ scale: 0, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0, y: 20 }}
                            onClick={onUpload}
                            className="mb-6 px-6 py-3 bg-amber-500 text-black font-bold text-xs uppercase tracking-widest rounded-full shadow-[0_0_30px_rgba(245,158,11,0.4)] flex items-center gap-2 animate-bounce"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            Upload Image Source
                        </MotionButton>
                    )}
                </AnimatePresence>
                
                <button 
                    onClick={onClose} 
                    className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-500 hover:scale-105 transition-all"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/></svg>
                </button>
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

        // Keep a local reference to the files attached to this specific message
        const currentFiles = [...files]; 

        const userMsg: Message = {
            id: Date.now().toString(),
            text: input,
            sender: 'user',
            timestamp: new Date(),
            status: 'sent',
            attachments: currentFiles
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
                // Pass currentFiles here, which is the snapshot of files for this specific request
                const { stream } = await streamMessageToChat(history, input, currentFiles, null, currentUser, undefined, activePersona.systemInstruction);

                let fullText = '';
                const msgId = Date.now().toString();
                setMessages(prev => [...prev, { id: msgId, text: '', sender: 'ai', timestamp: new Date(), status: 'streaming' }]);

                for await (const chunk of stream) {
                    const chunkText = chunk.text || ''; 
                    fullText += chunkText;
                    
                    // Attempt to detect JSON tool call during stream (for speed)
                    const toolCall = extractJsonFromText(fullText);
                    if (toolCall && toolCall.tool_call) {
                        // Pass currentFiles to handleToolCall so it can use attachments for tools like edit_image
                        await handleToolCall(toolCall, msgId, currentFiles);
                        return; 
                    }

                    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: fullText, segments: parseMarkdown(fullText) } : m));
                }
                
                // Post-stream check (more robust)
                const finalToolCall = extractJsonFromText(fullText);
                if (finalToolCall && finalToolCall.tool_call) {
                     setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: "Processing request...", segments: [] } : m));
                     await handleToolCall(finalToolCall, msgId, currentFiles);
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
        let message = `Action setup confirmed. Please verify execution below.`;
        return message;
    };

    const handleToolCall = async (tool: any, msgId: string, attachedFiles: FileAttachment[]) => {
        // Ensure we update message status to 'sent' at the end to stop the "Computing..." indicator
        // Helper function to finalize the message
        const updateMsg = (updates: Partial<Message>) => {
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent', ...updates } : m));
        };

        try {
            // Image Gen
            if (tool.tool_call === 'generate_image') {
                updateMsg({ text: "Rendering graphics...", status: 'streaming' });
                const imgData = await generateImage(tool.prompt);
                updateMsg({ text: "Rendering complete:", generatedImage: { prompt: tool.prompt, url: imgData || undefined, isLoading: false } });
            }
            // Website Gen
            else if (tool.tool_call === 'generate_website') {
                // Provide immediate feedback before heavy operation
                updateMsg({ text: "Compiling web interface...", generatedWebsite: { topic: tool.topic, htmlContent: "", isLoading: true }, status: 'streaming' });
                
                const html = await generateWebsiteCode(tool.topic, tool.style, tool.features);
                updateMsg({ 
                    text: "Interface construction complete.", 
                    generatedWebsite: { topic: tool.topic, htmlContent: html, isLoading: false }
                });
            }
            // QR Code Gen
            else if (tool.tool_call === 'generate_qr_code') {
                const qrDataUrl = await generateQRCode(tool.text);
                updateMsg({
                    text: "QR Code Generated:",
                    generatedQRCode: { text: tool.text, dataUrl: qrDataUrl }
                });
            }
             // Edit Image
            else if (tool.tool_call === 'edit_image' || tool.tool_call === 'request_image_upload') {
                // For text mode, we assume the image is attached.
                const imageFile = attachedFiles.find(f => f.mimeType.startsWith('image/'));
                
                if (imageFile) {
                    updateMsg({ text: "Applying edits to image...", editedImage: { beforeUrl: `data:${imageFile.mimeType};base64,${imageFile.base64}`, prompt: tool.prompt, isLoading: true }, status: 'streaming' });
                    
                    const result = await editImage(imageFile, tool.prompt || "Edit this image");
                    updateMsg({ 
                         text: "Image enhancement complete.",
                         editedImage: { beforeUrl: `data:${imageFile.mimeType};base64,${imageFile.base64}`, afterUrl: result || undefined, prompt: tool.prompt, isLoading: false }
                    });
                } else {
                     updateMsg({ text: "I need an image to edit. Please upload one and ask again." });
                }
            }
            // Text to Speech
            else if (tool.tool_call === 'text_to_speech') {
                updateMsg({ text: "Synthesizing audio...", status: 'streaming' });
                const audioData = await generateSpeech(tool.text);
                updateMsg({ 
                    text: "Audio generated.", 
                    audioUrl: audioData ? `data:audio/mp3;base64,${audioData}` : undefined 
                });
            }
            // Storyboard
            else if (tool.tool_call === 'create_storyboard') {
                const prompts = tool.prompts;
                updateMsg({ text: "Sketching storyboard panels...", status: 'streaming' });
                const images = await Promise.all(prompts.map((p: string) => generateImage(p)));
                updateMsg({
                    text: "Storyboard sequence generated:",
                    storyboardImages: images.map((url, i) => ({ prompt: prompts[i], url: url || '' }))
                });
            }
            // Python
            else if (tool.tool_call === 'execute_python_code') {
                updateMsg({ text: "Running script...", status: 'streaming' });
                const result = await executePythonCode(tool.code, sessionFiles);
                updateMsg({
                    text: "Execution successful.",
                    codeExecutionResult: { code: tool.code, output: result }
                });
                setCodeHistory(prev => [...prev, { id: Date.now().toString(), code: tool.code, timestamp: new Date() }]);
            }
            // Real World Action
            else if (tool.tool_call === 'perform_real_world_action') {
                const text = executeSystemAction(tool.action, tool.target, tool.query);
                updateMsg({
                    text: text,
                    actionData: { action: tool.action, target: tool.target, query: tool.query }
                });
            }
            // Weather
            else if (tool.tool_call === 'get_weather') {
                const weather = await fetchWeather(tool.city);
                if ('error' in weather) {
                    updateMsg({ text: weather.error });
                } else {
                    updateMsg({
                        text: `Atmospheric data for ${tool.city}`,
                        weatherData: weather
                    });
                }
            }
            // Documents
            else if (tool.tool_call === 'create_powerpoint') {
                updateMsg({ text: "Compiling presentation deck...", status: 'streaming' });
                const data = await generatePresentationContent(tool.topic, tool.num_slides || 5);
                if('error' in data) {
                    updateMsg({ text: data.error });
                } else {
                    updateMsg({ text: "Presentation deck assembled.", generatedFile: { type: 'pptx', filename: `${tool.topic.replace(/ /g, '_')}.pptx`, message: "Presentation Ready", data: data } });
                }
            }
            else if (tool.tool_call === 'create_word_document' || tool.tool_call === 'create_pdf_document') {
                updateMsg({ text: "Drafting document...", status: 'streaming' });
                const data = await generateWordContent(tool.topic, tool.sections);
                if('error' in data) {
                    updateMsg({ text: data.error });
                } else {
                    const type = tool.tool_call === 'create_word_document' ? 'docx' : 'pdf';
                    updateMsg({ text: "Document compiled.", generatedFile: { type: type, filename: `${tool.topic.replace(/ /g, '_')}.${type}`, message: "Document Ready", data: data } });
                }
            }
            else if (tool.tool_call === 'create_excel_spreadsheet') {
                updateMsg({ text: "Structuring data tables...", status: 'streaming' });
                const data = await generateExcelContent(tool.data_description, tool.columns);
                if('error' in data) {
                    updateMsg({ text: data.error });
                } else {
                    updateMsg({ text: "Data structured in spreadsheet.", generatedFile: { type: 'xlsx', filename: `${tool.filename || 'spreadsheet'}.xlsx`, message: "Spreadsheet Ready", data: { filename: tool.filename, ...data } } });
                }
            }
            else {
                // Default fallback for unhandled tools
                 updateMsg({ text: `Tool call ${tool.tool_call} detected but no handler found.` });
            }
        } catch (error) {
            console.error("Tool execution failed:", error);
            updateMsg({ text: "An error occurred while executing the request." });
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
                                      setLiveContent({ type: 'text', data: "Rendering Image..." });
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
                                     setLiveContent({ type: 'text', data: "Querying Google Index..." });
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
                                     setLiveContent({ type: 'text', data: "Executing Script..." });
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
                                     setLiveContent({ type: 'text', data: "Awaiting visual input..." });
                                     // We do NOT send a response yet. We wait for the user to upload.
                                 }
                                 else if (fc.name === 'edit_image') {
                                      if (uploadedLiveImage) {
                                          const instruction = fc.args['instruction'] as string;
                                          setLiveContent({ type: 'text', data: "Applying modifications..." });
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
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } // UPDATED TO CHARON (MALE)
                    },
                    systemInstruction: `${aikonPersonaInstruction}

**LIVE VOICE MODE SPECIFIC INSTRUCTIONS:**
You are currently in a real-time voice conversation.
1. **Conciseness:** Keep spoken responses short, punchy, and professional.
2. **Tone:** Confident, intelligent, helpful. Like a senior engineer or strategist.
3. **Tools:** Use tools proactively.

IMPORTANT RULES FOR LIVE MODE:
1. VISUALS: If the user asks for something visual, use the corresponding tool immediately.
2. SEARCH: If asked for current events or facts, use 'google_search'.
3. EDITING: If the user wants to edit an image, FIRST call 'request_image_upload'.
4. CODE: If asked for math or logic, use 'execute_python_code'.
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
                 setLiveContent({ type: 'text', data: "Source Image Received" });
             };
             reader.readAsDataURL(file);
        }
    };

    // Rendering Helpers for Conditional Header
    const renderDesktopHeader = () => (
         <header className="chat-header">
                <div className="flex items-center gap-3">
                    <img src="/long_logo.jpeg" alt="Aikon Logo" className="chat-header-logo rounded" />
                    <div className="hidden md:block">
                        <h1 className="font-bold text-white text-sm tracking-wide uppercase">Aikon Studio</h1>
                    </div>
                </div>
                <div className="chat-header-actions">
                     <div className="agent-toggle" title="Enable Autonomous Agent Mode">
                        <span className={`text-[10px] font-bold mr-2 uppercase tracking-wider ${isAgentMode ? 'text-amber-500' : 'text-gray-500'}`}>Agent Mode</span>
                        <button className={`toggle-switch ${isAgentMode ? 'on' : ''}`} onClick={() => { triggerHaptic(); setIsAgentMode(!isAgentMode); }}>
                            <div className="toggle-thumb" />
                        </button>
                    </div>
                    <div className="h-4 w-px bg-white/10 mx-2"></div>
                    <button onClick={startLiveConversation} className="text-amber-400 border border-amber-400/50 hover:bg-amber-500/10 hover:border-amber-400 flex items-center gap-2 transition-all" title="Start Voice Call">
                        <span className="animate-pulse">●</span> Voice
                    </button>
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="theme-toggle-button" title="Toggle Theme">{isDarkMode ? '☀️' : '🌙'}</button>
                    <button onClick={() => setIsCodeCanvasOpen(true)} title="Code Canvas">Code</button>
                    <button onClick={() => setIsSettingsOpen(true)}>Settings</button>
                    <button onClick={() => navigateTo('home')} className="text-red-400 hover:text-red-300">Exit</button>
                </div>
        </header>
    );

    const renderMobileHeader = () => (
         <header className="chat-header mobile">
             <div className="flex items-center gap-3">
                <img src="/short_logo.jpeg" alt="Logo" className="w-8 h-8 rounded shadow-md" />
                {activePersona.name !== 'AikonAI' && (
                    <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded">
                        <span className="text-xs">{activePersona.icon}</span>
                        <span className="text-[10px] font-bold text-white uppercase tracking-wide">{activePersona.name}</span>
                    </div>
                )}
             </div>
             <div className="flex gap-2">
                 <button onClick={() => { triggerHaptic(); startLiveConversation(); }} className="w-9 h-9 rounded bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                     🎙️
                 </button>
                 <button onClick={() => { triggerHaptic(); setIsMobileMenuOpen(true); }} className="w-9 h-9 rounded bg-white/5 text-white flex items-center justify-center border border-white/10">
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
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                        <div className="relative mb-6">
                             <div className="absolute inset-0 bg-amber-500 blur-3xl opacity-10"></div>
                             <img src="/short_logo.jpeg" alt="Aikon" className="w-20 h-20 rounded-2xl shadow-2xl relative z-10" />
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight mb-2">System Ready.</h2>
                         {currentUser && (
                            <p className="text-gray-500 text-xs uppercase tracking-widest mb-8">User: {currentUser.displayName || currentUser.aboutYou}</p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
                            <button className="bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl text-left transition-all flex items-center gap-3 group" onClick={() => { setInput("Analyze the latest trends in AI"); handleSendMessage(); }}>
                                <span className="text-xl group-hover:scale-110 transition-transform">📈</span>
                                <span className="text-sm text-gray-300 group-hover:text-white font-medium">Market Analysis</span>
                            </button>
                            <button className="bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl text-left transition-all flex items-center gap-3 group" onClick={() => { setInput("Generate a python script for data processing"); handleSendMessage(); }}>
                                <span className="text-xl group-hover:scale-110 transition-transform">🐍</span>
                                <span className="text-sm text-gray-300 group-hover:text-white font-medium">Python Scripting</span>
                            </button>
                            <button className="bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl text-left transition-all flex items-center gap-3 group" onClick={() => { setInput("Draft a project proposal for a new app"); handleSendMessage(); }}>
                                <span className="text-xl group-hover:scale-110 transition-transform">📄</span>
                                <span className="text-sm text-gray-300 group-hover:text-white font-medium">Draft Proposal</span>
                            </button>
                            <button className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 p-3 rounded-xl text-left transition-all flex items-center gap-3 group" onClick={startLiveConversation}>
                                <span className="text-xl group-hover:scale-110 transition-transform">🎙️</span>
                                <span className="text-sm text-amber-400 font-medium">Voice Uplink</span>
                            </button>
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

            {/* Desktop Persona Selector (Fixed Position) */}
            {!isMobile && (
                <div className="chat-actions-bar">
                    <div className="chat-actions-inner">
                        <div className="persona-menu-container relative">
                            <button className="active-persona-indicator" onClick={() => setShowPersonaMenu(!showPersonaMenu)}>
                                <span className="text-lg">{activePersona.icon}</span>
                                <span className="font-bold text-xs uppercase tracking-wide">{activePersona.name}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${showPersonaMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            <AnimatePresence>
                                {showPersonaMenu && (
                                    <MotionDiv className="persona-menu" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                                        {allPersonas.map(persona => (
                                            <div key={persona.name} className={`persona-menu-item ${activePersona.name === persona.name ? 'selected' : ''}`} onClick={() => { setActivePersona(persona); setShowPersonaMenu(false); }}>
                                                <span className="icon">{persona.icon}</span>
                                                <span className="text-xs font-bold">{persona.name}</span>
                                            </div>
                                        ))}
                                    </MotionDiv>
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
            <CodeCanvas files={sessionFiles.reduce((acc, f) => ({...acc, [f.name]: f.content}), {})} isVisible={isCodeCanvasOpen} onClose={() => setIsCodeCanvasOpen(false)} />
            
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
