import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { NavigationProps, FileAttachment, Message, Source, Task, ChatListItem, MessageSender, Workflow, WorkflowStep, CanvasFiles, UserProfile, VirtualFile, StructuredToolOutput, Persona, PresentationData, WordData, ExcelData, CodeExecutionHistoryItem, InteractiveChartData } from '../../types';
import { streamMessageToChat, generateImage, editImage, fetchVideoFromUri, generatePlan, runWorkflowStep, performGoogleSearch, browseWebpage, summarizeDocument, generateSpeech, generatePresentationContent, generateWordContent, generateExcelContent, analyzeBrowsedContent, generateVideo, executePythonCode, aikonPersonaInstruction, classifyIntentAndSelectPersona, generateWebsiteCode } from '../../services/geminiService';
import { fetchWeather } from '../../services/weatherService';
import { GenerateVideosOperation, Content, GenerateContentResponse, GoogleGenAI, Modality, GroundingChunk, Blob as GenAI_Blob, LiveServerMessage } from '@google/genai';
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

// Add a global type definition for the aistudio window object to avoid TypeScript errors.
// The `aistudio` property on Window requires a named type `AIStudio` to prevent conflicts with other global declarations.
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
    interface Window {
        aistudio?: AIStudio;
    }
}

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


// Audio processing functions (as per @google/genai guidelines)
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// From @google/genai docs for decoding audio
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


// Helper function to create a WAV file from raw PCM data
function pcmToWav(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Blob {
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeString(view: DataView, offset: number, string: string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // 16 for PCM
    view.setUint16(20, 1, true); // PCM is 1
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // byteRate
    view.setUint16(32, numChannels * (bitsPerSample / 8), true); // blockAlign
    view.setUint16(34, bitsPerSample, true);
    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data
    for (let i = 0; i < dataSize; i++) {
        view.setUint8(44 + i, pcmData[i]);
    }
    
    return new Blob([view], { type: 'audio/wav' });
}

const PERSONAS: Persona[] = [
    {
        name: 'Legal Document Reviewer',
        icon: '📖',
        description: 'Analyzes legal documents for key clauses, risks, and inconsistencies with formal, objective language.',
        systemInstruction: `You are an expert legal document reviewer specializing in INDIAN law. Your role is to carefully read any legal text provided (such as contracts, agreements, pleadings, statutes, or policies) and provide: 1. **Analysis & Explanation** - Summarize the main points in clear, plain English. - Identify key legal implications, obligations, risks, or ambiguities. - Highlight unusual or concerning provisions that deviate from common practice. 2. **Legal Basis & Citations** - Where applicable, cite relevant sections of **Indian statutes, regulations, or case law**. - Make sure citations are accurate and formatted properly. 3. **Practical Guidance** - Explain how the terms may affect the parties involved. - Suggest clarifications or revisions to strengthen the document or reduce risk. - Provide neutral, fact-based insight (not legal advice specific to an individual’s case). 4. **Output Format** - **Summary:** Brief overview of the document’s purpose and scope. - **Key Issues:** Bullet-point list of important clauses, risks, or ambiguities. - **Legal References:** Cite relevant statutes, regulations, or precedent. - **Recommendations:** Practical suggestions for clarification or improvement. At the end of your message clarify that the user should always advise consulting a licensed attorney before acting on the given information.`
    },
    {
        name: 'Study Buddy',
        icon: '🎓',
        description: 'Explains complex topics using fun, cartoon-style images like a helpful friend.',
        systemInstruction: `You are 'Study Buddy', a friendly and fun AI tutor. Your goal is to explain any topic to the user by generating a series of simple, cartoon-style images. You communicate like a friend, using encouraging and easy-to-understand language.

When the user asks you to explain a topic, your primary task is to break it down into key visual concepts and create descriptive prompts for images. Your image prompts MUST specify a 'friendly, simple cartoon style'.

**CRITICAL RULE:** If the user's request can be explained much more effectively with text (like a simple definition, a code snippet, or a math formula), you must first respond with ONLY this exact text: 'This topic could be explained with text much more easily. Do you still want me to use images?'. If the user agrees in their next message, then you will proceed with generating the images.

For all other requests, you MUST respond ONLY with the JSON for the 'create_storyboard' tool call, containing your generated prompts. Do not add any conversational text before or after the JSON tool call.`
    },
    {
        name: 'Writing Assistant',
        icon: '📝',
        description: 'A supportive assistant to help brainstorm, outline, and improve writing with constructive suggestions.',
        systemInstruction: `You are an expert writing assistant specialized in enhancing clarity, conciseness, engagement, grammar, style, and flow. Your goal is to make any given text more effective while preserving the original meaning and voice as much as possible. When I provide you with some text, follow these steps exactly: Analyze the text: Read it carefully and identify areas for improvement, such as awkward phrasing, redundancy, weak structure, or opportunities for stronger impact. Rewrite it: Produce a polished, improved version. Aim to make it more readable and compelling without adding or removing key ideas. Summarize changes: After the improved text, provide a concise bullet-point list (3-5 bullets max) explaining your key improvements. Focus on what you changed and why it helps (e.g., "Shortened sentences for better rhythm and readability"). Output format: Start with the improved text Follow with the summary under a heading "## Improvements Summary".`
    },
    {
        name: 'Fitness Advice',
        icon: '🍎',
        description: 'A motivational fitness coach providing safe, evidence-based fitness and nutrition advice.',
        systemInstruction: `You are an expert fitness coach, nutrition guide, and health educator. Your role is to provide clear, actionable, and safe advice to users who want to improve their fitness, nutrition, and overall health. Be supportive, encouraging, and practical in your guidance. Tailor recommendations to the user’s context (fitness level, goals, preferences, and constraints). Use only verified, evidence-based sources. Cite your sources whenever you provide factual claims, recommendations, or statistics. When giving exercise, nutrition, or wellness advice, always include safety considerations and suggest consulting a qualified professional (such as a physician or certified trainer) for personalized medical guidance. Answer questions across a wide range of fitness topics, including: strength training, cardio, flexibility, recovery, injury prevention, nutrition, supplementation, weight management, and motivation strategies. If the user’s request falls outside safe or science-backed recommendations, politely explain the risks and guide them toward healthier alternatives. Your goal: help the user achieve their fitness goals in a safe, effective, and motivating way while grounding your advice in reliable evidence and proper citations.`
    },
    {
        name: 'Personal Finance Assistant',
        icon: '💲',
        description: 'Provides educational content on budgeting, saving, and general investment principles in a clear, calm tone.',
        systemInstruction: `You are an expert personal finance assistant. You will be given a spreadsheet containing the user’s budget and financial details. Your role is to: 1. **Interpret the budget** – read and understand the spreadsheet categories (income, expenses, savings, debt, investments, etc.). 2. **Answer finance-related questions** – provide clear, tailored answers that reference the user’s own budget data. 3. **Offer best practices** – give guidance based on sound personal finance principles (e.g., budgeting, saving, debt reduction, emergency funds, investing basics). 4. **Stay practical** – ensure explanations are simple, actionable, and adapted to the user’s context. 5. **Maintain neutrality** – do not make speculative investment recommendations or guarantee outcomes. When the user asks a question, combine insights from their budget with general financial best practices to produce helpful, trustworthy advice.`
    },
    {
        name: 'Developer Sandbox',
        icon: '💻',
        description: 'A powerful code interpreter for running Python, managing files, and performing data analysis.',
        systemInstruction: `You are 'Developer Sandbox', a powerful AI code interpreter. Your goal is to help users by writing, executing, and debugging Python code.
- **Environment**: You have a sandboxed Python environment with common libraries like pandas, numpy, and matplotlib. You also have a temporary virtual file system.
- **Tool Usage**: You MUST use the following tools to interact with the environment. Respond ONLY with the tool's JSON object. Do not add any conversational text.
  - \`list_files\`: To see files in the current session.
  - \`read_file\`: To read the content of a file.
  - \`write_file\`: To create or overwrite a file.
  - \`execute_python_code\`: To run Python code.
- **Workflow**:
  1. Understand the user's goal.
  2. If necessary, write code to a file using \`write_file\`.
  3. Execute the code using \`execute_python_code\`.
  4. Analyze the output and present the final answer to the user, or explain the next step if the task is multi-step.
- **Plotting**: If asked to create a plot, use matplotlib. The execution environment will capture the plot as an image and return it.
- **User Interaction**: Be concise. Explain your plan briefly if needed, then use the tools. Present the final result clearly.`
    },
];

const CUSTOM_PERSONAS_STORAGE_KEY = 'aikon-custom-personas';

const DownloadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const WebIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9m-9 9a9 9 0 00-9-9" /></svg>);
const MapIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const ChevronIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>);
const SunIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>);
const MoonIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>);


const SourceDisplay: React.FC<{ sources: Source[] }> = ({ sources }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!sources || sources.length === 0) return null;

    return (
        <div className="mt-3 border-t border-gray-700/50 pt-3">
            <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                className={`sources-toggle-button flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white w-full text-left ${isExpanded ? 'expanded' : ''}`}
                aria-expanded={isExpanded}
            >
                <ChevronIcon />
                Sources ({sources.length})
            </button>
            {isExpanded && (
                <div className="mt-2 space-y-2 pl-4 animate-fade-in" style={{animationDuration: '0.3s'}}>
                    {sources.map((source, index) => (
                        <a
                            key={index}
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="source-link flex items-center gap-2 text-xs text-sky-400 hover:text-sky-300 hover:underline"
                        >
                            {source.type === 'web' ? <WebIcon /> : <MapIcon />}
                            <span className="truncate">{source.title}</span>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Refactored Components from WorkflowBubble ---

const StatusPill: React.FC<{ status: WorkflowStep['status'] }> = ({ status }) => {
    const statusInfo = {
        pending: { text: 'Pending', color: 'bg-gray-500', icon: '🕒' },
        running: { text: 'Running', color: 'bg-blue-500 animate-pulse', icon: '⏳' },
        completed: { text: 'Completed', color: 'bg-green-600', icon: '✅' },
        paused_for_approval: { text: 'Paused', color: 'bg-yellow-500', icon: '⏸️' },
        error: { text: 'Error', color: 'bg-red-600', icon: '❌' },
        denied: { text: 'Denied', color: 'bg-red-700', icon: '🚫' },
    }[status];

    return (
        <div className={`status-pill inline-flex items-center gap-1.5 text-xs font-medium text-white px-2 py-1 rounded-full ${statusInfo.color}`}>
            {statusInfo.icon}
            <span>{statusInfo.text}</span>
        </div>
    );
};

const ToolIcon: React.FC<{ toolName: string }> = ({ toolName }) => {
    const icon = {
        'search_and_summarize': '🌐', 'browse_webpage': '🌐', 'perform_google_search': '🌐',
        'list_files': '📁', 'read_file': '📄', 'write_file': '✍️',
        'execute_python_code': '🐍',
        'create_powerpoint': '📊', 'create_word_document': '📝', 'create_excel_spreadsheet': '📈',
        'finish': '🏁', 'request_user_approval': '🤔',
        'generate_website': '🌐',
    }[toolName] || '⚙️';
    return <span className="text-xl" title={toolName}>{icon}</span>;
};

const StepIcon: React.FC<{ status: WorkflowStep['status']; isLastStep: boolean }> = ({ status, isLastStep }) => {
    let iconContent, iconClass;

    if (status === 'running') {
        iconContent = <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></div>;
        iconClass = "bg-blue-900/50 border-blue-500";
    } else if (status === 'completed') {
        iconContent = <svg className="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>;
        iconClass = "bg-green-900/50 border-green-600";
    } else if (status === 'error' || status === 'denied') {
        iconContent = <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>;
        iconClass = "bg-red-900/50 border-red-600";
    } else { // pending or paused
        iconContent = <div className="w-2.5 h-2.5 bg-gray-500 rounded-full"></div>;
        iconClass = "bg-gray-800 border-gray-600";
    }
    
    return (
        <div className="step-icon-wrapper flex flex-col items-center mr-4">
            <div className={`step-icon flex items-center justify-center w-8 h-8 rounded-full border-2 ${iconClass}`}>
                {iconContent}
            </div>
            {!isLastStep && <div className="step-connector w-0.5 h-full bg-gray-600"></div>}
        </div>
    );
};


// --- Refactored Component from PptPreviewCard ---
const PptIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a2 2 0 00-2 2v1H6a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2V4a2 2 0 00-2-2zM8 4h4v1H8V4z" />
        <path d="M7 9a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm1 3a1 1 0 100 2h2a1 1 0 100-2H8z" />
    </svg>
);


// --- Website Preview Component ---

const WebsitePreview: React.FC<{
    htmlContent: string;
    isVisible: boolean;
    onClose: () => void;
}> = ({ htmlContent, isVisible, onClose }) => {
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

    const handleDownload = () => {
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'website.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="fixed inset-0 z-[200] flex flex-col bg-gray-900"
                    initial={{ opacity: 0, y: '100%' }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: '100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                    {/* Toolbar */}
                    <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 shadow-md">
                        <div className="flex items-center gap-4">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <span className="text-amber-400">✨</span> Aikon Web Designer
                            </h3>
                            <div className="flex bg-gray-700 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('desktop')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'desktop' ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Desktop
                                </button>
                                <button
                                    onClick={() => setViewMode('mobile')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'mobile' ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Mobile
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleDownload}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg text-sm transition-colors"
                            >
                                Download Code
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    {/* Viewport Area */}
                    <div className="flex-grow bg-gray-900 flex items-center justify-center overflow-hidden relative">
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                             backgroundImage: 'radial-gradient(#444 1px, transparent 1px)',
                             backgroundSize: '20px 20px'
                        }}></div>
                        
                        <motion.div
                            layout
                            className={`bg-white transition-all duration-500 ease-in-out shadow-2xl overflow-hidden ${
                                viewMode === 'mobile' 
                                    ? 'w-[375px] h-[812px] rounded-[40px] border-[8px] border-gray-800' 
                                    : 'w-full h-full'
                            }`}
                        >
                            <iframe
                                srcDoc={htmlContent}
                                title="Generated Website"
                                className="w-full h-full border-0"
                                sandbox="allow-scripts" // Allow scripts for interactivity
                            />
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};


// --- Main Page and Sub-components ---

const MessageLogItem: React.FC<{
    message: Message;
    isLast: boolean;
    userProfile: Partial<UserProfile> | null;
    onApproveWorkflow: (messageId: string) => void;
    onDenyWorkflow: (messageId: string) => void;
    theme: 'light' | 'dark';
    onViewWebsite: (html: string) => void; // New prop
}> = memo(({ message, isLast, userProfile, onApproveWorkflow, onDenyWorkflow, theme, onViewWebsite }) => {

    const messageContentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messageContentRef.current) {
            const codeElements = messageContentRef.current.querySelectorAll('pre code');
            codeElements.forEach((el) => {
                // Fix: Check if hljs is available on the window object before using it.
                if (typeof hljs !== 'undefined') {
                    hljs.highlightElement(el as HTMLElement);
                }
            });
        }
    }, [message.text]);
    
    const renderMessageContent = () => {
        if (message.sender === 'user') {
            return (
                <div className="message-content">
                    {message.attachments && message.attachments.length > 0 && (
                        <div className="user-attachments-container mb-2">
                            {message.attachments.map((file, index) => (
                                <div key={index}>
                                    {file.mimeType.startsWith('image/') ? (
                                        <img src={`data:${file.mimeType};base64,${file.base64}`} alt={file.name} />
                                    ) : (
                                        <div className="file-attachment-chip">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                                            <span>{file.name}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                     <p>{message.text}</p>
                </div>
            );
        }

        // AI Message Rendering
        const segments = message.segments || parseMarkdown(message.text);
        const streaming = isLast && message.status === 'streaming';
        
        return (
            <div ref={messageContentRef} className={`message-content ${streaming ? 'streaming' : ''}`}
                // Use dangerouslySetInnerHTML for markdown-to-HTML rendering
                // The output is sanitized by only allowing specific tags/attributes via the rendering functions
                dangerouslySetInnerHTML={{
                    __html: segments.map(seg => 
                        seg.type === 'paragraph' ? renderParagraph(seg.content) : '' // Code blocks rendered separately
                    ).join('')
                }}
            />
        );
    };

    const bubbleVariants: Variants = {
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25 } }
    };

    return (
        <motion.div
            className={`message-log-item ${message.sender}`}
            variants={bubbleVariants}
            initial="hidden"
            animate="visible"
            layout="position"
        >
            <div className="message-bubble-wrapper">
                {message.sender === 'ai' && (
                    <div className="message-avatar ai-avatar">
                        <img src="/short_logo.jpeg" alt="AikonAI Avatar" />
                    </div>
                )}
                <div className={`message-content-wrapper ${message.workflow || message.generatedFile ? 'has-special-content' : ''}`}>
                    {renderMessageContent()}
                    {message.segments?.filter(seg => seg.type === 'code').map((seg, i) =>
                        seg.type === 'code' && <CodeBlock key={i} language={seg.language} code={seg.content} filename={seg.filename}/>
                    )}
                    {message.weatherData && <WeatherCard data={message.weatherData} />}
                    {message.tasks && <TaskList tasks={message.tasks} onTaskUpdate={()=>{}} />}
                    {message.workflow && (
                        <WorkflowBubble 
                            workflow={message.workflow} 
                            messageId={message.id}
                            onApprove={onApproveWorkflow}
                            onDeny={onDenyWorkflow}
                        />
                    )}
                     {message.generatedImage && (
                        <div className="generated-image-container mt-2">
                             {message.generatedImage.isLoading ? (
                                <div className={`skeleton-loader aspect-${message.generatedImage.aspectRatio?.replace(':', '-') || '1-1'}`}>
                                    <span>Generating image of "{message.generatedImage.prompt}"...</span>
                                </div>
                            ) : (
                                <img src={message.generatedImage.url} alt={message.generatedImage.prompt} className="rounded-lg max-w-full" />
                            )}
                        </div>
                    )}
                     {message.editedImage && (
                        <div className="edited-image-container mt-2 flex gap-2">
                            <div className="w-1/2">
                                <span className="text-xs text-gray-400">Before</span>
                                <img src={message.editedImage.beforeUrl} className="rounded-lg w-full" alt="Original" />
                            </div>
                            <div className="w-1/2">
                                 <span className="text-xs text-gray-400">After</span>
                                {message.editedImage.isLoading ? (
                                    <div className="skeleton-loader aspect-1-1">
                                        <span>Editing...</span>
                                    </div>
                                ) : (
                                    <img src={message.editedImage.afterUrl} className="rounded-lg w-full" alt={message.editedImage.prompt} />
                                )}
                            </div>
                        </div>
                    )}
                    {message.generatedVideo && (
                        <div className="generated-video-container mt-2">
                            {message.generatedVideo.status === 'generating' ? (
                                <div className="skeleton-loader aspect-16-9">
                                    <span>Generating video of "{message.generatedVideo.prompt}"... This may take a few minutes.</span>
                                </div>
                            ) : message.generatedVideo.status === 'completed' && message.generatedVideo.url ? (
                                <video src={message.generatedVideo.url} controls className="rounded-lg w-full"></video>
                            ) : (
                                <p className="text-red-400">Video generation failed.</p>
                            )}
                        </div>
                    )}
                     {message.storyboardImages && (
                        <div className="storyboard-grid">
                            {message.storyboardImages.map((img, index) => (
                                <div key={index} className="storyboard-panel">
                                    {img.url === 'loading' ? (
                                        <div className="skeleton-loader aspect-1-1"><span>Generating...</span></div>
                                    ) : img.url === 'error' ? (
                                        <div className="skeleton-loader aspect-1-1"><span>Failed to load</span></div>
                                    ) : (
                                        <img src={img.url} alt={img.prompt} />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                     {message.audioUrl && (
                        <audio controls src={message.audioUrl} className="w-full mt-2"></audio>
                    )}
                    {message.codeExecutionResult && (
                        <div className="code-execution-result">
                            <div className="code-execution-header">Executed Code</div>
                            <div className="code-execution-code"><CodeBlock language="python" code={message.codeExecutionResult.code} /></div>
                            <div className="code-execution-header">Output</div>
                            <pre className="code-execution-output">
                                {message.codeExecutionResult.output.startsWith('data:image/png;base64,') 
                                    ? <img src={message.codeExecutionResult.output} alt="Generated plot" /> 
                                    : <code>{message.codeExecutionResult.output}</code>
                                }
                            </pre>
                        </div>
                    )}
                    {message.generatedFile && (
                        <>
                         {message.generatedFile.type === 'pptx' ? (
                            <PptPreviewCard 
                                filename={message.generatedFile.filename}
                                data={message.generatedFile.data as PresentationData}
                                imageUrl={message.generatedFile.previewImageUrl}
                                isLoading={message.generatedFile.isPreviewLoading}
                            />
                         ) : (
                             <div className="file-generated-output">
                                 <p>Generated file: <span>{message.generatedFile.filename}</span></p>
                                <button className="composer-icon-button" onClick={() => {
                                    if (message.generatedFile?.type === 'docx' && message.generatedFile.data) {
                                        createDocxFile(message.generatedFile.data as WordData);
                                    } else if (message.generatedFile?.type === 'xlsx' && message.generatedFile.data) {
                                        createXlsxFile(message.generatedFile.data as ExcelData);
                                    } else if (message.generatedFile?.type === 'pdf' && message.generatedFile.data) {
                                        createPdfFile(message.generatedFile.data as WordData); // Reuses WordData structure
                                    }
                                }}>
                                    <DownloadIcon />
                                </button>
                             </div>
                         )}
                         </>
                    )}
                    {message.generatedQRCode && (
                         <div className="qr-code-output">
                            <img src={message.generatedQRCode.dataUrl} alt="Generated QR Code" />
                             <p>{message.generatedQRCode.text}</p>
                         </div>
                    )}
                    {message.interactiveChartData && (
                        <InteractiveChart chartData={message.interactiveChartData} theme={theme} />
                    )}
                    {/* Website Generation Output */}
                    {message.generatedWebsite && (
                        <div className="mt-3 bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                            <div className="p-4 bg-gradient-to-r from-gray-800 to-gray-900 flex justify-between items-center">
                                <div>
                                    <h4 className="text-white font-bold flex items-center gap-2">
                                        <span className="text-xl">🌐</span> 
                                        Website Generated
                                    </h4>
                                    <p className="text-xs text-gray-400 mt-0.5">Topic: {message.generatedWebsite.topic}</p>
                                </div>
                                {message.generatedWebsite.isLoading ? (
                                    <div className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full animate-pulse">
                                        Coding...
                                    </div>
                                ) : (
                                    <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                                        Ready
                                    </div>
                                )}
                            </div>
                            {!message.generatedWebsite.isLoading && (
                                <div className="p-4 bg-gray-900/50">
                                    <button 
                                        onClick={() => onViewWebsite(message.generatedWebsite!.htmlContent)}
                                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2"
                                    >
                                        <span>🚀</span> Launch Preview
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {message.sources && <SourceDisplay sources={message.sources} />}
                </div>
                 {message.sender === 'user' && (
                    <div className="message-avatar user-avatar">
                        {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                )}
            </div>
        </motion.div>
    );
});

const ChatComposer: React.FC<{
    onSendMessage: (message: string, attachments: FileAttachment[]) => void;
    onStartLiveConversation: () => void;
    isSending: boolean;
    isAgentModeEnabled: boolean;
}> = memo(({ onSendMessage, onStartLiveConversation, isSending, isAgentModeEnabled }) => {
    const [message, setMessage] = useState('');
    const [attachments, setAttachments] = useState<FileAttachment[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSendMessage = () => {
        const trimmedMessage = message.trim();
        if (trimmedMessage || attachments.length > 0) {
            onSendMessage(trimmedMessage, attachments);
            playSound('/send_message.mp3', 0.2);
            setMessage('');
            setAttachments([]);
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const newAttachments: FileAttachment[] = [];
            
            files.forEach((file: File) => {
                 if (attachments.length + newAttachments.length >= 5) {
                    alert("You can attach a maximum of 5 files.");
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = (event.target?.result as string).split(',')[1];
                    newAttachments.push({ name: file.name, base64, mimeType: file.type });
                    if(newAttachments.length === files.length) {
                        setAttachments(prev => [...prev, ...newAttachments]);
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [message]);

    return (
        <div className="chat-composer-container">
             {attachments.length > 0 && (
                <div className="composer-file-preview">
                    <div className="composer-file-preview-inner">
                         <div className="composer-multi-file-container">
                             {attachments.map((file, index) => (
                                 <div key={index} className="composer-file-thumb">
                                     {file.mimeType.startsWith('image/') ? (
                                        <img src={`data:${file.mimeType};base64,${file.base64}`} alt={file.name} />
                                     ) : (
                                         <div className="flex items-center justify-center h-full text-xs p-1 text-center">{file.name}</div>
                                     )}
                                     <button onClick={() => removeAttachment(index)} className="remove-attachment-btn">&times;</button>
                                 </div>
                             ))}
                         </div>
                         <button onClick={() => setAttachments([])} className="composer-icon-button">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                </div>
            )}
            <div className="chat-composer">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    multiple
                    accept="image/*,text/*,.pdf,.doc,.docx,.csv"
                    style={{ display: 'none' }}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="composer-icon-button"
                    disabled={isSending || isAgentModeEnabled}
                    aria-label="Attach file"
                    title={isAgentModeEnabled ? "File attachments disabled in Agent Mode" : "Attach file"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                </button>
                 <button
                    onClick={onStartLiveConversation}
                    className="composer-icon-button"
                    disabled={isSending}
                    aria-label="Start Live Conversation"
                    title="Start Live Conversation"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                       <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </button>
                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message AikonAI..."
                    className="composer-textarea"
                    rows={1}
                    disabled={isSending}
                    aria-label="Chat input"
                ></textarea>
                <button
                    onClick={handleSendMessage}
                    disabled={isSending || (!message.trim() && attachments.length === 0)}
                    className="composer-icon-button composer-send-button"
                    aria-label="Send message"
                >
                    {isSending ? (
                        <div className="w-5 h-5 border-2 border-t-transparent border-black rounded-full animate-spin"></div>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
});


const WorkflowBubble: React.FC<{ 
    workflow: Workflow; 
    messageId: string;
    onApprove: (messageId: string) => void;
    onDeny: (messageId:string) => void;
}> = memo(({ workflow, messageId, onApprove, onDeny }) => {

    const renderToolOutput = (output: StructuredToolOutput) => {
        if (!output) return <p className="text-gray-400 text-sm italic">No output was produced.</p>;

        switch(output.type) {
            case 'search_results':
                return (
                    <ul className="list-disc pl-5 space-y-1">
                        {output.results.slice(0, 3).map((res, i) => (
                            <li key={i}><a href={res.link} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline text-sm">{res.title}</a></li>
                        ))}
                    </ul>
                );
            case 'browsed_content':
                return <p className="text-sm text-gray-300 truncate">{output.content}</p>
            case 'file_generated':
                return <p className="text-sm text-green-400 font-mono">{output.message}</p>;
            case 'plot':
                return <img src={output.dataUrl} alt="Generated Plot" className="max-w-full rounded-md" />;
            case 'text':
            default:
                return <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">{output.content}</pre>;
        }
    };
    
    return (
        <div className="workflow-container">
            <div className="workflow-header flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-xl">🤖</div>
                <div>
                    <h3 className="font-bold text-white text-lg">Agent Mode: Running Workflow</h3>
                    <p className="text-gray-400 text-sm">Goal: "{workflow.goal}"</p>
                </div>
            </div>
            
             {workflow.status === 'paused_for_approval' && (
                <div className="workflow-confirmation-container">
                    <h4 className="workflow-confirmation-header">Approval Required</h4>
                    <p className="workflow-confirmation-goal mb-4">{workflow.steps.find(s => s.status === 'paused_for_approval')?.tool_call?.args.question}</p>
                    <div className="workflow-confirmation-buttons">
                        <button onClick={() => onDeny(messageId)} className="deny-btn">Deny</button>
                        <button onClick={() => onApprove(messageId)} className="approve-btn">Approve</button>
                    </div>
                </div>
            )}
            
            <div className="workflow-steps-container relative">
                {workflow.steps.map((step, index) => (
                    <div key={index} className="workflow-step flex">
                        <StepIcon status={step.status} isLastStep={index === workflow.steps.length - 1} />
                        <div className="workflow-step-content pb-6 w-full">
                            <div className="flex justify-between items-start">
                                <p className="font-semibold text-gray-200">{step.summary}</p>
                                <StatusPill status={step.status} />
                            </div>
                            {step.tool_call && (
                                <div className="tool-call-info flex items-center gap-2 mt-1 text-sm text-gray-400">
                                    <ToolIcon toolName={step.tool_call.name} />
                                    <span className="font-mono">{step.tool_call.name}</span>
                                </div>
                            )}
                            {step.tool_output && (
                                <div className="workflow-step-tool-output">
                                    <details>
                                        <summary>View Tool Output</summary>
                                        <div className="output-content">
                                            {renderToolOutput(step.tool_output)}
                                        </div>
                                    </details>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
             {workflow.finalContent && workflow.status === 'completed' && (
                <div className="workflow-final-output mt-4 border-t border-green-700 pt-4">
                     <h4 className="text-green-400 font-bold mb-2">Final Result</h4>
                     <p className="text-gray-200 whitespace-pre-wrap">{workflow.finalContent}</p>
                </div>
            )}
        </div>
    );
});

const PptPreviewCard: React.FC<{
    filename: string;
    data: PresentationData;
    imageUrl?: string;
    isLoading?: boolean;
}> = memo(({ filename, data, imageUrl, isLoading }) => {
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            await createPptxFile(data, filename.replace('.pptx', ''));
        } catch (error) {
            console.error("Failed to generate PPTX:", error);
            alert("Sorry, there was an error creating the presentation file.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="ppt-preview-card">
            <div className="ppt-preview-image-container">
                {isLoading ? (
                    <div className="skeleton-loader aspect-16-9"><span>Generating preview...</span></div>
                ) : imageUrl ? (
                    <img src={imageUrl} alt="Presentation Preview" className="ppt-preview-image" />
                ) : (
                    <div className="ppt-preview-no-image">
                        <PptIcon />
                    </div>
                )}
            </div>
            <div className="ppt-preview-content">
                <div className="ppt-preview-header">
                    <PptIcon />
                    <span>Presentation</span>
                </div>
                <h4 className="ppt-preview-title">{filename}</h4>
            </div>
            <div className="ppt-preview-footer">
                <button 
                    className="ppt-preview-download-btn"
                    onClick={handleDownload}
                    disabled={isDownloading}
                >
                    {isDownloading ? (
                         <div className="w-5 h-5 border-2 border-t-transparent border-black rounded-full animate-spin"></div>
                    ) : (
                        <DownloadIcon />
                    )}
                    <span>{isDownloading ? 'Generating...' : 'Download .pptx'}</span>
                </button>
            </div>
        </div>
    );
});

const TypingIndicator: React.FC<{ persona: string, task: string | null }> = memo(({ persona, task }) => {
    
    const getTaskSpecificClass = () => {
        switch (task) {
            case 'generate_image':
            case 'edit_image':
            case 'create_storyboard':
                return 'task-image-gen';
            case 'browse_webpage':
            case 'perform_google_search':
                return 'task-browsing';
            case 'workflow':
                return 'task-workflow';
            case 'generate_website':
                return 'task-workflow'; // Reuse same animation
            default:
                return '';
        }
    }
    
    return (
        <div className={`typing-indicator persona-${persona.toLowerCase().replace(/\s+/g, '-')} ${getTaskSpecificClass()}`}>
            <span></span>
            <span></span>
            <span></span>
        </div>
    );
});

const WelcomeScreen: React.FC<{ onActionClick: (prompt: string, files?: FileAttachment[]) => void; isAgentMode: boolean; }> = memo(({ onActionClick, isAgentMode }) => {
    
    const actions = [
        { text: "Explain quantum computing", icon: "🔬" },
        { text: "Draft a startup pitch deck", icon: "💡", agentOnly: true },
        { text: "Make a portfolio website for me", icon: "🌐" },
        { text: "Write a Python script for web scraping", icon: "💻", agentOnly: true },
    ];

    return (
        <div className="chat-welcome-screen">
            <img src="/short_logo.jpeg" alt="AikonAI Logo" className="welcome-logo" />
            <h1 className="welcome-title">AikonAI</h1>
            <div className="welcome-actions">
                {actions.map((action) => (
                    <button 
                        key={action.text} 
                        className="action-pill"
                        onClick={() => onActionClick(action.text)}
                        disabled={isAgentMode && !action.agentOnly}
                    >
                        {action.icon}
                        <span>{action.text}</span>
                    </button>
                ))}
            </div>
        </div>
    );
});

const AikonChatPage: React.FC<NavigationProps> = ({ navigateTo }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messageLogRef = useRef<HTMLDivElement>(null);
    const [chatHistory, setChatHistory] = useState<Content[]>([]);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isCodeCanvasVisible, setIsCodeCanvasVisible] = useState(false);
    const [codeHistoryPanelVisible, setCodeHistoryPanelVisible] = useState(false);
    const [codeHistory, setCodeHistory] = useState<CodeExecutionHistoryItem[]>([]);
    
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    const [activePersona, setActivePersona] = useState<Persona>({ name: 'AikonAI', icon: '🤖', description: 'Default Assistant', systemInstruction: aikonPersonaInstruction });
    const [customPersonas, setCustomPersonas] = useState<Persona[]>([]);
    const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
    
    const [isAgentMode, setIsAgentMode] = useState(false);
    const [sessionFiles, setSessionFiles] = useState<VirtualFile[]>([]);
    
    // Live Conversation State
    const [isLive, setIsLive] = useState(false);
    const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    let nextStartTime = 0;
    
    const { currentUser, logout, updateCurrentUser } = useAuth();
    const userProfile = currentUser; // Assuming currentUser is the UserProfile object
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    
    // New state for website preview
    const [websitePreviewContent, setWebsitePreviewContent] = useState<string | null>(null);

    // Initial setup
    useEffect(() => {
        // Apply theme to body
        document.body.className = `${theme}-theme-chat`;
        
        // Fetch location
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            (err) => {
                console.warn(`Could not get location: ${err.message}`);
            }
        );
        
        // Load custom personas from local storage
        try {
            const storedPersonas = localStorage.getItem(CUSTOM_PERSONAS_STORAGE_KEY);
            if (storedPersonas) {
                setCustomPersonas(JSON.parse(storedPersonas));
            }
        } catch (e) {
            console.error("Failed to load custom personas:", e);
        }

    }, [theme]);
    
    // Scroll to bottom of message log
    useEffect(() => {
        if (messageLogRef.current) {
            messageLogRef.current.scrollTop = messageLogRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (message: string, attachments: FileAttachment[] = []) => {
        if (isSending) return;

        setIsSending(true);
        setError(null);
        
        const userMessage: Message = {
            id: `user-${Date.now()}`,
            text: message,
            sender: 'user',
            timestamp: new Date(),
            attachments: attachments,
        };
        
        setMessages(prev => [...prev, userMessage]);
        
        const aiResponsePlaceholder: Message = {
            id: `ai-${Date.now()}`,
            text: '',
            sender: 'ai',
            timestamp: new Date(),
            status: 'streaming',
        };
        setMessages(prev => [...prev, aiResponsePlaceholder]);

        try {
            // Automatic Persona Switching Logic
            let personaForThisTurn = activePersona;
            if (activePersona.name === 'AikonAI' && !isAgentMode && message.trim().length > 0) {
                const determinedPersonaName = await classifyIntentAndSelectPersona(message);
                const newPersona = [...PERSONAS, ...customPersonas].find(p => p.name === determinedPersonaName);
                if (newPersona && newPersona.name !== 'AikonAI') {
                    personaForThisTurn = newPersona;
                    setActivePersona(newPersona); // Update state for UI indication
                }
            }
            
            const { stream, historyWithUserMessage } = await streamMessageToChat(
                chatHistory,
                message,
                attachments,
                location,
                userProfile,
                undefined, // No chat continuation for now
                personaForThisTurn.systemInstruction,
                isAgentMode
            );
            
            setChatHistory(historyWithUserMessage);
            
            let fullResponseText = '';
            let toolCallObject: any = null;
            let isBufferingForToolCall = false;
            let streamedText = '';

            for await (const chunk of stream) {
                const chunkText = chunk.text;
                if (!chunkText) continue;

                fullResponseText += chunkText;

                // Once we detect a potential tool call (by finding a '{'), stop streaming to the UI and buffer everything.
                if (!isBufferingForToolCall && fullResponseText.includes('{')) {
                    isBufferingForToolCall = true;
                }

                if (!isBufferingForToolCall) {
                    streamedText = fullResponseText;
                    setMessages(prev =>
                        prev.map(m =>
                            m.id === aiResponsePlaceholder.id
                                ? { ...m, text: streamedText, segments: parseMarkdown(streamedText) }
                                : m
                        )
                    );
                }
            }

            // After the stream has finished, process the full response
            if (isBufferingForToolCall) {
                try {
                    const startIndex = fullResponseText.indexOf('{');
                    const endIndex = fullResponseText.lastIndexOf('}');
                    if (startIndex !== -1 && endIndex > startIndex) {
                        const jsonString = fullResponseText.substring(startIndex, endIndex + 1);
                        const parsed = JSON.parse(jsonString);
                        if (parsed.tool_call) {
                            toolCallObject = parsed;
                            const textBeforeToolCall = fullResponseText.substring(0, startIndex).trim();
                            setMessages(prev =>
                                prev.map(m =>
                                    m.id === aiResponsePlaceholder.id
                                        ? { ...m, text: textBeforeToolCall, segments: parseMarkdown(textBeforeToolCall), status: 'sent' }
                                        : m
                                )
                            );
                        }
                    }
                } catch (e) {
                    console.warn("Could not parse potential tool call from buffer. Treating response as text.", e);
                    toolCallObject = null;
                }
            }
            
            if (toolCallObject) {
                await handleToolCall(toolCallObject, aiResponsePlaceholder.id, attachments);
            } else {
                // If no tool call was found (or if parsing failed), render the full text.
                const finalHistory = [...historyWithUserMessage, { role: 'model', parts: [{ text: fullResponseText }] }];
                setChatHistory(finalHistory);
                setMessages(prev =>
                    prev.map(m =>
                        m.id === aiResponsePlaceholder.id
                            ? { ...m, text: fullResponseText, segments: parseMarkdown(fullResponseText), status: 'sent' }
                            : m
                    )
                );
            }
            
        } catch (error) {
             console.error("Error during chat:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            setError(errorMessage);
            setMessages(prev =>
                prev.map(m =>
                    m.id === aiResponsePlaceholder.id
                        ? { ...m, text: `Sorry, I encountered an error: ${errorMessage}`, status: 'sent' }
                        : m
                )
            );
        } finally {
            setIsSending(false);
        }
    };
    
    // Simplified tool call handling
    const handleToolCall = async (toolCall: any, messageId: string, attachments: FileAttachment[]) => {
        const { tool_call, ...args } = toolCall;
        
        let toolResult = 'Tool call received.';
        let updatedMessage: Partial<Message> = { text: `Using tool: \`${tool_call}\`...`};

        setMessages(prev => prev.map(m => m.id === messageId ? {...m, ...updatedMessage, status: 'sent'} : m));

        try {
            switch (tool_call) {
                case 'get_weather':
                    const weatherData = await fetchWeather(args.city);
                     if ('error' in weatherData) {
                        updatedMessage = { text: weatherData.error };
                    } else {
                        updatedMessage = { text: `Here is the weather for ${weatherData.city}.`, weatherData: weatherData };
                    }
                    break;
                case 'generate_image':
                    updatedMessage.generatedImage = { prompt: args.prompt, isLoading: true, aspectRatio: '1:1' };
                    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...updatedMessage, status: 'sent'} : m));
                    const imageUrl = await generateImage(args.prompt);
                    updatedMessage.generatedImage.url = imageUrl || undefined;
                    updatedMessage.generatedImage.isLoading = false;
                    updatedMessage.text = imageUrl ? `Here is the image you requested for "${args.prompt}"` : "Sorry, I couldn't generate the image.";
                    break;
                case 'edit_image':
                    const imageToEdit = attachments.find(f => f.mimeType.startsWith('image/'));
                    if (!imageToEdit) {
                        updatedMessage.text = "You need to upload an image to edit it.";
                        break;
                    }
                    updatedMessage.editedImage = { beforeUrl: `data:${imageToEdit.mimeType};base64,${imageToEdit.base64}`, prompt: args.prompt, isLoading: true };
                     setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...updatedMessage, status: 'sent'} : m));
                    const editedUrl = await editImage(imageToEdit, args.prompt);
                    updatedMessage.editedImage.afterUrl = editedUrl || undefined;
                    updatedMessage.editedImage.isLoading = false;
                     updatedMessage.text = editedUrl ? `Here's the edited image based on your request: "${args.prompt}"` : "Sorry, I couldn't edit the image.";
                    break;
                 case 'generate_video':
                    updatedMessage.generatedVideo = { prompt: args.prompt, status: 'generating' };
                    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...updatedMessage, status: 'sent'} : m));
                    
                    if (window.aistudio) {
                        const hasKey = await window.aistudio.hasSelectedApiKey();
                        if (!hasKey) {
                            await window.aistudio.openSelectKey();
                        }
                    }

                    const operation = await generateVideo(args.prompt);
                    if (operation) {
                        let opResult = operation;
                        while (!opResult.done) {
                            await new Promise(resolve => setTimeout(resolve, 5000));
                            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                            opResult = await ai.operations.getVideosOperation({ operation: opResult });
                        }
                        const videoUri = opResult.response?.generatedVideos?.[0]?.video?.uri;
                        if (videoUri) {
                            const videoBlob = await fetchVideoFromUri(videoUri);
                            const videoUrl = URL.createObjectURL(videoBlob);
                            updatedMessage.generatedVideo = { prompt: args.prompt, status: 'completed', url: videoUrl };
                        } else {
                             updatedMessage.generatedVideo = { prompt: args.prompt, status: 'error' };
                        }
                    } else {
                         updatedMessage.generatedVideo = { prompt: args.prompt, status: 'error' };
                    }
                    updatedMessage.text = updatedMessage.generatedVideo.status === 'completed' ? `Here is the video for "${args.prompt}"` : "Sorry, video generation failed.";
                    break;
                case 'summarize_document':
                    const docToSummarize = attachments.find(f => f.mimeType.startsWith('text/'));
                    if (!docToSummarize) {
                        updatedMessage.text = "Please upload a text document to summarize.";
                        break;
                    }
                    const content = atob(docToSummarize.base64);
                    const summary = await summarizeDocument(content);
                    updatedMessage.text = summary;
                    break;
                case 'text_to_speech':
                    const audioBase64 = await generateSpeech(args.text);
                    if (audioBase64) {
                        const audioBytes = decode(audioBase64);
                        const audioBlob = pcmToWav(audioBytes, 24000, 1, 16);
                        const audioUrl = URL.createObjectURL(audioBlob);
                        updatedMessage.audioUrl = audioUrl;
                        updatedMessage.text = `Here is the audio for: "${args.text}"`;
                    } else {
                        updatedMessage.text = "Sorry, I couldn't generate the speech.";
                    }
                    break;
                case 'create_storyboard':
                    const prompts: string[] = args.prompts || [];
                    if (prompts.length === 0) {
                        updatedMessage.text = "I need some prompts to create a storyboard.";
                        break;
                    }
                    // Show placeholders
                    updatedMessage.storyboardImages = prompts.map(p => ({ prompt: p, url: 'loading' }));
                    updatedMessage.text = `Understood! I'll create a storyboard for you.`;
                    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...updatedMessage, status: 'sent'} : m));

                    // Generate images
                    const imageUrls = await Promise.all(
                        prompts.map(p => generateImage(p, '1:1'))
                    );
                    
                    updatedMessage.storyboardImages = prompts.map((p, i) => ({
                        prompt: p,
                        url: imageUrls[i] || 'error',
                    }));
                    updatedMessage.text = `Here is the storyboard for "${prompts[0]}"...`;
                    break;
                 case 'create_powerpoint':
                    const pptData = await generatePresentationContent(args.topic, args.num_slides || 5);
                    if ('error' in pptData) {
                        updatedMessage.text = `Error: ${pptData.error}`;
                    } else {
                        updatedMessage.text = `I have generated a PowerPoint presentation on "${args.topic}". You can download it now.`;
                        updatedMessage.generatedFile = {
                            filename: `${args.topic}.pptx`,
                            message: `Generated presentation on ${args.topic}`,
                            data: pptData,
                            type: 'pptx',
                            isPreviewLoading: true
                        };
                        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...updatedMessage, status: 'sent'} : m));
                        // Generate a preview image for the first slide
                        const previewPrompt = `Create a single, visually appealing title slide image for a presentation titled "${args.topic}". Style: professional, modern, minimalist.`;
                        const previewUrl = await generateImage(previewPrompt, '16:9');
                        updatedMessage.generatedFile.previewImageUrl = previewUrl || undefined;
                        updatedMessage.generatedFile.isPreviewLoading = false;
                    }
                    break;
                case 'create_word_document':
                    const wordData = await generateWordContent(args.topic, args.sections);
                     if ('error' in wordData) {
                        updatedMessage.text = `Error: ${wordData.error}`;
                    } else {
                         updatedMessage.text = `I have generated a Word document titled "${wordData.title}".`;
                         updatedMessage.generatedFile = { filename: `${wordData.title}.docx`, message: `Generated document`, data: wordData, type: 'docx' };
                    }
                    break;
                case 'create_excel_spreadsheet':
                    const excelData = await generateExcelContent(args.data_description, args.columns);
                     if ('error' in excelData) {
                        updatedMessage.text = `Error: ${excelData.error}`;
                    } else {
                         updatedMessage.text = `I have generated an Excel file named "${args.filename}.xlsx".`;
                         updatedMessage.generatedFile = { filename: `${args.filename}.xlsx`, message: 'Generated spreadsheet', data: { ...excelData, filename: args.filename }, type: 'xlsx' };
                    }
                    break;
                case 'create_pdf_document':
                    const pdfContentData = await generateWordContent(args.topic, args.sections); // Use Word structure for content
                    if ('error' in pdfContentData) {
                        updatedMessage.text = `Error: ${pdfContentData.error}`;
                    } else {
                        updatedMessage.text = `I have generated a PDF document titled "${pdfContentData.title}".`;
                        updatedMessage.generatedFile = { filename: `${pdfContentData.title}.pdf`, message: 'Generated PDF', data: pdfContentData, type: 'pdf' };
                    }
                    break;
                case 'generate_qr_code':
                    const qrDataUrl = await new Promise<string>((resolve) => {
                        QRCode.toDataURL(args.text, { width: 256 }, (err: any, url: string) => resolve(url));
                    });
                    updatedMessage.generatedQRCode = { text: args.text, dataUrl: qrDataUrl };
                    updatedMessage.text = `Here is the QR code for "${args.text}"`;
                    break;
                case 'initiate_workflow':
                    updatedMessage.text = "Starting autonomous workflow...";
                    updatedMessage.workflow = { goal: args.goal, plan: [], steps: [], status: 'running', finalContent: null };
                    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...updatedMessage, status: 'sent'} : m));
                    await runWorkflow(args.goal, messageId);
                    return; // Return early as runWorkflow handles its own message updates
                // --- Developer Sandbox Tools ---
                case 'list_files':
                    const fileList = sessionFiles.length > 0 ? sessionFiles.map(f => f.name).join('\n') : "No files in session.";
                    updatedMessage.text = `Current files:\n${fileList}`;
                    break;
                case 'read_file':
                    const fileToRead = sessionFiles.find(f => f.name === args.filename);
                    updatedMessage.text = fileToRead ? `Content of ${args.filename}:\n\n${fileToRead.content}` : `Error: File not found: ${args.filename}`;
                    break;
                case 'write_file':
                    setSessionFiles(prev => {
                        const existingIndex = prev.findIndex(f => f.name === args.filename);
                        const newFile = { name: args.filename, content: args.content };
                        if (existingIndex > -1) {
                            const updatedFiles = [...prev];
                            updatedFiles[existingIndex] = newFile;
                            return updatedFiles;
                        }
                        return [...prev, newFile];
                    });
                    updatedMessage.text = `Successfully wrote to ${args.filename}.`;
                    break;
                case 'execute_python_code':
                    const output = await executePythonCode(args.code, sessionFiles);
                    updatedMessage.codeExecutionResult = { code: args.code, output };
                    updatedMessage.text = 'Python code executed.';
                    // Add to history
                    setCodeHistory(prev => [{ id: `code-${Date.now()}`, code: args.code, timestamp: new Date() }, ...prev]);
                    break;
                 case 'create_interactive_chart':
                    updatedMessage.interactiveChartData = args.chart_config;
                    updatedMessage.text = 'Here is the interactive chart you requested.';
                    break;
                 case 'generate_website':
                    // Initial state: Loading
                    updatedMessage.generatedWebsite = { topic: args.topic, htmlContent: '', isLoading: true };
                    updatedMessage.text = `Designing a ${args.style} website for "${args.topic}"...`;
                    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...updatedMessage, status: 'sent'} : m));
                    
                    // Call the new service
                    const websiteHtml = await generateWebsiteCode(args.topic, args.style, args.features || []);
                    
                    // Final state: Ready
                    updatedMessage.generatedWebsite = { topic: args.topic, htmlContent: websiteHtml, isLoading: false };
                    updatedMessage.text = `I've created a ${args.style} website for "${args.topic}". Click 'Launch Preview' to see it!`;
                    break;
                default:
                    updatedMessage = { text: `It seems there was a misunderstanding and I tried to use a tool I don't have: \`${tool_call}\`. Could you please rephrase your request?` };
                    break;
            }
        } catch (e) {
            console.error(`Error handling tool ${tool_call}:`, e);
            updatedMessage = { text: `Sorry, there was an error using the tool: ${tool_call}.` };
        }

        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...updatedMessage, status: 'sent'} : m));
    };

    const runWorkflow = async (goal: string, messageId: string) => {
        let currentWorkflow: Workflow;
        
        // Helper to update the message state
        const updateWorkflowState = (updater: (wf: Workflow) => Workflow) => {
            setMessages(prev => {
                return prev.map(m => {
                    if (m.id === messageId && m.workflow) {
                        const newWorkflow = updater(m.workflow);
                        currentWorkflow = newWorkflow; // Keep local copy in sync
                        return { ...m, workflow: newWorkflow };
                    }
                    return m;
                });
            });
        };
        
        // 1. Generate Plan
        updateWorkflowState(wf => ({...wf, status: 'running'}));
        const planResult = await generatePlan(goal);
        
        if ('error' in planResult) {
            updateWorkflowState(wf => ({ ...wf, status: 'error', finalContent: planResult.error }));
            return;
        }

        updateWorkflowState(wf => ({
            ...wf,
            plan: planResult.plan,
            steps: planResult.plan.map(summary => ({ summary, status: 'pending' })),
        }));
        
        // 2. Execute Steps
        for (let i = 0; i < 10; i++) { // Max 10 steps to prevent infinite loops
            const completedSteps = messages.find(m => m.id === messageId)?.workflow?.steps.filter(s => s.status === 'completed') || [];
            
            // Set current step to 'running'
             updateWorkflowState(wf => ({
                ...wf,
                steps: wf.steps.map((s, idx) => completedSteps.length === idx ? { ...s, status: 'running' } : s)
            }));
            
            const nextStepResult = await runWorkflowStep(goal, currentWorkflow.plan, completedSteps);
            
            if ('error' in nextStepResult) {
                 updateWorkflowState(wf => ({ ...wf, status: 'error', finalContent: nextStepResult.error }));
                break;
            }
            
            const { step_summary, tool_call } = nextStepResult;
            
            updateWorkflowState(wf => ({
                ...wf,
                steps: wf.steps.map((s, idx) => completedSteps.length === idx ? { ...s, summary: step_summary, tool_call } : s)
            }));
            
             if (tool_call.name === 'finish') {
                updateWorkflowState(wf => ({
                    ...wf,
                    status: 'completed',
                    finalContent: tool_call.args.final_content,
                    steps: wf.steps.map((s, idx) => idx === completedSteps.length ? { ...s, status: 'completed' } : s)
                }));
                break;
            }
             if (tool_call.name === 'request_user_approval') {
                updateWorkflowState(wf => ({
                    ...wf,
                    status: 'paused_for_approval',
                    steps: wf.steps.map((s, idx) => idx === completedSteps.length ? { ...s, status: 'paused_for_approval' } : s)
                }));
                // Pause execution and wait for user input
                return;
            }

            // Execute the tool
            let tool_output: StructuredToolOutput = null;
            try {
                switch(tool_call.name) {
                    case 'search_and_summarize':
                        const searchRes = await performGoogleSearch(tool_call.args.query);
                        const summary = await analyzeBrowsedContent(searchRes.text || '', `Summarize the key findings related to the query: "${tool_call.args.query}"`);
                        tool_output = { type: 'text', content: summary };
                        break;
                    case 'write_file':
                         setSessionFiles(prev => {
                            const existingIndex = prev.findIndex(f => f.name === tool_call.args.filename);
                            const newFile = { name: tool_call.args.filename, content: tool_call.args.content };
                            if (existingIndex > -1) {
                                const updatedFiles = [...prev];
                                updatedFiles[existingIndex] = newFile;
                                return updatedFiles;
                            }
                            return [...prev, newFile];
                        });
                        tool_output = { type: 'text', content: `Wrote ${tool_call.args.content.length} characters to ${tool_call.args.filename}` };
                        break;
                     case 'read_file':
                        const fileContent = sessionFiles.find(f => f.name === tool_call.args.filename)?.content || `File not found: ${tool_call.args.filename}`;
                        tool_output = { type: 'text', content: fileContent };
                        break;
                     case 'list_files':
                        const files = sessionFiles.map(f => f.name).join('\n');
                        tool_output = { type: 'text', content: files || 'No files in session.' };
                        break;
                    // TODO: Add cases for PPT, Word, Excel which would generate the file and return a structured output
                }
            } catch (e) {
                 updateWorkflowState(wf => ({
                    ...wf, status: 'error', finalContent: `Error executing tool: ${tool_call.name}`,
                    steps: wf.steps.map((s, idx) => idx === completedSteps.length ? { ...s, status: 'error' } : s)
                 }));
                break;
            }
            
            updateWorkflowState(wf => ({
                ...wf,
                steps: wf.steps.map((s, idx) => idx === completedSteps.length ? { ...s, status: 'completed', tool_output } : s)
            }));
        }
    };
    
    const handleApproveWorkflow = (messageId: string) => {
        setMessages(prev => prev.map(m => {
            if (m.id === messageId && m.workflow) {
                // Fix: Explicitly type the returned object in the map function to WorkflowStep to avoid type inference issues.
                const newSteps = m.workflow.steps.map((s): WorkflowStep => 
                    s.status === 'paused_for_approval' ? { ...s, status: 'completed', tool_output: { type: 'text', content: 'User approved.' } } : s
                );
                return { ...m, workflow: { ...m.workflow, status: 'running', steps: newSteps } };
            }
            return m;
        }));
        // Find the goal and resume the workflow
        const message = messages.find(m => m.id === messageId);
        if (message && message.workflow) {
            runWorkflow(message.workflow.goal, messageId);
        }
    };
    
    const handleDenyWorkflow = (messageId: string) => {
        setMessages(prev => prev.map(m => {
            if (m.id === messageId && m.workflow) {
                // Fix: Explicitly type the returned object in the map function to WorkflowStep to avoid type inference issues.
                 const newSteps = m.workflow.steps.map((s): WorkflowStep =>
                    s.status === 'paused_for_approval' ? { ...s, status: 'denied' } : s
                );
                return { ...m, workflow: { ...m.workflow, status: 'denied', finalContent: 'Workflow denied by user.', steps: newSteps } };
            }
            return m;
        }));
    };

    const handleSaveSettings = (settings: Partial<UserProfile>) => {
        if (userProfile) {
            updateCurrentUser(settings);
            // Optionally refetch or update persona if custom instructions changed
            if (activePersona.name === 'AikonAI' && settings.customInstructions) {
                setActivePersona(prev => ({...prev, systemInstruction: aikonPersonaInstruction + '\n\n' + settings.customInstructions}));
            }
        }
        setIsSettingsModalOpen(false);
    };

    const handleDeleteAllChats = () => {
        setMessages([]);
        setChatHistory([]);
        setIsSettingsModalOpen(false);
    };
    
    const saveCustomPersona = (persona: Persona) => {
        let updatedPersonas;
        const existingIndex = customPersonas.findIndex(p => p.name === persona.name);
        if (existingIndex > -1) {
            updatedPersonas = [...customPersonas];
            updatedPersonas[existingIndex] = persona;
        } else {
            updatedPersonas = [...customPersonas, persona];
        }
        setCustomPersonas(updatedPersonas);
        localStorage.setItem(CUSTOM_PERSONAS_STORAGE_KEY, JSON.stringify(updatedPersonas));
    };

    const deleteCustomPersona = (personaName: string) => {
        const updatedPersonas = customPersonas.filter(p => p.name !== personaName);
        setCustomPersonas(updatedPersonas);
        localStorage.setItem(CUSTOM_PERSONAS_STORAGE_KEY, JSON.stringify(updatedPersonas));
        // If the deleted persona was active, revert to default
        if (activePersona.name === personaName) {
            setActivePersona({ name: 'AikonAI', icon: '🤖', description: 'Default Assistant', systemInstruction: aikonPersonaInstruction });
        }
    };
    
    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };
    
    const startLiveConversation = async () => {
        if (isLive) return;
        
        setIsLive(true);
        setLiveStatus('connecting');

        try {
            if (!inputAudioContextRef.current) {
                inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            }
            if (!outputAudioContextRef.current) {
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setLiveStatus('connected');
                        const source = inputAudioContextRef.current.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            nextStartTime = Math.max(nextStartTime, outputAudioContextRef.current.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                            
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            
                            source.addEventListener('ended', () => { audioSourcesRef.current.delete(source); });
                            
                            source.start(nextStartTime);
                            nextStartTime += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                        if (message.serverContent?.interrupted) {
                             for (const source of audioSourcesRef.current.values()) {
                                source.stop();
                            }
                            audioSourcesRef.current.clear();
                            nextStartTime = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error("Live session error:", e);
                        setLiveStatus('error');
                        setIsLive(false);
                    },
                    onclose: (e: CloseEvent) => {
                        setIsLive(false);
                        setLiveStatus('idle');
                         // Clean up resources
                        stream.getTracks().forEach(track => track.stop());
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' }}},
                    systemInstruction: activePersona.systemInstruction,
                },
            });

        } catch (err) {
            console.error("Failed to start live conversation:", err);
            setLiveStatus('error');
            setIsLive(false);
        }
    };
    
    const stopLiveConversation = () => {
        sessionPromiseRef.current?.then(session => session.close());
        setIsLive(false);
    };

    return (
        <div className="chat-page-container">
            {/* Header */}
            <header className="chat-header">
                <img src="/short_logo.jpeg" alt="AikonAI Logo" className="chat-header-logo" />
                 <div className="chat-header-actions">
                    {isAgentMode && <SessionFileManager files={sessionFiles} onOpenCodeCanvas={() => setIsCodeCanvasVisible(true)} />}
                    <AgentModeToggle isEnabled={isAgentMode} onToggle={setIsAgentMode} />
                    <button className="theme-toggle-button" onClick={toggleTheme} aria-label="Toggle theme">
                        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                    </button>
                    <button onClick={() => setIsSettingsModalOpen(true)}>Settings</button>
                    <button onClick={logout} className="primary">Log Out</button>
                </div>
            </header>
            
            {/* Message Log */}
            <div ref={messageLogRef} className="message-log-container">
                {messages.length === 0 ? (
                    <WelcomeScreen onActionClick={handleSendMessage} isAgentMode={isAgentMode} />
                ) : (
                    messages.map((msg, index) => (
                        <MessageLogItem 
                            key={msg.id} 
                            message={msg} 
                            isLast={index === messages.length - 1} 
                            userProfile={userProfile}
                            onApproveWorkflow={handleApproveWorkflow}
                            onDenyWorkflow={handleDenyWorkflow}
                            theme={theme}
                            onViewWebsite={(html) => setWebsitePreviewContent(html)}
                        />
                    ))
                )}
                 {isSending && messages.length > 0 && (
                     <div className="message-log-item ai">
                        <div className="message-bubble-wrapper">
                            <div className="message-avatar ai-avatar">
                                <img src="/short_logo.jpeg" alt="AikonAI Avatar" />
                            </div>
                            <div className="message-content-wrapper">
                                <TypingIndicator 
                                    persona={activePersona.name} 
                                    task={
                                        messages[messages.length-1].workflow ? 'workflow' :
                                        messages[messages.length-1].generatedImage ? 'generate_image' : 
                                        messages[messages.length-1].generatedWebsite ? 'generate_website' : null
                                    } 
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Composer */}
            <div className="chat-actions-bar">
                <div className="chat-actions-inner">
                    <PersonaMenu 
                        isOpen={isPersonaMenuOpen}
                        setIsOpen={setIsPersonaMenuOpen}
                        activePersona={activePersona}
                        setActivePersona={setActivePersona}
                        personas={[...PERSONAS, ...customPersonas]}
                        onSavePersona={saveCustomPersona}
                        onDeletePersona={deleteCustomPersona}
                    />
                    {activePersona.name !== 'AikonAI' && <ActivePersonaIndicator persona={activePersona} onClear={() => setActivePersona({ name: 'AikonAI', icon: '🤖', description: 'Default Assistant', systemInstruction: aikonPersonaInstruction })} />}
                    {isAgentMode && (
                        <>
                         <button onClick={() => setCodeHistoryPanelVisible(true)} className="action-pill">
                            <span>Code History ({codeHistory.length})</span>
                        </button>
                        </>
                    )}
                </div>
            </div>
            <ChatComposer 
                onSendMessage={handleSendMessage}
                onStartLiveConversation={startLiveConversation}
                isSending={isSending} 
                isAgentModeEnabled={isAgentMode}
            />

            <AnimatePresence>
                {isSettingsModalOpen && (
                    <SettingsModal
                        isOpen={isSettingsModalOpen}
                        onClose={() => setIsSettingsModalOpen(false)}
                        profile={userProfile}
                        onSave={handleSaveSettings}
                        onDeleteAllChats={handleDeleteAllChats}
                    />
                )}
                {isCodeCanvasVisible && (
                     <CodeCanvas 
                        files={sessionFiles.reduce((acc, file) => ({ ...acc, [file.name]: file.content }), {})} 
                        isVisible={isCodeCanvasVisible} 
                        onClose={() => setIsCodeCanvasVisible(false)} 
                    />
                )}
                {codeHistoryPanelVisible && (
                    <CodeHistoryPanel 
                        history={codeHistory}
                        isVisible={codeHistoryPanelVisible}
                        onClose={() => setCodeHistoryPanelVisible(false)}
                        onRunCode={(code) => handleSendMessage(code, [])}
                    />
                )}
                {isLive && (
                    <LiveConversationOverlay 
                        status={liveStatus} 
                        onDisconnect={stopLiveConversation} 
                    />
                )}
                {websitePreviewContent && (
                    <WebsitePreview
                        htmlContent={websitePreviewContent}
                        isVisible={!!websitePreviewContent}
                        onClose={() => setWebsitePreviewContent(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

const Header: React.FC<NavigationProps> = ({ navigateTo }) => {
    // Basic header, can be expanded
    return (
        <header className="chat-header">
            <img src="/short_logo.jpeg" alt="AikonAI Logo" className="chat-header-logo" />
            <div className="chat-header-actions">
                <button onClick={() => navigateTo('home')}>Home</button>
            </div>
        </header>
    );
};

const PersonaMenu: React.FC<{
    isOpen: boolean,
    setIsOpen: (isOpen: boolean) => void,
    activePersona: Persona,
    setActivePersona: (persona: Persona) => void,
    personas: Persona[],
    onSavePersona: (persona: Persona) => void,
    onDeletePersona: (name: string) => void,
}> = ({ isOpen, setIsOpen, activePersona, setActivePersona, personas, onSavePersona, onDeletePersona }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = useState<Persona | null>(null);

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [setIsOpen]);
    
    const handleSelectPersona = (persona: Persona) => {
        setActivePersona(persona);
        setIsOpen(false);
    };

    const handleEdit = (e: React.MouseEvent, persona: Persona) => {
        e.stopPropagation();
        setIsEditing(persona);
    };

    const handleDelete = (e: React.MouseEvent, personaName: string) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete the "${personaName}" persona?`)) {
            onDeletePersona(personaName);
        }
    };
    
    const handleSaveEdit = (editedPersona: Persona) => {
        onSavePersona(editedPersona);
        setIsEditing(null);
    };
    
    return (
        <div className="persona-menu-container" ref={menuRef}>
            <button className="action-pill" onClick={() => setIsOpen(!isOpen)}>
                <span className="text-xl">{activePersona.icon}</span>
                <span>Personas</span>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        className="persona-menu"
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    >
                         {personas.map(p => (
                            <div key={p.name} className="persona-tooltip-wrapper">
                                <div 
                                    className={`persona-menu-item ${activePersona.name === p.name ? 'selected' : ''}`}
                                    onClick={() => handleSelectPersona(p)}
                                >
                                    <span className="icon">{p.icon}</span>
                                    <span>{p.name}</span>
                                    {p.isCustom && (
                                        <div className="persona-item-actions">
                                            <button className="edit-btn" onClick={(e) => handleEdit(e, p)}>✏️</button>
                                            <button className="delete-btn" onClick={(e) => handleDelete(e, p.name)}>🗑️</button>
                                        </div>
                                    )}
                                </div>
                                <div className="persona-tooltip">{p.description}</div>
                            </div>
                        ))}
                         <div className="create-persona-button">
                             <div className="persona-menu-item" onClick={() => setIsEditing({ name: '', icon: '', systemInstruction: '', description: '', isCustom: true })}>
                                <span className="icon">➕</span>
                                <span>Create New Persona</span>
                             </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            {isEditing && (
                <CreatePersonaModal 
                    persona={isEditing}
                    onClose={() => setIsEditing(null)}
                    onSave={handleSaveEdit}
                />
            )}
        </div>
    );
};

const CreatePersonaModal: React.FC<{
    persona: Persona,
    onClose: () => void,
    onSave: (persona: Persona) => void
}> = ({ persona, onClose, onSave }) => {
    const [formData, setFormData] = useState<Persona>(persona);

    const handleSave = () => {
        onSave(formData);
        onClose();
    };
    
    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h2>{persona.name ? 'Edit' : 'Create'} Persona</h2>
                <div className="form-group">
                    <label>Name</label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} disabled={!!persona.name} />
                </div>
                <div className="form-group">
                    <label>Icon</label>
                    <input type="text" value={formData.icon} onChange={(e) => setFormData({...formData, icon: e.target.value})} maxLength={2} />
                </div>
                <div className="form-group">
                    <label>Description (for tooltip)</label>
                    <input type="text" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>
                <div className="form-group">
                    <label>System Instruction</label>
                    <textarea value={formData.systemInstruction} onChange={(e) => setFormData({...formData, systemInstruction: e.target.value})} />
                </div>
                 <div className="modal-footer">
                    <button onClick={onClose} className="secondary">Cancel</button>
                    <button onClick={handleSave} className="primary">Save</button>
                </div>
            </div>
        </div>
    );
};

const ActivePersonaIndicator: React.FC<{ persona: Persona, onClear: () => void }> = ({ persona, onClear }) => (
    <div className="active-persona-indicator">
        <span className="text-xl">{persona.icon}</span>
        <span className="font-semibold">{persona.name}</span>
        <button onClick={onClear}>&times;</button>
    </div>
);

const AgentModeToggle: React.FC<{ isEnabled: boolean, onToggle: (enabled: boolean) => void }> = ({ isEnabled, onToggle }) => (
    <div className="action-pill agent-toggle">
        <span className={`font-semibold text-sm ${isEnabled ? 'text-amber-400' : ''}`}>Agent Mode</span>
        <button className={`toggle-switch ${isEnabled ? 'on' : ''}`} onClick={() => onToggle(!isEnabled)}>
            <div className="toggle-thumb"></div>
        </button>
    </div>
);

const SessionFileManager: React.FC<{ files: VirtualFile[], onOpenCodeCanvas: () => void }> = ({ files, onOpenCodeCanvas }) => {
    if (files.length === 0) return null;
    return (
        <div className="action-pill" onClick={onOpenCodeCanvas}>
            <span>Session Files ({files.length})</span>
        </div>
    )
};

// Fix: Add 'idle' to the status prop type to align with the state variable.
const LiveConversationOverlay: React.FC<{ status: 'connecting' | 'connected' | 'error' | 'idle', onDisconnect: () => void }> = ({ status, onDisconnect }) => {
    // Fix: Add 'idle' case to the statusText map.
    const statusText = {
        connecting: 'Connecting...',
        connected: 'Live Conversation Started',
        error: 'Connection failed. Please try again.',
        idle: 'Disconnected',
    }[status];

    return (
        <motion.div className="live-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="live-content">
                <div className={`live-orb ${status === 'connected' ? 'connected' : ''}`}>
                    <div className="live-orb-inner"></div>
                </div>
                <p className="live-status">{statusText}</p>
                <button onClick={onDisconnect} className="live-disconnect-button">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2 2m-2-2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2" /></svg>
                    Disconnect
                </button>
            </div>
        </motion.div>
    );
};

const CodeHistoryPanel: React.FC<{ 
    history: CodeExecutionHistoryItem[], 
    isVisible: boolean, 
    onClose: () => void,
    onRunCode: (code: string) => void,
}> = ({ history, isVisible, onClose, onRunCode }) => {
    return (
         <AnimatePresence>
            {isVisible && (
                <motion.div 
                    className="code-history-panel"
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                    <div className="code-history-header">
                        <h3 className="text-lg font-bold text-amber-400">Code History</h3>
                        <motion.button whileTap={{scale: 0.9}} onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</motion.button>
                    </div>
                    <div className="code-history-list">
                        {history.length === 0 ? (
                            <p className="text-gray-500 text-center italic mt-4">No code has been executed in this session.</p>
                        ) : (
                            history.map(item => (
                                <div key={item.id} className="code-history-item">
                                    <div className="code-history-item-code">
                                        <CodeBlock language="python" code={item.code} />
                                    </div>
                                    <div className="code-history-item-footer">
                                        <span className="code-history-timestamp">{item.timestamp.toLocaleTimeString()}</span>
                                        <div className="code-history-actions">
                                            <button onClick={() => onRunCode(item.code)}>
                                                <span>▶️</span> Run Again
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
};


export default AikonChatPage;