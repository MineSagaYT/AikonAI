import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { NavigationProps, FileAttachment, Message, Source, Task, ChatListItem, MessageSender, Workflow, WorkflowStep, CanvasFiles, UserProfile, VirtualFile, StructuredToolOutput, Persona, PresentationData, WordData, ExcelData } from '../../types';
// FIX: Renamed imported function from `createExcelContent` to `generateExcelContent` to match the exported member in geminiService.
import { streamMessageToChat, generateImage, editImage, fetchVideoFromUri, generatePlan, runWorkflowStep, performGoogleSearch, browseWebpage, summarizeDocument, generateSpeech, generatePresentationContent, generateWordContent, generateExcelContent, analyzeBrowsedContent, generateVideo } from '../../services/geminiService';
import { fetchWeather } from '../../services/weatherService';
import { GenerateVideosOperation, Content, GenerateContentResponse, GoogleGenAI, Modality, GroundingChunk, Blob as GenAI_Blob, LiveServerMessage } from '@google/genai';
import { parseMarkdown, renderParagraph, createPptxFile, createDocxFile, createXlsxFile } from '../../utils/markdown';
import CodeBlock from '../CodeBlock';
import CodeCanvas from '../CodeCanvas';
import TaskList from '../TaskList';
import SettingsModal from '../SettingsModal';
import { useAuth } from '../../context/AuthContext';
import { logout } from '../../services/firebase';
import LoadingSpinner from '../LoadingSpinner';
// FIX: Imported Variants type from framer-motion to resolve typing errors.
import { motion, AnimatePresence, Variants } from 'framer-motion';
import WeatherCard from '../WeatherCard';


const API_KEY = "AIzaSyC1C0lq5AKNIU3LzeD1m53udApAaQQshHs";

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
];

const CUSTOM_PERSONAS_STORAGE_KEY = 'aikon-custom-personas';

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
            default: return <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
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
                        <div className="browsed-content-text" dangerouslySetInnerHTML={{ __html: renderParagraph(output.content) }} />
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
                return <div className="message-content" dangerouslySetInnerHTML={{ __html: renderParagraph(output.content) }} />;
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
                                        <summary>View Output</summary>
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
                            <span>{file.name}</span>
                        </div>
                         <button onClick={() => onDownloadFile(file)} className="file-item-download" aria-label={`Download ${file.name}`}>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                         </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PPTPreviewCard: React.FC<{ data: PresentationData, filename: string, onDownload: () => void, previewImageUrl?: string, isPreviewLoading?: boolean }> = ({ data, filename, onDownload, previewImageUrl, isPreviewLoading }) => (
    <div className="ppt-preview-card">
        <div className="ppt-preview-image-container">
            {isPreviewLoading ? (
                <div className="skeleton-loader aspect-16-9"><span>Generating Preview...</span></div>
            ) : previewImageUrl ? (
                <img src={previewImageUrl} alt="Presentation preview" className="ppt-preview-image" />
            ) : (
                <div className="ppt-preview-no-image">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
            )}
        </div>
        <div className="ppt-preview-content">
            <p className="ppt-preview-header">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                PRESENTATION
            </p>
            <h4 className="ppt-preview-title">{filename}</h4>
        </div>
         <div className="ppt-preview-footer">
            <button className="ppt-preview-download-btn" onClick={onDownload}>
                <DownloadIcon /> Download .pptx
            </button>
        </div>
    </div>
);


const StoryboardDisplay: React.FC<{ images: { prompt: string; url: string }[] }> = ({ images }) => (
    <div className="storyboard-grid">
        {images.map((image, index) => (
            <div key={index} className="storyboard-panel" title={image.prompt}>
                <img src={image.url} alt={`Storyboard panel: ${image.prompt}`} />
            </div>
        ))}
    </div>
);

const SkeletonImageLoader: React.FC<{aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4', prompt: string}> = ({ aspectRatio, prompt }) => (
    <div className={`skeleton-loader aspect-${aspectRatio.replace(':', '-')}`}>
        <span>Generating image for: "{prompt}"... <br/>This may take a moment.</span>
    </div>
);


// --- Main Chat Page Component ---
const AikonChatPage: React.FC<NavigationProps> = ({ navigateTo }) => {
    const { user, userProfile, isGuest, refetchProfile } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [fileAttachment, setFileAttachment] = useState<FileAttachment | null>(null);
    const [chatId, setChatId] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<Content[]>([]);
    
    // Agent Mode State
    const [isAgentModeEnabled, setIsAgentModeEnabled] = useState(false);
    const [sessionFiles, setSessionFiles] = useState<VirtualFile[]>([]);
    const [isCodeCanvasVisible, setIsCodeCanvasVisible] = useState(false);
    const [canvasFiles, setCanvasFiles] = useState<CanvasFiles>({});

    const messageLogRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    // Personas State
    const [personas, setPersonas] = useState<Persona[]>(PERSONAS);
    const [activePersona, setActivePersona] = useState<Persona | null>(null);
    const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
    const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
    const [editingPersona, setEditingPersona] = useState<Persona | null>(null);

    // Live Conversation State
    const [isLive, setIsLive] = useState(false);
    const [liveStatus, setLiveStatus] = useState('Connecting...');
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

    // FIX: Add key selected state to track API key selection status
    const [keySelected, setKeySelected] = useState(false);
    
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    // Load custom personas from local storage
    useEffect(() => {
        try {
            const storedPersonas = localStorage.getItem(CUSTOM_PERSONAS_STORAGE_KEY);
            if (storedPersonas) {
                const customPersonas: Persona[] = JSON.parse(storedPersonas);
                setPersonas(prev => [...PERSONAS, ...customPersonas.map(p => ({...p, isCustom: true}))]);
            }
        } catch (error) {
            console.error("Failed to load custom personas from local storage:", error);
        }
    }, []);
    
    // Function to save custom personas
    const saveCustomPersonas = (customPersonas: Persona[]) => {
        try {
            localStorage.setItem(CUSTOM_PERSONAS_STORAGE_KEY, JSON.stringify(customPersonas));
        } catch (error) {
            console.error("Failed to save custom personas:", error);
        }
    };
    
    const handleSavePersona = (newPersona: Persona) => {
        let updatedPersonas;
        const existingIndex = personas.findIndex(p => p.name === newPersona.name && p.isCustom);

        if (existingIndex > -1) {
            // Update existing persona
            updatedPersonas = [...personas];
            updatedPersonas[existingIndex] = { ...newPersona, isCustom: true };
        } else {
            // Add new persona
            updatedPersonas = [...personas, { ...newPersona, isCustom: true }];
        }
        
        setPersonas(updatedPersonas);
        
        // Persist only custom personas to local storage
        const customPersonas = updatedPersonas.filter(p => p.isCustom);
        saveCustomPersonas(customPersonas);
        
        // If the edited persona was active, update it
        if (activePersona && activePersona.name === newPersona.name) {
            setActivePersona({ ...newPersona, isCustom: true });
        }
    };

    const handleDeletePersona = (personaNameToDelete: string) => {
        const updatedPersonas = personas.filter(p => !(p.name === personaNameToDelete && p.isCustom));
        setPersonas(updatedPersonas);

        const customPersonas = updatedPersonas.filter(p => p.isCustom);
        saveCustomPersonas(customPersonas);
        
        if (activePersona && activePersona.name === personaNameToDelete) {
            setActivePersona(null); // Deselect if it was active
        }
    };


    const toggleTheme = () => {
        setTheme(current => (current === 'dark' ? 'light' : 'dark'));
    };

    useEffect(() => {
        document.body.className = ''; // Clear previous classes
        document.body.classList.add(`${theme}-theme-chat`);
    }, [theme]);
    
    const handleScroll = () => {
        const el = messageLogRef.current;
        if (el) {
            const isScrolledToBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 5;
            setIsAtBottom(isScrolledToBottom);
        }
    };
    
    const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
        messageLogRef.current?.scrollTo({
            top: messageLogRef.current.scrollHeight,
            behavior: behavior,
        });
    }, []);

    // Effect for auto-scrolling
    useEffect(() => {
        if (isAtBottom) {
            scrollToBottom('smooth');
        }
    }, [messages, isAtBottom, scrollToBottom]);
    
    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [input]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (readEvent) => {
                const base64 = readEvent.target?.result as string;
                const base64Data = base64.split(',')[1];
                setFileAttachment({
                    name: file.name,
                    base64: base64Data,
                    mimeType: file.type,
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const removeFileAttachment = () => {
        setFileAttachment(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSendMessage = async (prompt?: string) => {
        const messageText = prompt || input;
        if (!messageText.trim() && !fileAttachment) return;

        setIsLoading(true);
        setInput('');
        
        const userMessage: Message = {
            id: Date.now().toString(),
            text: messageText,
            sender: 'user',
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        
        // Immediately add a placeholder AI message
        const aiMessageId = (Date.now() + 1).toString();
        const aiMessagePlaceholder: Message = {
            id: aiMessageId,
            text: '',
            sender: 'ai',
            timestamp: new Date(),
            status: 'streaming',
        };
        setMessages(prev => [...prev, aiMessagePlaceholder]);
        
        scrollToBottom('auto');

        let location: { latitude: number; longitude: number } | null = null;
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                 navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        } catch (error) {
            console.warn("Geolocation permission denied or timed out.");
        }


        try {
            const personaInstruction = activePersona ? activePersona.systemInstruction : undefined;
            
            // FIX: Destructure `response` along with `stream` to access the final response metadata.
            const { stream, response, historyWithUserMessage, fileContent } = await streamMessageToChat(
                chatHistory,
                messageText,
                fileAttachment,
                location,
                userProfile,
                undefined,
                personaInstruction,
                isAgentModeEnabled,
            );

            setChatHistory(historyWithUserMessage);
            
            let accumulatedText = '';
            let toolCallJson = '';
            let isToolCall = false;

            for await (const chunk of stream) {
                const chunkText = chunk.text;
                
                // Heuristic to detect if the response is a tool call JSON
                if (!isToolCall && chunkText.trim().startsWith('{"tool_call"')) {
                    isToolCall = true;
                }

                if (isToolCall) {
                    toolCallJson += chunkText;
                } else {
                    accumulatedText += chunkText;
                    setMessages(prev => prev.map(msg => 
                        msg.id === aiMessageId ? { ...msg, text: accumulatedText } : msg
                    ));
                }
            }
            
            // Final update to the message bubble after streaming
            const finalAiMessageContent: Partial<Message> = { text: accumulatedText, status: 'sent' };
            
            // Check for grounding metadata
            // FIX: Use the `response` promise to get the final response object, which contains grounding metadata.
            const lastResponse = await response;
            const groundingChunks = lastResponse?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            if (groundingChunks.length > 0) {
                 finalAiMessageContent.sources = groundingChunks.reduce((acc: Source[], chunk: GroundingChunk) => {
                    if (chunk.web?.uri && chunk.web.title) {
                        acc.push({ uri: chunk.web.uri, title: chunk.web.title, type: 'web' });
                    }
                    if (chunk.maps?.uri && chunk.maps.title) {
                        acc.push({ uri: chunk.maps.uri, title: chunk.maps.title, type: 'map' });
                    }
                    return acc;
                }, []);
            }
            
            setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: accumulatedText }] }]);


            if (isToolCall) {
                await handleToolCall(toolCallJson, aiMessageId);
            } else {
                 setMessages(prev => prev.map(msg =>
                    msg.id === aiMessageId ? { ...msg, ...finalAiMessageContent } : msg
                ));
            }

        } catch (error: any) {
            console.error("Error sending message:", error);
            const errorMessage = `Sorry, I encountered an error. Please try again. Details: ${error.message}`;
             setMessages(prev => prev.map(msg =>
                msg.id === aiMessageId ? { ...msg, text: errorMessage, status: 'sent' } : msg
            ));
        } finally {
            setIsLoading(false);
            setFileAttachment(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            // Ensure the final state is not streaming
            setMessages(prev => prev.map(msg => 
                msg.id === aiMessageId && msg.status === 'streaming' ? { ...msg, status: 'sent' } : msg
            ));
        }
    };
    
    // Function to handle tool calls
    const handleToolCall = async (jsonString: string, aiMessageId: string) => {
        try {
            const toolData = JSON.parse(jsonString);
            const { tool_call, goal, ...args } = toolData;
            
            setMessages(prev => prev.map(msg =>
                msg.id === aiMessageId ? { ...msg, text: `Running tool: ${tool_call}...`, status: 'sent' } : msg
            ));
            
            let resultMessage = '';
            
            switch (tool_call) {
                case 'get_weather':
                    const weather = await fetchWeather(args.city);
                     if ('error' in weather) {
                        resultMessage = weather.error;
                    } else {
                        // Don't add a text message, instead add a message with a WeatherData object
                        setMessages(prev => prev.map(msg =>
                            msg.id === aiMessageId ? { ...msg, text: '', weatherData: weather } : msg
                        ));
                        return; // Exit early to avoid overwriting with text
                    }
                    break;
                case 'generate_image':
                    setMessages(prev => prev.map(msg => 
                        msg.id === aiMessageId 
                            ? { ...msg, text: '', generatedImage: { prompt: args.prompt, isLoading: true, aspectRatio: '1:1' } } 
                            : msg
                    ));
                    const imageUrl = await generateImage(args.prompt);
                     setMessages(prev => prev.map(msg => 
                        msg.id === aiMessageId 
                            ? { ...msg, generatedImage: { ...msg.generatedImage!, url: imageUrl || 'error', isLoading: false } }
                            : msg
                    ));
                    return;
                case 'edit_image':
                    if (!fileAttachment) {
                        resultMessage = "Please upload an image first to use the edit tool.";
                        break;
                    }
                    setMessages(prev => prev.map(msg =>
                        msg.id === aiMessageId
                            ? { ...msg, text: '', editedImage: { beforeUrl: `data:${fileAttachment.mimeType};base64,${fileAttachment.base64}`, prompt: args.prompt, isLoading: true } }
                            : msg
                    ));
                    const editedUrl = await editImage(fileAttachment, args.prompt);
                    setMessages(prev => prev.map(msg =>
                        msg.id === aiMessageId
                            ? { ...msg, editedImage: { ...msg.editedImage!, afterUrl: editedUrl || 'error', isLoading: false } }
                            : msg
                    ));
                    return;
                case 'generate_video':
                    setMessages(prev => prev.map(msg =>
                        msg.id === aiMessageId ? { ...msg, text: '', generatedVideo: { status: 'generating', prompt: args.prompt } } : msg
                    ));
                    try {
                        // FIX: Added a check for window.aistudio to prevent runtime errors when the object is not available.
                        if (window.aistudio) {
                            // FIX: Added a check for hasSelectedApiKey to prevent API calls without a selected key.
                            const hasKey = await window.aistudio.hasSelectedApiKey();
                            if (!hasKey) {
                                // FIX: Added a call to openSelectKey to prompt the user to select an API key.
                                await window.aistudio.openSelectKey();
                            }
                        }
                        const ai = new GoogleGenAI({apiKey: API_KEY});
                        let operation: GenerateVideosOperation | undefined = await ai.models.generateVideos({
                            model: 'veo-3.1-fast-generate-preview',
                            prompt: args.prompt,
                            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
                        });

                        while (operation && !operation.done) {
                            await new Promise(resolve => setTimeout(resolve, 10000));
                            operation = await ai.operations.getVideosOperation({ operation: operation });
                        }
                        
                        const downloadLink = operation?.response?.generatedVideos?.[0]?.video?.uri;
                        if (downloadLink) {
                            const videoBlob = await fetchVideoFromUri(downloadLink);
                            const videoUrl = URL.createObjectURL(videoBlob);
                            setMessages(prev => prev.map(msg =>
                                msg.id === aiMessageId ? { ...msg, generatedVideo: { ...msg.generatedVideo!, status: 'completed', url: videoUrl } } : msg
                            ));
                        } else {
                            throw new Error("Video generation completed, but no download link was found.");
                        }
                    } catch (error: any) {
                         setMessages(prev => prev.map(msg =>
                            msg.id === aiMessageId ? { ...msg, generatedVideo: { ...msg.generatedVideo!, status: 'error' }, text: `Video Generation Error: ${error.message}` } : msg
                        ));
                    }
                    return;
                case 'summarize_document':
                    // We already have the file content from the streamMessageToChat function call
                     const fileContent = (await streamMessageToChat(chatHistory, "summarize", fileAttachment, null, userProfile)).fileContent;
                    if (!fileContent) {
                        resultMessage = "Sorry, I couldn't read the attached file. Please ensure it's a valid text file.";
                    } else {
                        const summary = await summarizeDocument(fileContent);
                        resultMessage = `Here is a summary of the document:\n\n${summary}`;
                    }
                    break;
                case 'text_to_speech':
                     const audioBase64 = await generateSpeech(args.text);
                    if (audioBase64) {
                        const audioBlob = pcmToWav(decode(audioBase64), 24000, 1, 16);
                        const audioUrl = URL.createObjectURL(audioBlob);
                         setMessages(prev => prev.map(msg =>
                            msg.id === aiMessageId ? { ...msg, text: `Audio for: "${args.text}"`, audioUrl } : msg
                        ));
                        return;
                    } else {
                        resultMessage = "Sorry, I couldn't generate the audio at this time.";
                    }
                    break;
                 case 'create_storyboard':
                    const prompts = args.prompts as string[];
                    const storyboardImages: { prompt: string, url: string }[] = [];
                    // Add a loading state
                    setMessages(prev => prev.map(msg =>
                        msg.id === aiMessageId ? { ...msg, text: `Generating ${prompts.length} storyboard panels...` } : msg
                    ));
                    for (const prompt of prompts) {
                        const url = await generateImage(prompt);
                        if (url) {
                            storyboardImages.push({ prompt, url });
                        }
                    }
                     setMessages(prev => prev.map(msg =>
                        msg.id === aiMessageId ? { ...msg, text: "Here's your storyboard:", storyboardImages } : msg
                    ));
                    return;
                case 'create_powerpoint':
                    setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, generatedFile: { filename: `${args.topic}.pptx`, message: 'Generating presentation...', type: 'pptx', isPreviewLoading: true } } : msg));
                    const pptData = await generatePresentationContent(args.topic, args.num_slides || 5);
                    if ('error' in pptData) {
                         setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: pptData.error, generatedFile: undefined } : msg));
                    } else {
                        // Generate a preview image from the first slide's content
                        const previewPrompt = `Create a visually appealing title slide image for a presentation titled "${args.topic}". The style should be professional and modern. Include the title prominently.`;
                        const previewUrl = await generateImage(previewPrompt, '16:9');
                        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, generatedFile: { ...msg.generatedFile!, data: pptData, message: 'Presentation ready for download.', previewImageUrl: previewUrl, isPreviewLoading: false } } : msg));
                    }
                    return;
                case 'create_word_document':
                    setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, generatedFile: { filename: `${args.topic}.docx`, message: 'Generating document...', type: 'docx' } } : msg));
                    const docData = await generateWordContent(args.topic, args.sections);
                    if ('error' in docData) {
                         setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: docData.error, generatedFile: undefined } : msg));
                    } else {
                         setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, generatedFile: { ...msg.generatedFile!, data: docData, message: 'Document ready for download.' } } : msg));
                    }
                    return;
                case 'create_excel_spreadsheet':
                    setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, generatedFile: { filename: `${args.filename}.xlsx`, message: 'Generating spreadsheet...', type: 'xlsx' } } : msg));
                    const excelData = await generateExcelContent(args.data_description, args.columns);
                    if ('error' in excelData) {
                        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: excelData.error, generatedFile: undefined } : msg));
                    } else {
                        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, generatedFile: { ...msg.generatedFile!, data: { ...excelData, filename: args.filename }, message: 'Spreadsheet ready for download.' } } : msg));
                    }
                    return;
                case 'generate_qr_code':
                    const qrText = args.text;
                    const qrDataUrl = await new Promise<string>((resolve) => {
                        QRCode.toDataURL(qrText, { width: 256, margin: 2 }, (err: any, url: string) => {
                            if (err) resolve('');
                            else resolve(url);
                        });
                    });
                     if (qrDataUrl) {
                        setMessages(prev => prev.map(msg =>
                            msg.id === aiMessageId ? { ...msg, text: '', generatedQRCode: { text: qrText, dataUrl: qrDataUrl } } : msg
                        ));
                    } else {
                        resultMessage = "Sorry, I couldn't generate the QR code.";
                    }
                    return;

                case 'initiate_workflow':
                    const initialWorkflow: Workflow = {
                        goal: goal,
                        plan: [],
                        steps: [],
                        status: 'running',
                        finalContent: null
                    };
                    setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: '', workflow: initialWorkflow } : msg));
                    await executeWorkflow(goal, aiMessageId);
                    return;
                default:
                    resultMessage = `Unknown tool: ${tool_call}`;
            }

            setMessages(prev => prev.map(msg =>
                msg.id === aiMessageId ? { ...msg, text: resultMessage } : msg
            ));
            
        } catch (error: any) {
            console.error("Error parsing or handling tool call:", error);
            setMessages(prev => prev.map(msg =>
                msg.id === aiMessageId ? { ...msg, text: `Error processing tool request: ${error.message}` } : msg
            ));
        }
    };
    
    // Workflow Execution Logic
    const executeWorkflow = async (goal: string, messageId: string, approvalStatus: 'approved' | 'denied' | null = null, approvedStepIndex: number = -1) => {
        let currentWorkflow: Workflow | undefined;
        setMessages(prev => {
            const newMessages = [...prev];
            const msgIndex = newMessages.findIndex(m => m.id === messageId);
            if (msgIndex > -1 && newMessages[msgIndex].workflow) {
                currentWorkflow = { ...newMessages[msgIndex].workflow! };
                if (approvalStatus === 'approved' && currentWorkflow.steps[approvedStepIndex]) {
                     currentWorkflow.steps[approvedStepIndex].status = 'running';
                     currentWorkflow.status = 'running';
                }
                if (approvalStatus === 'denied' && currentWorkflow.steps[approvedStepIndex]) {
                    currentWorkflow.steps[approvedStepIndex].status = 'denied';
                    currentWorkflow.status = 'denied';
                    currentWorkflow.finalContent = "Workflow stopped by user.";
                }
            }
            return newMessages;
        });
        
        if (!currentWorkflow || currentWorkflow.status === 'denied') return;

        try {
            // Step 1: Generate a plan if it doesn't exist
            if (currentWorkflow.plan.length === 0) {
                 const planResult = await generatePlan(goal);
                if ('error' in planResult) throw new Error(planResult.error);
                currentWorkflow.plan = planResult.plan;
                 currentWorkflow.steps = planResult.plan.map(p => ({ summary: p, status: 'pending' }));
                 setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, workflow: currentWorkflow } : msg));
            }
            
            // Step 2: Execute steps until completion or error
            while (currentWorkflow.status === 'running') {
                const result = await runWorkflowStep(currentWorkflow.goal, currentWorkflow.plan, currentWorkflow.steps.filter(s => s.status === 'completed'));
                if ('error' in result) throw new Error(result.error);
                
                const { step_summary, tool_call } = result;

                // Find the next pending step to update
                const nextStepIndex = currentWorkflow.steps.findIndex(s => s.status === 'pending');
                if (nextStepIndex === -1) {
                    // This case might happen if the agent decides to finish early.
                    // We'll let the 'finish' tool handle the final state.
                } else {
                    currentWorkflow.steps[nextStepIndex].summary = step_summary;
                    currentWorkflow.steps[nextStepIndex].tool_call = tool_call;
                    currentWorkflow.steps[nextStepIndex].status = 'running';
                }

                setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, workflow: currentWorkflow } : msg));
                
                // --- TOOL EXECUTION ---
                let tool_output: StructuredToolOutput = null;

                if (tool_call.name === 'finish') {
                    currentWorkflow.status = 'completed';
                    currentWorkflow.finalContent = tool_call.args.final_content;
                } else if (tool_call.name === 'request_user_approval') {
                     currentWorkflow.status = 'paused_for_approval';
                     if (nextStepIndex !== -1) {
                         currentWorkflow.steps[nextStepIndex].status = 'paused_for_approval';
                     }
                } else {
                    // All other tools
                    switch(tool_call.name) {
                        case 'search_and_summarize':
                            const searchRes = await performGoogleSearch(tool_call.args.query);
                            tool_output = { type: 'text', content: searchRes.text || "No results found." };
                            break;
                        case 'write_file':
                            const updatedFiles = { ...sessionFiles.reduce((acc, file) => ({...acc, [file.name]: file.content}), {}), [tool_call.args.filename]: tool_call.args.content };
                            // FIX: Added explicit string conversion to satisfy the VirtualFile type.
                            setSessionFiles(Object.entries(updatedFiles).map(([name, content]) => ({ name, content: String(content) })));
                            tool_output = { type: 'file_generated', filename: tool_call.args.filename, message: 'File written successfully.' };
                            break;
                         case 'create_powerpoint':
                            const pptData = await generatePresentationContent(tool_call.args.topic, tool_call.args.num_slides || 5);
                            if ('error' in pptData) throw new Error(pptData.error);
                            await createPptxFile(pptData, tool_call.args.topic);
                            tool_output = { type: 'file_generated', filename: `${tool_call.args.topic}.pptx`, message: 'PowerPoint presentation downloaded.' };
                            break;
                         case 'create_word_document':
                            const docData = await generateWordContent(tool_call.args.topic, tool_call.args.sections);
                            if ('error' in docData) throw new Error(docData.error);
                            await createDocxFile(docData);
                            tool_output = { type: 'file_generated', filename: `${docData.title}.docx`, message: 'Word document downloaded.' };
                            break;
                        case 'create_excel_spreadsheet':
                             const excelData = await generateExcelContent(tool_call.args.data_description, tool_call.args.columns);
                            if ('error' in excelData) throw new Error(excelData.error);
                            const fullExcelData: ExcelData = { ...excelData, filename: tool_call.args.filename };
                            await createXlsxFile(fullExcelData);
                            tool_output = { type: 'file_generated', filename: `${tool_call.args.filename}.xlsx`, message: 'Excel spreadsheet downloaded.' };
                            break;
                        default:
                            tool_output = { type: 'text', content: `Error: Unknown tool '${tool_call.name}' called by agent.` };
                            break;
                    }
                    if (nextStepIndex !== -1) {
                        currentWorkflow.steps[nextStepIndex].status = 'completed';
                        currentWorkflow.steps[nextStepIndex].tool_output = tool_output;
                    }
                }

                setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, workflow: { ...currentWorkflow! } } : msg));
            }

        } catch (error: any) {
             // FIX: Explicitly type `updatedWorkflow` as `Workflow` to prevent type widening on the `status` property.
             const updatedWorkflow: Workflow = { ...currentWorkflow!, status: 'error', finalContent: `An error occurred: ${error.message}` };
             setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, workflow: updatedWorkflow } : msg));
        }
    };

    const handleWorkflowApproval = (messageId: string, stepIndex: number) => {
        executeWorkflow(messages.find(m => m.id === messageId)?.workflow?.goal || '', messageId, 'approved', stepIndex);
    };

    const handleWorkflowDenial = (messageId: string, stepIndex: number) => {
        executeWorkflow(messages.find(m => m.id === messageId)?.workflow?.goal || '', messageId, 'denied', stepIndex);
    };

    const handleDownloadGeneratedFile = async (message: Message) => {
        if (!message.generatedFile || !message.generatedFile.data) return;
        
        switch(message.generatedFile.type) {
            case 'pptx':
                await createPptxFile(message.generatedFile.data as PresentationData, message.generatedFile.filename.replace('.pptx', ''));
                break;
            case 'docx':
                 await createDocxFile(message.generatedFile.data as WordData);
                break;
            case 'xlsx':
                 await createXlsxFile(message.generatedFile.data as ExcelData);
                break;
        }
    };
    
    
     const startLiveConversation = async () => {
        setIsLive(true);
        setLiveStatus('Initializing...');
        
        // FIX: Replaced `new GoogleGenAI(API_KEY)` with `new GoogleGenAI({apiKey: API_KEY})` to align with the latest SDK initialization method.
        const ai = new GoogleGenAI({apiKey: API_KEY});

        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        let nextStartTime = 0;
        const outputNode = outputAudioContextRef.current.createGain();
        const sources = new Set<AudioBufferSourceNode>();

        try {
            setLiveStatus('Waiting for microphone permission...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            setLiveStatus('Connecting to AikonAI...');

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setLiveStatus('Connected! You can start speaking.');
                        playSound('https://aistudio.google.com/static/sounds/call_start.mp3');
                        
                        if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
                        const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
                        const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

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
                            source.connect(outputNode);
                             source.addEventListener('ended', () => { sources.delete(source); });
                            source.start(nextStartTime);
                            nextStartTime += audioBuffer.duration;
                            sources.add(source);
                        }
                        
                         if (message.serverContent?.interrupted) {
                            for (const source of sources.values()) {
                                source.stop();
                                sources.delete(source);
                            }
                            nextStartTime = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setLiveStatus(`Connection error: ${e.message}`);
                        stopLiveConversation();
                    },
                    onclose: () => {
                        setLiveStatus('Disconnected.');
                        stopLiveConversation(false); // Don't try to close session again
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                },
            });

        } catch (error: any) {
            console.error('Failed to start live conversation:', error);
            setLiveStatus(`Error: ${error.message}`);
            setIsLive(false);
        }
    };

    const stopLiveConversation = (closeSession = true) => {
        if (closeSession && sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            playSound('https://aistudio.google.com/static/sounds/call_end.mp3');
        }
        
        scriptProcessorRef.current?.disconnect();
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();
        
        sessionPromiseRef.current = null;
        scriptProcessorRef.current = null;
        mediaStreamRef.current = null;
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        
        setIsLive(false);
    };

    const handleExit = () => {
        if (isGuest) {
            window.location.reload(); // Simple way to reset for guest
        } else if (user) {
            logout(); // Signs out the Firebase user
        }
    };


    return (
        <div className="chat-page-container">
            <header className="chat-header">
                <div className="flex items-center space-x-3">
                    <h1 className="text-xl font-bold tracking-wider">AikonAI</h1>
                    <span className="text-xs font-semibold text-amber-400 bg-amber-900/50 px-2 py-0.5 rounded-md border border-amber-600/50">BETA</span>
                </div>
                <div className="chat-header-actions">
                    <div className="agent-toggle">
                        <span className={`text-xs font-bold transition-colors ${isAgentModeEnabled ? 'text-amber-400' : 'text-gray-400'}`}>AGENT MODE</span>
                        <button 
                            className={`toggle-switch ${isAgentModeEnabled ? 'on' : ''}`}
                            onClick={() => setIsAgentModeEnabled(!isAgentModeEnabled)}
                            aria-label={`Turn agent mode ${isAgentModeEnabled ? 'off' : 'on'}`}
                        >
                            <motion.div className="toggle-thumb" layout />
                        </button>
                    </div>
                     <button onClick={() => setIsSettingsModalOpen(true)}>Settings</button>
                    <button onClick={handleExit}>Exit</button>
                    <button onClick={toggleTheme} className="theme-toggle-button" aria-label="Toggle theme">
                        {theme === 'dark' ? 
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : 
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                        }
                    </button>
                </div>
            </header>

            <main ref={messageLogRef} onScroll={handleScroll} className="message-log-container">
                <AnimatePresence>
                    {messages.length === 0 ? (
                        <motion.div 
                             className="chat-welcome-screen"
                             initial={{ opacity: 0 }}
                             animate={{ opacity: 1 }}
                             exit={{ opacity: 0 }}
                        >
                            <h2 className="welcome-title">Hello, {userProfile?.aboutYou || 'there'}.</h2>
                            <p className="text-xl text-gray-400 mt-2">How can AikonAI help you today?</p>
                            <div className="welcome-actions">
                                <button className="action-pill" disabled={isLoading} onClick={startLiveConversation}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                                    Start Live Conversation
                                </button>
                                {personas.slice(0, 5).map(p => (
                                     <button key={p.name} className="action-pill" disabled={isLoading} onClick={() => setActivePersona(p)}>
                                        <span className="text-lg">{p.icon}</span> {p.name}
                                    </button>
                                ))}
                                {personas.length > 5 && (
                                     <button className="action-pill" disabled={isLoading} onClick={() => setIsPersonaMenuOpen(true)}>+ More Personas</button>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <div className="max-w-3xl mx-auto w-full px-4">
                            {messages.map(message => (
                                <motion.div
                                    key={message.id}
                                    className={`message-log-item ${message.sender}`}
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.3, ease: 'easeOut' }}
                                    layout
                                >
                                    {message.sender === 'ai' && (
                                        <div className={`message-avatar ai-avatar`}>
                                        </div>
                                    )}
                                    <div className="message-content-wrapper">
                                        {message.text && (
                                            <div className={`message-content ${message.status === 'streaming' ? 'streaming' : ''}`}>
                                                {parseMarkdown(message.text).map((segment, index) => {
                                                    if (segment.type === 'paragraph') {
                                                        return <div key={index} dangerouslySetInnerHTML={{ __html: renderParagraph(segment.content) }} />;
                                                    } else {
                                                        return <CodeBlock key={index} code={segment.content} language={segment.language} filename={segment.filename} />;
                                                    }
                                                })}
                                            </div>
                                        )}
                                        {message.status === 'streaming' && !message.text && (
                                            <div className={`typing-indicator persona-${activePersona?.name.toLowerCase().replace(/ /g, '-') || 'default'}`}>
                                                <span></span><span></span><span></span>
                                            </div>
                                        )}
                                         {message.weatherData && <WeatherCard data={message.weatherData} />}
                                         {message.generatedImage && (
                                            message.generatedImage.isLoading ? (
                                                <SkeletonImageLoader aspectRatio={message.generatedImage.aspectRatio || '1:1'} prompt={message.generatedImage.prompt} />
                                            ) : (
                                                <img src={message.generatedImage.url} alt={message.generatedImage.prompt} className="rounded-lg mt-2" />
                                            )
                                        )}
                                        {message.editedImage && (
                                            message.editedImage.isLoading ? (
                                                <SkeletonImageLoader aspectRatio="1:1" prompt={message.editedImage.prompt} />
                                            ) : (
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    <img src={message.editedImage.beforeUrl} alt="Original" className="rounded-lg" />
                                                    <img src={message.editedImage.afterUrl} alt={message.editedImage.prompt} className="rounded-lg" />
                                                </div>
                                            )
                                        )}
                                         {message.generatedVideo && (
                                            <div className="mt-2">
                                                {message.generatedVideo.status === 'generating' && <div className="skeleton-loader aspect-16-9"><span>Generating video... This can take a few minutes.</span></div>}
                                                {message.generatedVideo.status === 'completed' && message.generatedVideo.url && <video src={message.generatedVideo.url} controls className="rounded-lg w-full" />}
                                                {message.generatedVideo.status === 'error' && <p className="text-red-400">Video generation failed.</p>}
                                            </div>
                                        )}
                                        {message.audioUrl && (
                                            <audio controls src={message.audioUrl} className="mt-2 w-full"></audio>
                                        )}
                                         {message.storyboardImages && <StoryboardDisplay images={message.storyboardImages} />}
                                         {message.generatedFile && (
                                            message.generatedFile.type === 'pptx' ? (
                                                <PPTPreviewCard 
                                                    data={message.generatedFile.data as PresentationData}
                                                    filename={message.generatedFile.filename}
                                                    onDownload={() => handleDownloadGeneratedFile(message)}
                                                    previewImageUrl={message.generatedFile.previewImageUrl}
                                                    isPreviewLoading={message.generatedFile.isPreviewLoading}
                                                />
                                            ) : (
                                                 <div className="file-generated-output">
                                                    <p>{message.generatedFile.message}</p>
                                                    <button className="ppt-preview-download-btn" onClick={() => handleDownloadGeneratedFile(message)}>
                                                        <DownloadIcon /> Download
                                                    </button>
                                                </div>
                                            )
                                        )}
                                        {message.generatedQRCode && (
                                            <div className="qr-code-output">
                                                <img src={message.generatedQRCode.dataUrl} alt={`QR code for ${message.generatedQRCode.text}`} />
                                                <p>{message.generatedQRCode.text}</p>
                                            </div>
                                        )}
                                         {message.workflow && <WorkflowBubble workflow={message.workflow} onApprove={(stepIndex) => handleWorkflowApproval(message.id, stepIndex)} onDeny={(stepIndex) => handleWorkflowDenial(message.id, stepIndex)} />}
                                        <SourceDisplay sources={message.sources || []} />
                                    </div>
                                    {message.sender === 'user' && (
                                        <div className="message-avatar user-avatar">
                                            {userProfile?.aboutYou?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                </motion.div>
                            ))}

                            {isLoading && messages.length > 0 && messages[messages.length-1].sender !== 'ai' && (
                                <motion.div 
                                    className="message-log-item ai"
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    layout
                                >
                                    <div className="message-avatar ai-avatar">
                                    </div>
                                    <div className="message-content-wrapper">
                                        <div className={`typing-indicator persona-${activePersona?.name.toLowerCase().replace(/ /g, '-') || 'default'}`}>
                                            <span></span><span></span><span></span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}
                </AnimatePresence>
            </main>
            
            <div className="chat-composer-container">
                {fileAttachment && (
                    <motion.div
                        className="composer-file-preview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                         <div className="composer-file-preview-inner">
                            <div className="composer-file-info">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                                <span>{fileAttachment.name}</span>
                            </div>
                            <button onClick={removeFileAttachment} className="composer-icon-button" aria-label="Remove attachment">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                    </motion.div>
                )}
                <div className="chat-composer">
                    <div className="persona-menu-container">
                        <motion.button 
                            className="composer-icon-button"
                            onClick={() => setIsPersonaMenuOpen(!isPersonaMenuOpen)}
                            whileTap={{ scale: 0.9 }}
                            aria-label="Select Persona"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </motion.button>
                         <AnimatePresence>
                        {isPersonaMenuOpen && (
                             <motion.div
                                className="persona-menu"
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            >
                                {personas.map(p => (
                                     <div key={p.name} className="persona-tooltip-wrapper">
                                        <div 
                                            className={`persona-menu-item ${activePersona?.name === p.name ? 'selected' : ''}`}
                                            onClick={() => { setActivePersona(p); setIsPersonaMenuOpen(false); }}
                                        >
                                            <span className="icon">{p.icon}</span>
                                            <span>{p.name}</span>
                                        </div>
                                        <div className="persona-tooltip">{p.description}</div>
                                    </div>
                                ))}
                                 <div className="create-persona-button">
                                    <div className="persona-menu-item" onClick={() => { setEditingPersona(null); setIsPersonaModalOpen(true); setIsPersonaMenuOpen(false); }}>
                                        <span className="icon">➕</span>
                                        <span>Create New Persona</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                        </AnimatePresence>
                    </div>
                    <button className="composer-icon-button" onClick={() => fileInputRef.current?.click()} aria-label="Attach file">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                    <textarea
                        ref={textareaRef}
                        className="composer-textarea"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        placeholder="Ask AikonAI..."
                        rows={1}
                        disabled={isLoading}
                    />
                    <motion.button 
                        className="composer-icon-button composer-send-button"
                        onClick={() => handleSendMessage()}
                        disabled={isLoading || (!input.trim() && !fileAttachment)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        aria-label="Send message"
                    >
                         {isLoading ? 
                            <div className="w-5 h-5 border-2 border-t-transparent border-gray-500 rounded-full animate-spin"></div> :
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                        }
                    </motion.button>
                </div>
                 {activePersona && (
                    <motion.div
                        className="active-persona-indicator"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <span>{activePersona.icon}</span>
                        <span>{activePersona.name}</span>
                        <button onClick={() => setActivePersona(null)} aria-label="Clear active persona">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                    </motion.div>
                )}
            </div>
            
             <AnimatePresence>
            {isLive && (
                <motion.div 
                    className="live-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <div className="live-content">
                        <div className={`live-orb ${liveStatus.startsWith('Connected') ? 'connected' : ''}`}>
                            <div className="live-orb-inner"></div>
                        </div>
                        <p className="live-status">{liveStatus}</p>
                        <button className="live-disconnect-button" onClick={() => stopLiveConversation()}>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M14.414 14.414a2 2 0 01-2.828 0L10 12.828l-1.586 1.586a2 2 0 11-2.828-2.828L7.172 10 5.586 8.414a2 2 0 112.828-2.828L10 7.172l1.586-1.586a2 2 0 112.828 2.828L12.828 10l1.586 1.586zM2 10a8 8 0 1116 0 8 8 0 01-16 0z" /></svg>
                            Disconnect
                        </button>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
            <AnimatePresence>
                {isSettingsModalOpen && (
                    <SettingsModal
                        isOpen={isSettingsModalOpen}
                        onClose={() => setIsSettingsModalOpen(false)}
                        profile={userProfile}
                        onSave={(settings) => {
                            if (user?.uid) {
                                // Assume updateUserProfile exists in firebase services
                                // updateUserProfile(user.uid, settings);
                                refetchProfile();
                            }
                            setIsSettingsModalOpen(false);
                        }}
                        onDeleteAllChats={() => {
                            setMessages([]);
                            setChatHistory([]);
                            setIsSettingsModalOpen(false);
                        }}
                    />
                )}
            </AnimatePresence>

        </div>
    );
};

export default AikonChatPage;