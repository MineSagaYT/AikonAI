import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { NavigationProps, FileAttachment, Message, Source, Task, ChatListItem, MessageSender, Workflow, WorkflowStep, CanvasFiles, UserProfile, VirtualFile, StructuredToolOutput, Persona, PresentationData, WordData, ExcelData } from '../../types';
import { streamMessageToChat, generateImage, editImage, fetchVideoFromUri, generatePlan, runWorkflowStep, performGoogleSearch, browseWebpage, summarizeDocument, generateSpeech, generatePresentationContent, generateWordContent, generateExcelContent } from '../../services/geminiService';
import { fetchWeather } from '../../services/weatherService';
import { GenerateVideosOperation, Content, GenerateContentResponse, GoogleGenAI, Modality, GroundingChunk, Blob as GenAI_Blob, LiveServerMessage } from '@google/genai';
import { parseMarkdown, renderParagraph, createPptxFile, createDocxFile, createXlsxFile } from '../../utils/markdown';
import CodeBlock from '../CodeBlock';
import CodeCanvas from '../CodeCanvas';
import TaskList from '../TaskList';
import SettingsModal from '../SettingsModal';
import { useAuth } from '../../context/AuthContext';
import { logout } from '../../services/firebase';

const API_KEY = process.env.API_KEY;

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

const ai = API_KEY ? new GoogleGenAI({apiKey: API_KEY}) : null;

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
        systemInstruction: "You are a meticulous and highly-trained AI legal assistant. Your sole purpose is to review and analyze legal documents with extreme precision. You must identify key clauses, potential risks, and inconsistencies. Your language is formal, objective, and devoid of any personal opinion or speculation. You must not provide legal advice, but only factual analysis of the text provided. When asked for an opinion, you must state: 'As a legal analysis AI, I cannot provide legal advice. However, I can outline the potential implications based on the document's text.'"
    },
    {
        name: 'Cover Letter Writer',
        icon: '💼',
        systemInstruction: "You are an expert career coach and professional writer specializing in crafting compelling cover letters. Your tone is confident, persuasive, and highly professional. You will take a user's experience and the target job description to create a tailored, impactful narrative. You must use action verbs and quantify achievements wherever possible. Your goal is to make the user stand out as the ideal candidate. Start your responses by addressing the user as an aspiring professional."
    },
    {
        name: 'Writing Assistant',
        icon: '📝',
        systemInstruction: "You are a helpful and encouraging writing assistant. Your goal is to help users improve their writing. You can brainstorm ideas, create outlines, check for grammar and style, and suggest alternative phrasing. Your tone is always supportive and constructive. You should never be critical. Frame your suggestions as possibilities, for example, 'Have you considered phrasing it this way?' or 'Another great way to express this could be...'"
    },
    {
        name: 'Fitness Advice',
        icon: '🍎',
        systemInstruction: "You are a knowledgeable and motivational AI fitness coach. You must provide safe, evidence-based fitness and nutrition advice. Your tone is energetic, positive, and encouraging. You must always include a disclaimer: 'Please consult with a healthcare professional before starting any new fitness or diet regimen.' You should be able to create workout plans, suggest healthy meal ideas, and explain exercise techniques. You are not a medical doctor and must refuse to answer questions about injuries or medical conditions, redirecting the user to a healthcare professional."
    },
    {
        name: 'Personal Finance Assistant',
        icon: '💲',
        systemInstruction: "You are a prudent and insightful personal finance assistant. Your purpose is to provide educational content on budgeting, saving, and general investment principles. Your tone is clear, calm, and educational. You must never provide financial advice or recommend specific stocks or investments. All responses must include the disclaimer: 'I am an AI assistant and not a licensed financial advisor. This information is for educational purposes only. Please consult with a qualified financial professional for personalized advice.'"
    },
];

const DownloadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const WebIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9m-9 9a9 9 0 00-9-9" /></svg>);
const MapIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const ChevronIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>);

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
                            className="flex items-center gap-2 text-xs text-blue-400 hover:underline truncate"
                        >
                            {source.type === 'web' ? <WebIcon /> : <MapIcon />}
                            <span className="truncate" title={source.title}>{source.title}</span>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

const WorkflowBubble = memo(({ workflow, onApprove, onDeny }: { workflow: Workflow; onApprove: (stepIndex: number) => void; onDeny: (stepIndex: number) => void; }) => {
    const StatusPill: React.FC<{ status: Workflow['status'] }> = ({ status }) => {
        const baseClasses = "workflow-status";
        if (status === 'running') return <div className={`${baseClasses} running`}>Running</div>;
        if (status === 'completed') return <div className={`${baseClasses} completed`}>Completed</div>;
        if (status === 'paused_for_approval') return <div className={`${baseClasses} paused`}>Paused</div>;
        if (status === 'error') return <div className={`${baseClasses} error`}>Error</div>;
        if (status === 'denied') return <div className={`${baseClasses} error`}>Denied</div>;
        return null;
    };
    
    const StepIcon: React.FC<{ status: WorkflowStep['status'], toolName?: string }> = ({ status, toolName }) => {
         switch (status) {
            case 'completed':
                return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
            case 'running':
                 if (toolName) return <ToolIcon toolName={toolName} className="animate-pulse" />;
                return <div className="spinner"></div>;
            case 'paused_for_approval':
                return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.546-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
            case 'error':
            case 'denied':
                 return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
            case 'pending':
            default:
                 if (toolName) return <ToolIcon toolName={toolName} />;
                return <div className="w-2 h-2 rounded-full bg-gray-500"></div>;
        }
    }

    const ToolIcon: React.FC<{toolName: string, className?: string}> = ({ toolName, className }) => {
        const iconClass = `h-4 w-4 ${className || ''}`;
        switch(toolName) {
            case 'googleSearch': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
            case 'browse_webpage': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9m-9 9a9 9 0 00-9-9" /></svg>;
            case 'execute_python_code': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>;
            case 'write_file': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
            case 'read_file': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
            case 'finish': return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
            default: return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
        }
    }

    const renderToolOutput = (output: StructuredToolOutput) => {
        if (!output) return null;
        switch (output.type) {
            case 'search_results':
                return (
                    <div className="space-y-1">
                        {output.results.map((result, i) => (
                            <a href={result.link} key={i} target="_blank" rel="noopener noreferrer" className="search-result-item" title={result.title}>
                                {result.title}
                            </a>
                        ))}
                    </div>
                );
            case 'browsed_content':
                return (
                    <div>
                        <p className="browsed-content-url">Content from: {output.url}</p>
                        <p className="browsed-content-text">{output.content}</p>
                    </div>
                )
            case 'plot':
                return (
                    <div className="plot-output">
                        <img src={output.dataUrl} alt="Generated plot" />
                    </div>
                );
            case 'file_generated':
                return (
                    <div className="file-generated-output">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p>{output.message}</p>
                        <span>{output.filename}</span>
                    </div>
                );
            case 'text':
            default:
                return <pre className="code-output"><code>{output.content}</code></pre>;
        }
    }

    return (
        <div className="workflow-container">
            <div className="workflow-header">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M12 6a2 2 0 100-4 2 2 0 000 4zm0 14a2 2 0 100-4 2 2 0 000 4zm6-8a2 2 0 100-4 2 2 0 000 4zm-12 0a2 2 0 100-4 2 2 0 000 4z" /></svg>
                <h4>Autonomous Workflow</h4>
                <StatusPill status={workflow.status} />
            </div>
            <p className="workflow-goal"><strong>Goal:</strong> {workflow.goal}</p>
            
            <div className="workflow-steps-container">
                {workflow.steps.map((step, index) => (
                    <div key={index} className={`workflow-step ${step.status}`}>
                        <div className="workflow-step-icon"><StepIcon status={step.status} toolName={step.tool_call?.name} /></div>
                        <div className="workflow-step-content">
                            <p className="workflow-step-summary">{step.summary}</p>
                            {step.status === 'paused_for_approval' && (
                                <div className="workflow-approval-box">
                                    <p>{step.tool_call?.args.question}</p>
                                    <div className="workflow-approval-buttons">
                                        <button className="approve-btn" onClick={() => onApprove(index)}>Approve</button>
                                        <button className="deny-btn" onClick={() => onDeny(index)}>Deny</button>
                                    </div>
                                </div>
                            )}
                            {step.tool_output && (
                                <div className="workflow-step-tool-output">
                                    <details open>
                                        <summary className="cursor-pointer text-xs text-gray-400 mb-2">View Output</summary>
                                        {renderToolOutput(step.tool_output)}
                                    </details>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {workflow.status === 'completed' && workflow.finalContent && (
                <div className="workflow-final-answer">
                    <h5>Final Result</h5>
                    <div dangerouslySetInnerHTML={{ __html: renderParagraph(workflow.finalContent) }} />
                </div>
            )}
            {(workflow.status === 'error' || workflow.status === 'denied') && workflow.finalContent && (
                 <div className="workflow-final-answer">
                    <h5 className="text-red-400">Workflow Stopped</h5>
                    <div dangerouslySetInnerHTML={{ __html: renderParagraph(workflow.finalContent) }} />
                </div>
            )}
        </div>
    );
});

const SessionFileManager: React.FC<{ files: VirtualFile[], onOpenFile: (filename: string) => void, onDownloadFile: (file: VirtualFile) => void }> = ({ files, onOpenFile, onDownloadFile }) => {
    if (files.length === 0) return null;
    return (
        <div className="session-file-manager">
            <h5>Session Files</h5>
            <div className="session-file-list">
                {files.map(file => (
                     <div key={file.name} className="file-item">
                        <div onClick={() => onOpenFile(file.name)} className="file-item-info" title={file.name}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="truncate">{file.name}</span>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDownloadFile(file); }}
                            className="file-item-download-btn"
                            title={`Download ${file.name}`}
                        >
                            <DownloadIcon />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CodeExecutionResult: React.FC<{ result: { code: string; output: string } }> = ({ result }) => (
    <div className="code-execution-result">
        <div className="code-execution-header">Code Execution Result</div>
        <details>
            <summary className="cursor-pointer p-2 text-xs text-gray-400">View Executed Code</summary>
            <div className="code-execution-code">{result.code}</div>
        </details>
        <div className="code-execution-output">
             {result.output.startsWith('[PLOT_GENERATED]') ? (
                <img src={result.output.split('\n')[1]} alt="Generated plot" />
             ) : (
                result.output
             )}
        </div>
    </div>
);

const SkeletonLoader: React.FC<{ text: string; aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' }> = ({ text, aspectRatio }) => {
    const aspectRatioClass = {
        '1:1': 'aspect-1-1',
        '16:9': 'aspect-16-9',
        '9:16': 'aspect-9-16',
        '4:3': 'aspect-4-3',
        '3:4': 'aspect-3-4',
    }[aspectRatio];

    return (
        <div className={`skeleton-loader ${aspectRatioClass}`}>
            <span>{text}</span>
        </div>
    );
};

const MessageLogItem = memo(({ message, onApprove, onDeny, onViewImage, userProfile, style }: { message: Message; onApprove: (stepIndex: number) => void; onDeny: (stepIndex: number) => void; onViewImage: (url: string) => void; userProfile: UserProfile | null; style?: React.CSSProperties; }) => {
    
    const isAi = message.sender === 'ai';
    
    const statusText = message.text || (message.segments && message.segments[0]?.content);
    const isStatusUpdate = statusText?.startsWith('STATUS:');


    if (isStatusUpdate) {
        return (
             <div className="message-log-item ai" style={style}>
                 <div className="message-avatar ai-avatar">
                     <img src="/fetch/file/uploaded:Gemini_Generated_Image_5g4oit5g4oit5g4o.jpg-061ec57d-1239-4e36-910a-030c8a2e32e5" alt="AikonAI Logo" className="w-full h-full object-cover rounded-full" />
                 </div>
                 <div className="message-content-wrapper">
                    <div className="message-content status-update">
                         <svg className="animate-spin h-4 w-4 text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{statusText.replace('STATUS: ', '')}</span>
                    </div>
                </div>
            </div>
        )
    }

    const messageContent = () => {
        if (message.requiresAction === 'open_mailto' && !message.actionTaken) {
            return (
                <div>
                    <div dangerouslySetInnerHTML={{ __html: renderParagraph(message.text) }} />
                    <a
                        href={message.actionData.mailtoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg items-center gap-2 transition-transform transform hover:scale-105"
                    >
                        Open in Email App
                    </a>
                </div>
            );
        }
        if (message.workflow) {
            return <WorkflowBubble workflow={message.workflow} onApprove={onApprove} onDeny={onDeny} />;
        }
        if (message.codeExecutionResult) {
            return <CodeExecutionResult result={message.codeExecutionResult} />;
        }
        if (message.tasks) {
            return <TaskList tasks={message.tasks} onTaskUpdate={() => {}} />;
        }
        if (message.storyboardImages) {
            return (
                <div>
                    <h4 className="font-bold text-amber-400 mb-2">Storyboard</h4>
                    <div className="storyboard-grid">
                        {message.storyboardImages.map((panel, index) => (
                            <div key={index} className="storyboard-panel">
                                <img src={panel.url} alt={panel.prompt} />
                            </div>
                        ))}
                    </div>
                </div>
            )
        }
        if (message.generatedImage) {
            if (message.generatedImage.isLoading) {
                return (
                    <SkeletonLoader
                        text="Generating your imagination....🖼"
                        aspectRatio={message.generatedImage.aspectRatio || '1:1'}
                    />
                );
            }
            if (message.generatedImage.url) {
                return (
                    <div className="relative group">
                        <img src={message.generatedImage.url} alt={message.generatedImage.prompt} className="rounded-lg max-w-full" />
                        <a href={message.generatedImage.url} download={`aikonai-generated-${Date.now()}.png`} className="absolute bottom-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            <DownloadIcon />
                        </a>
                    </div>
                );
            }
        }
        if (message.editedImage) {
            if (message.editedImage.isLoading) {
                return (
                     <SkeletonLoader
                        text="🖌 Applying your edits..."
                        aspectRatio={'1:1'}
                    />
                );
            }
            if (message.editedImage.afterUrl) {
                return (
                    <div>
                        <div className="flex gap-2">
                            <div className="flex-1 text-center">
                                <p className="text-xs text-gray-400 font-semibold mb-1">BEFORE</p>
                                <img 
                                    src={message.editedImage.beforeUrl} 
                                    alt="Original image" 
                                    className="rounded-lg cursor-pointer transition-transform hover:scale-105"
                                    onClick={() => onViewImage(message.editedImage.beforeUrl)}
                                />
                            </div>
                            <div className="flex-1 text-center">
                                <p className="text-xs text-amber-400 font-semibold mb-1">AFTER</p>
                                <img 
                                    src={message.editedImage.afterUrl} 
                                    alt={message.editedImage.prompt} 
                                    className="rounded-lg cursor-pointer transition-transform hover:scale-105 border-2 border-amber-500/50"
                                    onClick={() => onViewImage(message.editedImage.afterUrl!)}
                                />
                            </div>
                        </div>
                        <div className="relative group text-right mt-2">
                            <a href={message.editedImage.afterUrl} download={`aikonai-edited-${Date.now()}.png`} className="p-2 bg-black/50 text-white rounded-full inline-block">
                                <DownloadIcon />
                            </a>
                        </div>
                    </div>
                );
            }
        }
        if (message.generatedVideo) {
            if (message.generatedVideo.status === 'generating') {
                return <div className="flex items-center gap-2"><div className="spinner"></div> Generating video...</div>;
            }
            if (message.generatedVideo.status === 'completed' && message.generatedVideo.url) {
                return <video src={message.generatedVideo.url} controls className="rounded-lg w-full" />;
            }
             if (message.generatedVideo.status === 'error') {
                return <div className="text-red-400">Video generation failed.</div>;
            }
        }
        if (message.audioUrl) {
            return (
                <div className="flex items-center gap-2 w-full max-w-sm p-2 bg-zinc-800/50 rounded-lg">
                    <audio controls src={message.audioUrl} className="flex-grow w-full" />
                    <a href={message.audioUrl} download={`aikonai-speech-${Date.now()}.wav`} className="p-2 bg-zinc-700 text-white rounded-full hover:bg-zinc-600 transition-colors" title="Download audio">
                        <DownloadIcon />
                    </a>
                </div>
            );
        }

        const streamingClass = message.status === 'streaming' ? 'streaming' : '';

        return (
            <div className={`message-content ${streamingClass}`}>
                 {message.imageUrl && message.sender === 'user' && (
                    <img 
                        src={message.imageUrl} 
                        alt="User attachment" 
                        className="rounded-lg max-w-full md:max-w-xs mb-2 cursor-pointer transition-transform hover:scale-105"
                        onClick={() => onViewImage(message.imageUrl)}
                    />
                )}
                {message.segments && message.segments.length > 0 ? (
                    message.segments.map((segment, segIndex) => {
                        if (segment.type === 'paragraph') {
                            return <div key={segIndex} dangerouslySetInnerHTML={{ __html: renderParagraph(segment.content) }} />;
                        }
                        if (segment.type === 'code') {
                            return (
                                <CodeBlock
                                    key={segIndex}
                                    code={segment.content}
                                    language={segment.language}
                                    filename={segment.filename}
                                />
                            );
                        }
                        return null;
                    })
                ) : (
                    message.text && <div dangerouslySetInnerHTML={{ __html: renderParagraph(message.text) }} />
                )}
                 <SourceDisplay sources={message.sources || []} />
            </div>
        );
    };

    const getInitials = (name?: string | null) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    return (
        <div className={`message-log-item ${isAi ? 'ai' : 'user'}`} style={style}>
            {isAi && (
                <div className="message-avatar ai-avatar">
                     <img src="/fetch/file/uploaded:Gemini_Generated_Image_5g4oit5g4oit5g4o.jpg-061ec57d-1239-4e36-910a-030c8a2e32e5" alt="AikonAI Logo" className="w-full h-full object-cover rounded-full" />
                </div>
            )}
             <div className="message-content-wrapper">
                {messageContent()}
            </div>
             {!isAi && (
                 <div className="message-avatar user-avatar">
                    {userProfile?.photoURL ? (
                        <img src={userProfile.photoURL} alt={userProfile.displayName || 'User'} />
                    ) : (
                        <span>{getInitials(userProfile?.displayName)}</span>
                    )}
                </div>
             )}
        </div>
    );
});


const TypingIndicator: React.FC = () => (
    <div className="message-log-item ai">
        <div className="message-avatar ai-avatar">
            <img src="/fetch/file/uploaded:Gemini_Generated_Image_5g4oit5g4oit5g4o.jpg-061ec57d-1239-4e36-910a-030c8a2e32e5" alt="AikonAI Logo" className="w-full h-full object-cover rounded-full" />
        </div>
        <div className="typing-indicator">
            <span></span><span></span><span></span>
        </div>
    </div>
);


const ChatComposer: React.FC<{
    onSendMessage: (message: string, file: FileAttachment | null) => void;
    isLoading: boolean;
    input: string;
    setInput: (value: string) => void;
    file: FileAttachment | null;
    setFile: (file: FileAttachment | null) => void;
    onCancel: () => void;
}> = ({ onSendMessage, isLoading, input, setInput, file, setFile, onCancel }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSendMessage = () => {
        const trimmedInput = input.trim();
        if (trimmedInput || file) {
            onSendMessage(trimmedInput, file);
            setInput('');
            setFile(null);
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const base64 = (loadEvent.target?.result as string)?.split(',')[1];
                if (base64) {
                    setFile({
                        name: selectedFile.name,
                        mimeType: selectedFile.type,
                        base64,
                    });
                }
            };
            reader.readAsDataURL(selectedFile);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                     const reader = new FileReader();
                    reader.onload = (loadEvent) => {
                         const base64 = (loadEvent.target?.result as string)?.split(',')[1];
                        if (base64) {
                            setFile({
                                name: 'pasted-image.png',
                                mimeType: blob.type,
                                base64,
                            });
                        }
                    };
                    reader.readAsDataURL(blob);
                }
                break;
            }
        }
    };

    useEffect(() => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto'; // Reset height
            const scrollHeight = ta.scrollHeight;
            ta.style.height = `${scrollHeight}px`;
        }
    }, [input]);

    return (
        <div className="chat-composer-container">
             {file && (
                <div className="composer-file-preview">
                    <div className="composer-file-preview-inner">
                        <div className="composer-file-info">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            <span>{file.name}</span>
                        </div>
                        <button onClick={() => setFile(null)} className="composer-icon-button" title="Remove file">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}
            <div className="chat-composer">
                <button
                    className="composer-icon-button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                </button>
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,text/plain,application/pdf,.csv,.json,.xml"
                />
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder="Ask AikonAI..."
                    rows={1}
                    className="composer-textarea"
                />
                 <button
                    onClick={handleSendMessage}
                    disabled={isLoading || (!input.trim() && !file)}
                    className="composer-icon-button composer-send-button"
                    title="Send"
                >
                     {isLoading ? (
                       <div className="w-5 h-5 border-2 border-zinc-600 border-t-black rounded-full animate-spin"></div>
                     ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                        </svg>
                     )}
                </button>
            </div>
        </div>
    );
};

const ImageViewer: React.FC<{ imageUrl: string; onClose: () => void }> = ({ imageUrl, onClose }) => (
    <div 
        className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-[200] animate-fade-in" 
        style={{ animationDuration: '0.2s' }}
        onClick={onClose}
    >
        <img 
            src={imageUrl} 
            alt="Full screen view" 
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
        />
    </div>
);

type LiveConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

const LiveConversationOverlay: React.FC<{
    connectionState: LiveConnectionState;
    onDisconnect: () => void;
}> = ({ connectionState, onDisconnect }) => {

    const getStatusText = () => {
        switch (connectionState) {
            case 'connecting': return 'Connecting to Live AI...';
            case 'connected': return 'Live conversation active';
            case 'error': return 'Connection failed. Please try again.';
            default: return '';
        }
    };
    
    return (
        <div className="live-overlay">
            <div className="live-content">
                <p className="live-status">{getStatusText()}</p>
                <div className={`live-orb ${connectionState === 'connected' ? 'connected' : ''}`}>
                    {connectionState === 'connecting' && <div className="w-8 h-8 border-4 border-white/50 border-t-white rounded-full animate-spin"></div>}
                    {connectionState === 'connected' && <div className="live-orb-inner"></div>}
                     {connectionState === 'error' && <span className="text-red-500 text-4xl">!</span>}
                </div>
                <button className="live-disconnect-button" onClick={onDisconnect}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2 2m-2-2v2.5M20 14v.5a2.5 2.5 0 01-2.5 2.5h-10A2.5 2.5 0 015 16.5V7.954a2.5 2.5 0 011.56-2.318l4.5-1.5a2.5 2.5 0 013.12 1.064M16 8a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    End Conversation
                </button>
            </div>
        </div>
    );
};


const AikonChatPage: React.FC<NavigationProps> = ({ navigateTo }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [history, setHistory] = useState<Content[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const { userProfile: authUserProfile, user } = useAuth();
    
    const [userSettings, setUserSettings] = useState<Partial<UserProfile>>({});

    useEffect(() => {
        if (authUserProfile) {
            setUserSettings(authUserProfile);
        }
    }, [authUserProfile]);

    const [input, setInput] = useState('');
    const [file, setFile] = useState<FileAttachment | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [lastActiveImage, setLastActiveImage] = useState<FileAttachment | null>(null);

    // Persona State
    const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
    const [currentPersona, setCurrentPersona] = useState<Persona | null>(null);
    const personaMenuRef = useRef<HTMLDivElement>(null);

    // Code Interpreter State
    const [sessionFiles, setSessionFiles] = useState<VirtualFile[]>([]);
    const [isCanvasVisible, setIsCanvasVisible] = useState(false);
    const [canvasFiles, setCanvasFiles] = useState<CanvasFiles>({});
    const isCancelledRef = useRef(false);

     const chatWindowRef = useRef<HTMLDivElement>(null);
     const bottomOfChatRef = useRef<HTMLDivElement>(null);

    // Live Conversation State
    const [liveConnectionState, setLiveConnectionState] = useState<LiveConnectionState>('disconnected');
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRefs = useRef<{ input: AudioContext | null, output: AudioContext | null, scriptProcessor: ScriptProcessorNode | null, sources: Set<AudioBufferSourceNode> }>({ input: null, output: null, scriptProcessor: null, sources: new Set() });
    const nextStartTimeRef = useRef(0);
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');


    const scrollToBottom = useCallback(() => {
        bottomOfChatRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
       scrollToBottom();
    }, [messages, isLoading, scrollToBottom]);

    // Close persona menu on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (personaMenuRef.current && !personaMenuRef.current.contains(event.target as Node)) {
                setIsPersonaMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => { document.removeEventListener("mousedown", handleClickOutside); };
    }, [personaMenuRef]);

    // FIX: Refactored handleWorkflowToolCall to be a pure function that takes the current file state
    // as an argument and returns the output and new file state, removing direct state dependency.
    const handleWorkflowToolCall = useCallback(async (
        tool_call: { name: string; args: any },
        currentFiles: VirtualFile[]
    ): Promise<{ output: StructuredToolOutput; updatedFiles: VirtualFile[] }> => {
        let output: StructuredToolOutput = null;
        let updatedFiles = [...currentFiles];

        switch (tool_call.name) {
            case 'googleSearch': {
                const searchResult = await performGoogleSearch(tool_call.args.query);
                const searchLinks = searchResult.sources.map(s => ({ title: s.title, link: s.uri }));
                output = { type: 'search_results', results: searchLinks };
                break;
            }
            case 'browse_webpage': {
                const content = await browseWebpage(tool_call.args.url);
                output = { type: 'browsed_content', url: tool_call.args.url, content: content };
                break;
            }
            case 'list_files': {
                const fileList = currentFiles.map(f => f.name).join('\n') || "No files in the current session.";
                output = { type: 'text', content: fileList };
                break;
            }
            case 'read_file': {
                const fileToRead = currentFiles.find(f => f.name === tool_call.args.filename);
                output = { type: 'text', content: fileToRead ? fileToRead.content : `Error: File '${tool_call.args.filename}' not found.` };
                break;
            }
            case 'write_file': {
                const existingFileIndex = updatedFiles.findIndex(f => f.name === tool_call.args.filename);
                if (existingFileIndex > -1) {
                    updatedFiles[existingFileIndex] = { name: tool_call.args.filename, content: tool_call.args.content };
                } else {
                    updatedFiles.push({ name: tool_call.args.filename, content: tool_call.args.content });
                }
                output = { type: 'text', content: `Successfully wrote to ${tool_call.args.filename}.` };
                break;
            }
            case 'create_powerpoint': {
                const { topic, num_slides } = tool_call.args;
                const content = await generatePresentationContent(topic, num_slides);
                if ('error' in content) {
                    output = { type: 'text', content: content.error };
                } else {
                    await createPptxFile(content, topic);
                    output = { type: 'file_generated', filename: `${topic.replace(/ /g, '_')}.pptx`, message: "Your presentation has been created and downloaded." };
                }
                break;
            }
            case 'create_word_document': {
                const { topic, sections } = tool_call.args;
                const content = await generateWordContent(topic, sections);
                if ('error' in content) {
                    output = { type: 'text', content: content.error };
                } else {
                    await createDocxFile(content);
                    output = { type: 'file_generated', filename: `${topic.replace(/ /g, '_')}.docx`, message: "Your document has been created and downloaded." };
                }
                break;
            }
            case 'create_excel_spreadsheet': {
                const { filename, data_description, columns } = tool_call.args;
                const content = await generateExcelContent(data_description, columns);
                 if ('error' in content) {
                    output = { type: 'text', content: content.error };
                } else {
                    await createXlsxFile({ ...content, filename });
                    output = { type: 'file_generated', filename: `${filename}.xlsx`, message: "Your spreadsheet has been created and downloaded." };
                }
                break;
            }
            default:
                output = { type: 'text', content: `Error: Tool "${tool_call.name}" is not recognized.` };
        }
        return { output, updatedFiles };
    }, []);

    const executeWorkflow = useCallback(async (goal: string, file: FileAttachment | null) => {
        setIsLoading(true);
        playSound('https://storage.googleapis.com/gemini-web-codelab-assets/codelab-magic-edit/workflow_start.mp3', 0.5);
        
        // FIX: Manage a local, synchronous copy of files during workflow execution to prevent stale state issues.
        let localSessionFiles = [...sessionFiles];
        if (file) {
            try {
                const content = atob(file.base64);
                const newFile = { name: file.name, content };
                localSessionFiles = localSessionFiles.filter(f => f.name !== newFile.name);
                localSessionFiles.push(newFile);
                setSessionFiles(localSessionFiles); // Update UI immediately
            } catch(e) { console.error("Error decoding file for workflow:", e); }
        }

        let workflow: Workflow = { goal, plan: [], steps: [], status: 'running', finalContent: null };
        const workflowMessageId = (Date.now() + 1).toString();
        const initialWorkflowMessage: Message = { id: workflowMessageId, text: '', sender: 'ai', timestamp: new Date(), workflow: { ...workflow } };
        setMessages(prev => [...prev, initialWorkflowMessage]);

        const planResult = await generatePlan(goal);
        if ('error' in planResult) {
            workflow.status = 'error';
            workflow.finalContent = planResult.error;
            setMessages(prev => prev.map(m => m.id === workflowMessageId ? { ...m, workflow: { ...workflow } } : m));
            setIsLoading(false);
            return;
        }
        
        workflow.plan = planResult.plan;
        
        let completedSteps: WorkflowStep[] = [];
        let shouldContinue = true;
        
        while (shouldContinue && completedSteps.length < 20) { // Safety break
            setMessages(prev => prev.map(m => m.id === workflowMessageId ? { ...m, workflow: { ...workflow, steps: [...completedSteps, { summary: 'Thinking...', status: 'running' }] } } : m));

            const stepResult = await runWorkflowStep(goal, workflow.plan, completedSteps);
            
            if ('error' in stepResult) {
                workflow.status = 'error';
                workflow.finalContent = stepResult.error;
                shouldContinue = false;
            } else if (!stepResult.tool_call || !stepResult.tool_call.name) {
                workflow.status = 'error';
                workflow.finalContent = "The AI agent failed to decide on the next action. Please try rephrasing your goal.";
                shouldContinue = false;
                const errorStep: WorkflowStep = {
                    summary: stepResult.step_summary || "AI failed to produce a valid next step.",
                    status: 'error',
                    tool_output: { type: 'text', content: 'The model returned an invalid response without a tool call.'}
                };
                completedSteps.push(errorStep);
            } else {
                const currentStep: WorkflowStep = {
                    summary: stepResult.step_summary,
                    tool_call: stepResult.tool_call,
                    status: 'running',
                    tool_output: null
                };

                if (stepResult.tool_call.name === 'finish') {
                    currentStep.status = 'completed';
                    workflow.status = 'completed';
                    workflow.finalContent = stepResult.tool_call.args.final_content;
                    shouldContinue = false;

                } else if (stepResult.tool_call.name === 'request_user_approval') {
                    currentStep.status = 'paused_for_approval';
                    workflow.status = 'paused_for_approval';
                    shouldContinue = false;

                } else {
                    // FIX: Pass and receive the local file state to/from the tool handler.
                    const toolResult = await handleWorkflowToolCall(stepResult.tool_call, localSessionFiles);
                    currentStep.tool_output = toolResult.output;
                    localSessionFiles = toolResult.updatedFiles;
                    currentStep.status = 'completed';
                }
                completedSteps.push(currentStep);
            }
            
            workflow.steps = [...completedSteps];
             setMessages(prev => prev.map(m => m.id === workflowMessageId ? { ...m, workflow: { ...workflow } } : m));
             if (workflow.status !== 'running') break;
        }

        if (workflow.status === 'running' && shouldContinue) {
             workflow.status = 'error';
             workflow.finalContent = "The workflow finished without reaching a conclusion. Please check the plan and try again.";
             setMessages(prev => prev.map(m => m.id === workflowMessageId ? { ...m, workflow: { ...workflow } } : m));
        }

        // FIX: Sync the final state of local files back to the main React state.
        setSessionFiles(localSessionFiles);
        
        // After the workflow is finished (completed, errored, or denied),
        // update the conversational history with the final result. This gives the model
        // context that the previous task is resolved, preventing it from re-triggering
        // the same workflow on the next user message.
        if (workflow.finalContent) {
            const historyContent = workflow.status === 'completed' 
                ? workflow.finalContent 
                : `The workflow ended with status '${workflow.status}'. Final message: ${workflow.finalContent}`;
            setHistory(prev => [...prev, { role: 'model', parts: [{ text: historyContent }] }]);
        }
        
        setIsLoading(false);

    }, [handleWorkflowToolCall, sessionFiles]);


    const handleApproval = useCallback((stepIndex: number, isApproved: boolean) => {
        setMessages(prevMessages => {
            const lastMessageIndex = prevMessages.map(m => m.sender).lastIndexOf('ai');
            const lastMessage = prevMessages[lastMessageIndex];

            if (!lastMessage || !lastMessage.workflow) return prevMessages;

            const updatedWorkflow = { ...lastMessage.workflow };
            const stepToUpdate = updatedWorkflow.steps[stepIndex];

            if (isApproved) {
                stepToUpdate.status = 'completed';
                stepToUpdate.tool_output = { type: 'text', content: "User approved." };
                updatedWorkflow.status = 'running';

                 const continueExecution = async () => {
                    let completedSteps = updatedWorkflow.steps;
                    let shouldContinue = true;

                    // This continuation doesn't have access to the localSessionFiles from the original execution.
                    // For now, it will use the main sessionFiles state. This could be improved if complex approval flows are needed.
                    let localSessionFiles = [...sessionFiles];

                    while (shouldContinue && completedSteps.length < 20) { // Safety break
                        setMessages(prev => prev.map(m => m.id === lastMessage.id ? { ...m, workflow: { ...updatedWorkflow, steps: [...completedSteps, { summary: 'Thinking...', status: 'running' }] } } : m));
                        const stepResult = await runWorkflowStep(updatedWorkflow.goal, updatedWorkflow.plan, completedSteps);
                        
                        if ('error' in stepResult) {
                            updatedWorkflow.status = 'error';
                            updatedWorkflow.finalContent = stepResult.error;
                            shouldContinue = false;
                        } else if (!stepResult.tool_call || !stepResult.tool_call.name) {
                            updatedWorkflow.status = 'error';
                            updatedWorkflow.finalContent = "The AI agent failed to decide on the next action after approval.";
                            shouldContinue = false;
                        } else {
                           const currentStep: WorkflowStep = { summary: stepResult.step_summary, tool_call: stepResult.tool_call, status: 'running', tool_output: null };

                           if (stepResult.tool_call.name === 'finish') {
                               currentStep.status = 'completed';
                               updatedWorkflow.status = 'completed';
                               updatedWorkflow.finalContent = stepResult.tool_call.args.final_content;
                               shouldContinue = false;
                           } else if (stepResult.tool_call.name === 'request_user_approval') {
                               currentStep.status = 'paused_for_approval';
                               updatedWorkflow.status = 'paused_for_approval';
                               shouldContinue = false;
                           } else {
                               const toolResult = await handleWorkflowToolCall(stepResult.tool_call, localSessionFiles);
                               currentStep.tool_output = toolResult.output;
                               localSessionFiles = toolResult.updatedFiles;
                               currentStep.status = 'completed';
                           }
                           completedSteps.push(currentStep);
                        }

                        updatedWorkflow.steps = [...completedSteps];
                        setMessages(prev => prev.map(m => m.id === lastMessage.id ? { ...m, workflow: { ...updatedWorkflow } } : m));
                        if (updatedWorkflow.status !== 'running') break;
                    }
                     setSessionFiles(localSessionFiles);
                     setIsLoading(false);
                };
                
                setIsLoading(true);
                continueExecution();

            } else {
                stepToUpdate.status = 'denied';
                stepToUpdate.tool_output = { type: 'text', content: "User denied."};
                updatedWorkflow.status = 'denied';
                updatedWorkflow.finalContent = "Workflow was stopped by the user.";
            }

            return prevMessages.map(m => m.id === lastMessage.id ? { ...m, workflow: updatedWorkflow } : m);
        });
    }, [handleWorkflowToolCall, sessionFiles]);

    const handleCancel = useCallback(() => {
        if (isLoading) {
            isCancelledRef.current = true;
            setIsLoading(false);
            // Immediately remove the streaming placeholder message
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg?.sender === 'ai' && lastMsg?.status === 'streaming') {
                    return prev.slice(0, -1);
                }
                return prev;
            });
        } else if (file) {
            setFile(null);
        }
    }, [isLoading, file]);

    const handleDownloadFile = (file: VirtualFile) => {
        const blob = new Blob([file.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const processVideoRequest = useCallback(async (prompt: string, messageId: string) => {
        setMessages(prev => prev.map(m => 
            m.id === messageId 
            ? { ...m, text: '', segments: [], generatedVideo: { status: 'generating', prompt: prompt } } 
            : m
        ));
    
        try {
            if (!window.aistudio || !(await window.aistudio.hasSelectedApiKey())) {
                await window.aistudio?.openSelectKey();
            }
            
            const localAi = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            
            // FIX: Updated deprecated video model and added resolution config.
            const operation = await localAi.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: prompt,
                config: {
                    numberOfVideos: 1,
                    aspectRatio: '16:9',
                    resolution: '720p',
                }
            });
            
            const checkStatus = async (op: GenerateVideosOperation, msgId: string) => {
                let currentOp = op;
                while (!currentOp.done) {
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    try {
                        currentOp = await localAi.operations.getVideosOperation({ operation: currentOp });
                    } catch (e: any) {
                        console.error("Polling error:", e);
                        if (e.message?.includes("Requested entity was not found")) {
                             setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: `Video generation failed: Invalid API Key. Please select a valid key.`, generatedVideo: { ...(m.generatedVideo!), status: 'error' } } : m));
                             await window.aistudio?.openSelectKey(); // Re-prompt for key
                             return;
                        }
                        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, generatedVideo: { ...(m.generatedVideo!), status: 'error' } } : m));
                        return;
                    }
                }
    
                const uri = currentOp.response?.generatedVideos?.[0]?.video?.uri;
                if (uri) {
                    const blob = await fetchVideoFromUri(uri);
                    const videoUrl = URL.createObjectURL(blob);
                    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, generatedVideo: { ...(m.generatedVideo!), status: 'completed', url: videoUrl } } : m));
                } else {
                    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, generatedVideo: { ...(m.generatedVideo!), status: 'error' } } : m));
                }
            };
            
            await checkStatus(operation, messageId);
    
        } catch (e: any) {
            console.error("Video generation error:", e);
            const errorMessage = (e as Error).message || "An unknown error occurred.";
            if (errorMessage.includes("API key not valid")) {
                 setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: `Video generation failed: Invalid API Key. Please select a valid key.`, generatedVideo: { ...(m.generatedVideo!), status: 'error' } } : m));
                 await window.aistudio?.openSelectKey(); // Re-prompt for key
            } else {
                 setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: `Video generation failed: ${errorMessage}`, generatedVideo: { ...(m.generatedVideo!), status: 'error' } } : m));
            }
        }
    }, []);
    
    const handleSendMessage = useCallback(async (message: string, file: FileAttachment | null) => {
        if (isLoading) return;
        setIsLoading(true);
        isCancelledRef.current = false; // Reset cancellation flag
        playSound('https://storage.googleapis.com/gemini-web-codelab-assets/codelab-magic-edit/send.mp3', 0.3);


        const userMessage: Message = {
            id: Date.now().toString(),
            text: message,
            sender: 'user',
            timestamp: new Date(),
            status: 'sent',
            imageUrl: file && file.mimeType.startsWith('image/') ? `data:${file.mimeType};base64,${file.base64}` : undefined
        };
        setMessages(prev => [...prev, userMessage]);
        
        if (file) {
            setLastActiveImage(file);
        }

        const isEditIntent = /(edit|add|change|remove|make it|modify|update)/i.test(message);
        const imageForContext = file || (isEditIntent ? lastActiveImage : null);

        let fileContentForTool: string | null = null;
        let location: {latitude: number, longitude: number} | null = null;
        
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        } catch (error) {
            console.warn("Could not get user location:", (error as GeolocationPositionError).message);
        }

        const systemInstruction = currentPersona 
            ? currentPersona.systemInstruction 
            : userSettings?.customInstructions;

        const { stream, historyWithUserMessage, fileContent } = await streamMessageToChat(history, message, imageForContext, location, undefined, systemInstruction);
        setHistory(historyWithUserMessage);
        fileContentForTool = fileContent;

        let fullText = '';
        let sources: Source[] = [];
        const aiMessageId = (Date.now() + 1).toString();
        
        const aiMessage: Message = {
            id: aiMessageId,
            text: '',
            sender: 'ai',
            timestamp: new Date(),
            status: 'streaming',
            segments: [],
            sources: []
        };
        setMessages(prev => [...prev, aiMessage]);

        try {
            for await (const chunk of stream) {
                if (isCancelledRef.current) break; // Check for cancellation
                fullText += chunk.text;
                const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                const newSources: Source[] = groundingChunks.reduce((acc: Source[], gc: GroundingChunk) => {
                    if (gc.web?.uri && gc.web.title) {
                        if (!acc.find(s => s.uri === gc.web.uri)) {
                           acc.push({ uri: gc.web.uri, title: gc.web.title, type: 'web' });
                        }
                    } else if (gc.maps?.uri && gc.maps.title) {
                         if (!acc.find(s => s.uri === gc.maps.uri)) {
                           acc.push({ uri: gc.maps.uri, title: gc.maps.title, type: 'map' });
                        }
                    }
                    return acc;
                }, []);
                
                sources = [...sources, ...newSources.filter(ns => !sources.some(s => s.uri === ns.uri))];

                setMessages(prev => prev.map(m => 
                    m.id === aiMessageId 
                        ? { ...m, text: fullText, segments: parseMarkdown(fullText), sources: sources } 
                        : m
                ));
            }
             if (!isCancelledRef.current) {
                playSound('https://storage.googleapis.com/gemini-web-codelab-assets/codelab-magic-edit/receive.mp3', 0.4);
            }
        } catch (error) {
            console.error("Streaming Error:", error);
            if (!isCancelledRef.current) {
                fullText += "\n\nSorry, an error occurred while generating the response.";
                playSound('https://storage.googleapis.com/gemini-web-codelab-assets/codelab-magic-edit/error.mp3', 0.4);
            }
        }

        if (isCancelledRef.current) {
            return; // Stop all further processing if cancelled
        }
        
        let finalAiMessage: Message | null = null;
        
        let toolCall;
        try {
            const jsonMatch = fullText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                toolCall = JSON.parse(jsonMatch[0]);
            }
        } catch (e) { /* Not a valid JSON object, so not a tool call */ }

        if (toolCall?.tool_call === 'initiate_workflow') {
            setMessages(prev => prev.filter(m => m.id !== aiMessageId)); 
            executeWorkflow(toolCall.goal, file); 
            setIsLoading(false); 
            return; 
        }

        if (toolCall?.tool_call) {
            // FIX: Handle video generation as a special case. It's a long-running task.
            // We initiate it, then exit the message processing flow to allow it to run in the background.
            // The processVideoRequest function will handle UI updates for its message.
            if (toolCall.tool_call === 'generate_video') {
                processVideoRequest(toolCall.prompt, aiMessageId);
                setIsLoading(false);
                return;
            }

            let toolResponseText = '';
            let updatedMessageData: Partial<Message> = {};

            switch (toolCall.tool_call) {
                case 'get_weather':
                    const weather = await fetchWeather(toolCall.city);
                    if ('error' in weather) {
                        toolResponseText = weather.error;
                    } else {
                        toolResponseText = `The weather in ${weather.city} is ${weather.temperature} with ${weather.description}.`;
                    }
                    break;
                case 'send_email':
                    const { recipient, subject, body } = toolCall;
                    const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                    toolResponseText = "I've drafted the email for you. You can review and send it from your default email client.";
                    updatedMessageData = {
                        requiresAction: 'open_mailto',
                        actionData: { mailtoUrl },
                        actionTaken: false,
                    };
                    break;
                case 'google_search':
                    const searchRes = await performGoogleSearch(toolCall.query);
                    toolResponseText = searchRes.text || "Here's what I found based on my search.";
                    updatedMessageData.sources = searchRes.sources;
                    break;
                case 'browse_webpage':
                    toolResponseText = await browseWebpage(toolCall.url);
                    break;
                case 'generate_image':
                    setMessages(prev => prev.map(m => 
                        m.id === aiMessageId 
                            ? { 
                                ...m, 
                                text: '', 
                                segments: [], 
                                generatedImage: { 
                                    prompt: toolCall.prompt, 
                                    aspectRatio: toolCall.aspectRatio || '1:1',
                                    isLoading: true 
                                } 
                            } 
                            : m
                    ));
                    const imageUrl = await generateImage(toolCall.prompt, toolCall.aspectRatio);
                    if (isCancelledRef.current) return;
                    if (imageUrl) {
                        toolResponseText = `Here is the image you requested for: "${toolCall.prompt}"`;
                        updatedMessageData.generatedImage = { prompt: toolCall.prompt, url: imageUrl, aspectRatio: toolCall.aspectRatio, isLoading: false };
                        const newBase64 = imageUrl.split(',')[1];
                        const newMimeType = imageUrl.match(/data:(.*);/)?.[1] || 'image/png';
                        setLastActiveImage({
                            name: 'generated-image.png',
                            mimeType: newMimeType,
                            base64: newBase64
                        });
                    } else {
                        toolResponseText = `Sorry, I couldn't generate an image for "${toolCall.prompt}". It might have violated safety policies.`;
                        updatedMessageData.generatedImage = undefined;
                    }
                    break;
                 case 'edit_image':
                    const imageToEdit = file || lastActiveImage;
                    if (imageToEdit) {
                        setMessages(prev => prev.map(m => 
                            m.id === aiMessageId 
                                ? { 
                                    ...m, 
                                    text: '', 
                                    segments: [], 
                                    editedImage: { 
                                        beforeUrl: `data:${imageToEdit.mimeType};base64,${imageToEdit.base64}`,
                                        prompt: toolCall.prompt,
                                        isLoading: true 
                                    } 
                                } 
                                : m
                        ));
                        const editedUrl = await editImage(imageToEdit, toolCall.prompt);
                        if (isCancelledRef.current) return;

                        if (editedUrl) {
                            toolResponseText = `I've edited the image as you requested.`;
                             updatedMessageData.editedImage = { 
                                 beforeUrl: `data:${imageToEdit.mimeType};base64,${imageToEdit.base64}`, 
                                 afterUrl: editedUrl, 
                                 prompt: toolCall.prompt,
                                 isLoading: false
                            };
                            const newBase64 = editedUrl.split(',')[1];
                            const newMimeType = editedUrl.match(/data:(.*);/)?.[1] || 'image/png';
                            setLastActiveImage({
                                name: 'edited-image.png',
                                mimeType: newMimeType,
                                base64: newBase64
                            });
                        } else {
                            toolResponseText = "Sorry, I couldn't edit the image. It may have been blocked for safety reasons.";
                             updatedMessageData.editedImage = undefined;
                        }
                    } else {
                        toolResponseText = "You need to upload an image or have a generated image in the chat to edit it.";
                    }
                    break;
                case 'summarize_document':
                    if(fileContentForTool) {
                        toolResponseText = await summarizeDocument(fileContentForTool);
                    } else {
                        toolResponseText = "Please upload a text document first to summarize it.";
                    }
                    break;
                case 'create_storyboard':
                    const prompts = toolCall.prompts.slice(0, 4); 
                    const imagePromises = prompts.map((p: string) => generateImage(p, '16:9'));
                    const urls = await Promise.all(imagePromises);
                    if (urls.some(url => url !== null)) {
                        toolResponseText = "Here is the storyboard you requested.";
                        updatedMessageData.storyboardImages = prompts.map((p: string, i: number) => ({ prompt: p, url: urls[i]! })).filter(item => item.url);
                    } else {
                         toolResponseText = "Sorry, I was unable to generate images for the storyboard.";
                    }
                    break;
                 case 'text_to_speech':
                    const base64Audio = await generateSpeech(toolCall.text);
                    if (base64Audio) {
                        const pcmData = decode(base64Audio); // Uint8Array
                        const wavBlob = pcmToWav(pcmData, 24000, 1, 16);
                        const audioUrl = URL.createObjectURL(wavBlob);
                        toolResponseText = `Here's the audio for you.`;
                        updatedMessageData.audioUrl = audioUrl;
                    } else {
                        toolResponseText = "Sorry, I couldn't generate the speech for that text.";
                    }
                    break;

                default:
                    toolResponseText = `I'm not familiar with the tool: ${toolCall.tool_call}`;
                    break;
            }

            finalAiMessage = {
                ...aiMessage,
                text: toolResponseText,
                segments: parseMarkdown(toolResponseText),
                status: 'sent',
                ...updatedMessageData,
            };
            setHistory(prev => [...prev, { role: 'model', parts: [{ text: toolResponseText }] }]);

        } else {
             finalAiMessage = { ...aiMessage, text: fullText, segments: parseMarkdown(fullText), status: 'sent' };
             setHistory(prev => [...prev, { role: 'model', parts: [{ text: fullText }] }]);
        }
        
        if(finalAiMessage) {
            setMessages(prev => prev.map(m => m.id === aiMessageId ? finalAiMessage! : m));
        }

        setIsLoading(false);

    }, [isLoading, history, executeWorkflow, userSettings, lastActiveImage, currentPersona, processVideoRequest]);

    const handleQuickAction = (prompt: string) => {
        const composerTextarea = document.querySelector('.composer-textarea') as HTMLTextAreaElement;
        if (composerTextarea) {
             setInput(prompt);
            composerTextarea.focus();
        }
    };

    const handleClearChat = () => {
        setMessages([]);
        setHistory([]);
        setSessionFiles([]);
        setIsSettingsOpen(false);
    };

    const handleLogout = async () => {
        await logout();
        navigateTo('home');
    };
    
    // --- Live Conversation Logic ---
    const stopLiveConversation = useCallback(async () => {
        if (sessionPromiseRef.current) {
            const session = await sessionPromiseRef.current;
            session.close();
            sessionPromiseRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        if (audioContextRefs.current.input) {
            audioContextRefs.current.input.close();
            audioContextRefs.current.input = null;
        }
        if (audioContextRefs.current.output) {
            audioContextRefs.current.output.close();
            audioContextRefs.current.output = null;
        }
        if (audioContextRefs.current.scriptProcessor) {
            audioContextRefs.current.scriptProcessor.disconnect();
            audioContextRefs.current.scriptProcessor = null;
        }

        setLiveConnectionState('disconnected');
    }, []);

    const startLiveConversation = useCallback(async () => {
        if (!ai || liveConnectionState !== 'disconnected') return;

        setLiveConnectionState('connecting');

        try {
            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

            const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const outputNode = outputAudioContext.createGain();
            outputNode.connect(outputAudioContext.destination);

            audioContextRefs.current.input = inputAudioContext;
            audioContextRefs.current.output = outputAudioContext;

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        const source = inputAudioContext.createMediaStreamSource(mediaStreamRef.current!);
                        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext.destination);
                        audioContextRefs.current.scriptProcessor = scriptProcessor;
                        setLiveConnectionState('connected');
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        }

                        if (message.serverContent?.turnComplete) {
                            const userInput = currentInputTranscriptionRef.current.trim();
                            const aiOutput = currentOutputTranscriptionRef.current.trim();

                            if (userInput) {
                                const userMessage: Message = {
                                    id: Date.now().toString(),
                                    text: userInput,
                                    sender: 'user',
                                    timestamp: new Date(),
                                    status: 'sent',
                                };
                                setMessages(prev => [...prev, userMessage]);
                            }

                            if (aiOutput) {
                                 const aiMessage: Message = {
                                    id: (Date.now() + 1).toString(),
                                    text: aiOutput,
                                    sender: 'ai',
                                    timestamp: new Date(),
                                    status: 'sent',
                                };
                                setMessages(prev => [...prev, aiMessage]);
                            }
                            
                            if (userInput || aiOutput) {
                                const newHistory: Content[] = [];
                                if(userInput) newHistory.push({ role: 'user', parts: [{ text: userInput }] });
                                if(aiOutput) newHistory.push({ role: 'model', parts: [{ text: aiOutput }] });
                                setHistory(prev => [...prev, ...newHistory]);
                            }

                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                        }
                        
                        const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64EncodedAudioString && audioContextRefs.current.output) {
                            const outputCtx = audioContextRefs.current.output;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            
                            const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputCtx, 24000, 1);
                            
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputNode);
                            source.addEventListener('ended', () => { audioContextRefs.current.sources.delete(source); });
                            
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioContextRefs.current.sources.add(source);
                        }

                         const interrupted = message.serverContent?.interrupted;
                        if (interrupted) {
                            for (const source of audioContextRefs.current.sources.values()) {
                                source.stop();
                                audioContextRefs.current.sources.delete(source);
                            }
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setLiveConnectionState('error');
                        stopLiveConversation();
                    },
                    onclose: (e: CloseEvent) => {
                        stopLiveConversation();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    outputAudioTranscription: {},
                    inputAudioTranscription: {},
                },
            });

        } catch (error) {
            console.error("Failed to start live conversation:", error);
            setLiveConnectionState('error');
            stopLiveConversation();
        }
    }, [liveConnectionState, stopLiveConversation]);

    const handleToggleLiveMode = useCallback(() => {
        if (liveConnectionState === 'disconnected' || liveConnectionState === 'error') {
            startLiveConversation();
        } else {
            stopLiveConversation();
        }
    }, [liveConnectionState, startLiveConversation, stopLiveConversation]);


    const PersonaMenu: React.FC<{ onSelect: (persona: Persona) => void }> = ({ onSelect }) => (
        <div className="persona-menu">
            {PERSONAS.map(p => (
                <div key={p.name} className="persona-menu-item" onClick={() => onSelect(p)}>
                    <span className="icon">{p.icon}</span>
                    <span>{p.name}</span>
                </div>
            ))}
        </div>
    );

    const WelcomeScreen: React.FC = () => {
        const DeepSearchIcon = () => (<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.1521 3.34537C15.4297 2.62291 14.5885 2.01916 13.6705 1.56543M12 2V3M2 12H3M4.92893 4.92893L5.63604 5.63604M4.92893 19.0711L5.63604 18.364M12 22V21M19.0711 19.0711L18.364 18.364M19.0711 4.92893L18.364 5.63604M7.84787 3.34537C8.57034 2.62291 9.41153 2.01916 10.3295 1.56543M12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12C17 14.7614 14.7614 17 12 17Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>);
        const CreateImageIcon = () => (<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 16.5V7.5M7.5 12H16.5M17.5 2.5H6.5C4.29086 2.5 2.5 4.29086 2.5 6.5V17.5C2.5 19.7091 4.29086 21.5 6.5 21.5H17.5C19.7091 21.5 21.5 19.7091 21.5 17.5V6.5C21.5 4.29086 19.7091 2.5 17.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>);
        const PersonasIcon = () => (<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 7.5V16.5C4.5 17.3284 5.17157 18 6 18H18C18.8284 18 19.5 17.3284 19.5 16.5V7.5C19.5 6.67157 18.8284 6 18 6H6C5.17157 6 4.5 6.67157 4.5 7.5Z" stroke="currentColor" strokeWidth="2"></path><path d="M2.5 11V16.5C2.5 18.433 4.067 20 6 20H18C19.933 20 21.5 18.433 21.5 16.5V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path></svg>);
        const VoiceIcon = () => (<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 12H8.01M12 12H12.01M16 12H16.01M5 12H5.01M19 12H19.01M2 12H2.01M22 12H22.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path></svg>);

        return (
            <div className="chat-welcome-screen">
                <img src="/fetch/file/uploaded:Gemini_Generated_Image_5g4oit5g4oit5g4o.jpg-061ec57d-1239-4e36-910a-030c8a2e32e5" alt="AikonAI Logo" className="welcome-logo" />
                <h1 className="welcome-title">AikonAI</h1>
                <div className="welcome-actions">
                    <button className="action-pill" onClick={() => handleQuickAction("Deep search the latest trends in renewable energy.")}>
                        <DeepSearchIcon /> DeepSearch
                    </button>
                     <button className="action-pill" onClick={() => handleQuickAction("Create an image of a futuristic city at sunset, cinematic style.")}>
                        <CreateImageIcon /> Create Image
                    </button>
                    <div className="persona-menu-container" ref={personaMenuRef}>
                        <button className="action-pill" onClick={() => setIsPersonaMenuOpen(prev => !prev)}>
                            <PersonasIcon /> Pick Personas
                        </button>
                        {isPersonaMenuOpen && <PersonaMenu onSelect={(p) => {
                            setCurrentPersona(p);
                            setIsPersonaMenuOpen(false);
                            handleQuickAction(`Hello! Please act as my ${p.name}.`);
                        }} />}
                    </div>
                    <button className="action-pill" onClick={handleToggleLiveMode}>
                        <VoiceIcon /> Voice
                    </button>
                </div>
            </div>
        );
    };

    const isEmpty = messages.length === 0;

    return (
        <div className="chat-page-container">
            {liveConnectionState !== 'disconnected' && (
                <LiveConversationOverlay 
                    connectionState={liveConnectionState}
                    onDisconnect={stopLiveConversation}
                />
            )}
            <header className="chat-header">
                 <img src="/fetch/file/uploaded:Gemini_Generated_Image_5g4oit5g4oit5g4o.jpg-061ec57d-1239-4e36-910a-030c8a2e32e5" alt="AikonAI Logo" className="chat-header-logo" />
                 <div className="chat-header-actions">
                    {user ? (
                        <>
                            <button onClick={() => setIsSettingsOpen(true)}>Settings</button>
                            <button className="primary" onClick={handleLogout}>Log Out</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => navigateTo('home')}>Sign In</button>
                            <button className="primary" onClick={() => navigateTo('home')}>Sign Up</button>
                        </>
                    )}
                 </div>
            </header>
            
            <main className="flex-grow flex flex-col min-h-0">
                 {isEmpty && !isLoading ? <WelcomeScreen /> : (
                    <div ref={chatWindowRef} className="message-log-container">
                         {!isEmpty && <SessionFileManager 
                            files={sessionFiles} 
                            onOpenFile={(filename) => {
                                const fileContent = sessionFiles.find(f => f.name === filename)?.content;
                                if(fileContent) {
                                    setCanvasFiles({ [filename]: fileContent });
                                    setIsCanvasVisible(true);
                                }
                            }} 
                            onDownloadFile={handleDownloadFile}
                        />}
                        {messages.map((msg, index) => (
                            <MessageLogItem
                                key={msg.id}
                                message={msg}
                                onApprove={(stepIndex) => handleApproval(stepIndex, true)}
                                onDeny={(stepIndex) => handleApproval(stepIndex, false)}
                                onViewImage={setViewingImage}
                                userProfile={authUserProfile}
                                style={{ animationDelay: `${Math.min(index * 100, 1000)}ms` }}
                            />
                        ))}
                        {isLoading && <TypingIndicator />}
                        <div ref={bottomOfChatRef} />
                    </div>
                )}
            </main>
            
            {!isEmpty && (
                <div className="chat-actions-bar">
                    <div className="chat-actions-inner">
                        {currentPersona && (
                            <div className="action-pill active-persona-indicator">
                                <span>{currentPersona.icon} {currentPersona.name}</span>
                                <button onClick={() => setCurrentPersona(null)} title="Clear Persona">&times;</button>
                            </div>
                        )}
                        <div className="persona-menu-container" ref={personaMenuRef}>
                            <button className="action-pill" onClick={() => setIsPersonaMenuOpen(prev => !prev)}>
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4"><path d="M4.5 7.5V16.5C4.5 17.3284 5.17157 18 6 18H18C18.8284 18 19.5 17.3284 19.5 16.5V7.5C19.5 6.67157 18.8284 6 18 6H6C5.17157 6 4.5 6.67157 4.5 7.5Z" stroke="currentColor" strokeWidth="2"></path><path d="M2.5 11V16.5C2.5 18.433 4.067 20 6 20H18C19.933 20 21.5 18.433 21.5 16.5V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path></svg>
                                Pick Personas
                            </button>
                            {isPersonaMenuOpen && <PersonaMenu onSelect={(p) => {
                                setCurrentPersona(p);
                                setIsPersonaMenuOpen(false);
                            }} />}
                        </div>
                    </div>
                </div>
            )}

            <ChatComposer 
                onSendMessage={handleSendMessage} 
                isLoading={isLoading} 
                input={input}
                setInput={setInput}
                file={file}
                setFile={setFile}
                onCancel={handleCancel}
            />

            <CodeCanvas
                isVisible={isCanvasVisible}
                onClose={() => setIsCanvasVisible(false)}
                files={canvasFiles}
            />
            
            <SettingsModal 
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                profile={userSettings}
                onSave={(settings) => {
                    setUserSettings(p => ({...p, ...settings}));
                    setIsSettingsOpen(false);
                }}
                onDeleteAllChats={handleClearChat}
            />

            {viewingImage && <ImageViewer imageUrl={viewingImage} onClose={() => setViewingImage(null)} />}
        </div>
    );
};

export default AikonChatPage;