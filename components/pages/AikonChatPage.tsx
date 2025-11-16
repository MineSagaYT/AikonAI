

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { NavigationProps, FileAttachment, Message, Source, Task, ChatListItem, MessageSender, Workflow, WorkflowStep, CanvasFiles, UserProfile, VirtualFile, StructuredToolOutput, Persona, PresentationData, WordData, ExcelData, CodeExecutionHistoryItem, InteractiveChartData } from '../../types';
import { streamMessageToChat, generateImage, editImage, fetchVideoFromUri, generatePlan, runWorkflowStep, performGoogleSearch, browseWebpage, summarizeDocument, generateSpeech, generatePresentationContent, generateWordContent, generateExcelContent, analyzeBrowsedContent, generateVideo, executePythonCode, aikonPersonaInstruction } from '../../services/geminiService';
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
// REMOVED: import shortLogo from '../../short_logo.jpeg';



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

const PptPreviewCard: React.FC<{ 
    file: NonNullable<Message['generatedFile']>; 
    onDownload: () => void;
}> = ({ file, onDownload }) => {

    const canDownload = !!file.data;

    const PptIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v1H2V6z" />
            <path fillRule="evenodd" d="M2 8v8a2 2 0 002 2h12a2 2 0 002-2V8H2zm12 4a1 1 0 100-2h-2a1 1 0 100 2h2zM7 12a1 1 0 100-2H5a1 1 0 100 2h2z" clipRule="evenodd" />
        </svg>
    );

    return (
        <div className="ppt-preview-card">
            <div className="ppt-preview-image-container">
                {file.isPreviewLoading ? (
                    <SkeletonLoader text="Generating preview..." aspectRatio="16:9" />
                ) : file.previewImageUrl ? (
                    <img src={file.previewImageUrl} alt="Presentation Preview" className="ppt-preview-image" />
                ) : (
                    <div className="ppt-preview-no-image">
                        <PptIcon />
                    </div>
                )}
            </div>
            <div className="ppt-preview-content">
                <div className="ppt-preview-header">
                    <PptIcon />
                    <span>PRESENTATION</span>
                </div>
                <h4 className="ppt-preview-title">{file.filename}</h4>
            </div>
            <div className="ppt-preview-footer">
                <motion.button 
                    className="ppt-preview-download-btn" 
                    onClick={onDownload}
                    disabled={!canDownload}
                    whileHover={{ scale: canDownload ? 1.05 : 1 }}
                    whileTap={{ scale: canDownload ? 0.95 : 1 }}
                >
                    <DownloadIcon />
                    {canDownload ? 'Download .pptx' : 'Generation Failed'}
                </motion.button>
            </div>
        </div>
    );
};


const MessageLogItem = memo(({ message, onApprove, onDeny, onViewImage, userProfile, onDownloadGeneratedFile, onConfirmWorkflow, onCancelWorkflow, theme }: { message: Message; onApprove: (stepIndex: number) => void; onDeny: (stepIndex: number) => void; onViewImage: (url: string) => void; userProfile: UserProfile | null; onDownloadGeneratedFile: (data: any, type: string, filename: string) => void; onConfirmWorkflow: (messageId: string) => void; onCancelWorkflow: (messageId: string) => void; theme: 'light' | 'dark' }) => {
    
    const isAi = message.sender === 'ai';
    
    const statusText = message.text || (message.segments && message.segments[0]?.content);
    const isStatusUpdate = statusText?.startsWith('STATUS:') || statusText?.startsWith('Browsing') || statusText?.startsWith('Analyzing');

    const itemVariants: Variants = {
        hidden: { opacity: 0, y: 10, scale: 0.98 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: { type: "spring", stiffness: 400, damping: 25 }
        }
    };

    if (isStatusUpdate) {
        return (
             <motion.div 
                className="message-bubble-wrapper ai" 
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                layout
             >
                 <div className="message-avatar ai-avatar">
                     <img src="/short_logo.jpeg" alt="AikonAI Logo" className="w-full h-full object-cover rounded-full" />
                 </div>
                 <div className="message-content-wrapper" style={{ padding: '0.8rem 1.25rem' }}>
                    <div className="message-content status-update">
                         <svg className="animate-spin h-4 w-4 text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{statusText.replace('STATUS: ', '')}</span>
                    </div>
                </div>
            </motion.div>
        )
    }

    const messageContent = () => {
        if (message.weatherData) {
            return <WeatherCard data={message.weatherData} />;
        }
        if (message.interactiveChartData) {
            return <InteractiveChart chartData={message.interactiveChartData} theme={theme} />;
        }
        if (message.requiresAction === 'workflow_confirmation' && !message.actionTaken) {
            const { goal, plan } = message.actionData;
            return (
                <div className="workflow-confirmation-container">
                    <p className="message-content" dangerouslySetInnerHTML={{ __html: renderParagraph(message.text) }} />
                    <h4 className="workflow-confirmation-header">Confirm Autonomous Workflow</h4>
                    <p className="workflow-confirmation-goal"><strong>Goal:</strong> {goal}</p>
                    <div className="workflow-confirmation-plan">
                        <h5>Proposed Plan:</h5>
                        <ol>
                            {plan.map((step: string, index: number) => <li key={index}>{step}</li>)}
                        </ol>
                    </div>
                    <div className="workflow-confirmation-buttons">
                        <motion.button className="deny-btn" onClick={() => onCancelWorkflow(message.id)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Cancel</motion.button>
                        <motion.button className="approve-btn" onClick={() => onConfirmWorkflow(message.id)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Confirm & Proceed</motion.button>
                    </div>
                </div>
            )
        }
        if (message.requiresAction === 'open_mailto' && !message.actionTaken) {
            return (
                <div className="message-content">
                    <div dangerouslySetInnerHTML={{ __html: renderParagraph(message.text) }} />
                    <a
                        href={message.actionData.mailtoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg items-center gap-2 transition-transform transform hover:scale-1.05"
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
            return <div className="message-content"><TaskList tasks={message.tasks} onTaskUpdate={() => {}} /></div>;
        }
        if (message.storyboardImages) {
            return (
                <div className="message-content">
                    <h4 className="font-bold text-amber-400 mb-2">Here's your study board!</h4>
                    <div className="storyboard-grid">
                        {message.storyboardImages.map((panel, index) => (
                            <div key={index} className="storyboard-panel">
                                {panel.url ? (
                                    <img 
                                        src={panel.url} 
                                        alt={panel.prompt} 
                                        className="cursor-pointer"
                                        onClick={() => onViewImage(panel.url)} 
                                    />
                                ) : (
                                    <SkeletonLoader text={`Panel ${index + 1}...`} aspectRatio="1:1" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )
        }
        if (message.generatedFile) {
            if (message.generatedFile.type === 'pptx') {
                return <PptPreviewCard file={message.generatedFile} onDownload={() => onDownloadGeneratedFile(message.generatedFile!.data, 'pptx', message.generatedFile!.filename)} />;
            }
            
            // This handles DOCX, XLSX, and cases from workflow agent that don't have data attached for download
            const canDownload = message.generatedFile.data && message.generatedFile.type;
            return (
                 <div className="file-generated-output">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p>{message.generatedFile.message}</p>
                     {canDownload ? (
                         <motion.button 
                            className="copy-button" 
                            onClick={() => onDownloadGeneratedFile(message.generatedFile!.data, message.generatedFile!.type!, message.generatedFile!.filename)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                         >
                            <DownloadIcon />
                            Download
                        </motion.button>
                    ) : (
                        <span>{message.generatedFile.filename}</span>
                    )}
                </div>
            );
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
                return <div className="message-content"><div className="flex items-center gap-2"><div className="spinner"></div> Generating video...</div></div>;
            }
            if (message.generatedVideo.status === 'completed' && message.generatedVideo.url) {
                return <video src={message.generatedVideo.url} controls className="rounded-lg w-full" />;
            }
             if (message.generatedVideo.status === 'error') {
                return <div className="message-content"><div className="text-red-400">Video generation failed.</div></div>;
            }
        }
        if (message.audioUrl) {
            return (
                <div className="message-content">
                    <div className="flex items-center gap-2 w-full max-w-sm p-2 bg-zinc-800/50 rounded-lg">
                        <audio controls src={message.audioUrl} className="flex-grow w-full" />
                        <a href={message.audioUrl} download={`aikonai-speech-${Date.now()}.wav`} className="p-2 bg-zinc-700 text-white rounded-full hover:bg-zinc-600 transition-colors" title="Download audio">
                            <DownloadIcon />
                        </a>
                    </div>
                </div>
            );
        }

        if (message.generatedQRCode) {
            return (
                <div className="qr-code-output">
                    <img src={message.generatedQRCode.dataUrl} alt={`QR Code for ${message.generatedQRCode.text}`} />
                    <p>{message.generatedQRCode.text}</p>
                </div>
            )
        }

        const streamingClass = message.status === 'streaming' ? 'streaming' : '';

        return (
            <div className={`message-content ${streamingClass}`}>
                 {message.sender === 'user' && message.attachments && message.attachments.length > 0 && (
                    <div className="user-attachments-container mb-2">
                        {message.attachments.map((att, index) => {
                            if (att.mimeType.startsWith('image/')) {
                                const url = `data:${att.mimeType};base64,${att.base64}`;
                                return (
                                    <img
                                        key={index}
                                        src={url}
                                        alt={att.name}
                                        className="rounded-lg max-w-[120px] max-h-[120px] object-cover cursor-pointer transition-transform hover:scale-105"
                                        onClick={() => onViewImage(url)}
                                    />
                                );
                            }
                            return (
                                <div key={index} className="file-attachment-chip" title={att.name}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.452a1.125 1.125 0 001.59 1.591l3.456-3.554a3 3 0 000-4.242z" clipRule="evenodd" /></svg>
                                    <span className="truncate">{att.name}</span>
                                </div>
                            );
                        })}
                    </div>
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
        <motion.div
            className={`message-log-item ${isAi ? 'ai' : 'user'}`}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            layout
        >
            <div className="message-bubble-wrapper">
                {isAi && (
                    <div className="message-avatar ai-avatar">
                        <img src="/short_logo.jpeg" alt="AikonAI Logo" className="w-full h-full object-cover rounded-full" />
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
        </motion.div>
    );
});

type ActivityType = 'chat' | 'browsing' | 'workflow' | 'image_gen' | 'speech' | null;

interface TypingIndicatorProps {
    activity: ActivityType;
    persona: Persona | null;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ activity, persona }) => {
    const getPersonaClass = (p: Persona | null): string => {
        if (!p) return 'persona-default';
        // Creates a kebab-case class name from the persona name
        const className = `persona-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
        return className;
    };

    const activityClass = activity ? `task-${activity.replace(/_/g, '-')}` : '';
    const personaClass = getPersonaClass(persona);
    
    const indicatorClasses = ['typing-indicator', activityClass, personaClass].filter(Boolean).join(' ');

    return (
        <motion.div 
            className="message-bubble-wrapper ai"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
        >
            <div className="message-avatar ai-avatar">
                <img src="/short_logo.jpeg" alt="AikonAI Logo" className="w-full h-full object-cover rounded-full" />
            </div>
            <div className={indicatorClasses}>
                <span></span><span></span><span></span>
            </div>
        </motion.div>
    );
};


const ChatComposer: React.FC<{
    onSendMessage: (message: string, files: FileAttachment[]) => void;
    isLoading: boolean;
    input: string;
    setInput: (value: string) => void;
    attachments: FileAttachment[];
    setAttachments: React.Dispatch<React.SetStateAction<FileAttachment[]>>;
    onCancel: () => void;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
}> = ({ onSendMessage, isLoading, input, setInput, attachments, setAttachments, onCancel, textareaRef }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSendMessage = () => {
        const trimmedInput = input.trim();
        if (trimmedInput || attachments.length > 0) {
            onSendMessage(trimmedInput, attachments);
            setInput('');
            setAttachments([]);
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleSendOrCancel = () => {
        if (isLoading) {
            onCancel();
        } else {
            handleSendMessage();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendOrCancel();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (selectedFiles) {
            const filesArray = Array.from(selectedFiles);
            const filesToProcess = filesArray;

            for (const file of filesToProcess) {
                const currentFile = file as File;
                const reader = new FileReader();
                reader.onload = (loadEvent) => {
                    const base64 = (loadEvent.target?.result as string)?.split(',')[1];
                    if (base64) {
                        const newAttachment: FileAttachment = {
                            name: currentFile.name,
                            mimeType: currentFile.type,
                            base64,
                        };
                        setAttachments(prev => [...prev, newAttachment]);
                    }
                };
                reader.readAsDataURL(currentFile);
            }
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob: File | null = items[i].getAsFile();
                if (blob) {
                    const fileBlob = blob;
                     const reader = new FileReader();
                    reader.onload = (loadEvent) => {
                         const base64 = (loadEvent.target?.result as string)?.split(',')[1];
                        if (base64) {
                             setAttachments(prev => [...prev, {
                                name: 'pasted-image.png',
                                mimeType: fileBlob.type,
                                base64,
                            }]);
                        }
                    };
                    reader.readAsDataURL(fileBlob);
                }
                break;
            }
        }
    };
    
    const removeAttachment = (indexToRemove: number) => {
        setAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    useEffect(() => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto'; // Reset height
            const scrollHeight = ta.scrollHeight;
            ta.style.height = `${scrollHeight}px`;
        }
    }, [input, textareaRef]);

    return (
        <div className="chat-composer-container">
             <AnimatePresence>
                {attachments.length > 0 && (
                    <motion.div
                        className="composer-file-preview"
                        initial={{ opacity: 0, y: 10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: 10, height: 0 }}
                    >
                        <div className="composer-multi-file-container">
                            {attachments.map((att, index) => (
                                <motion.div key={index} className="composer-file-thumb" layout>
                                    {att.mimeType.startsWith('image/') ? (
                                        <img src={`data:${att.mimeType};base64,${att.base64}`} alt={att.name} />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                            <span className="text-xs truncate w-full mt-1">{att.name}</span>
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => removeAttachment(index)} 
                                        className="remove-attachment-btn"
                                        title="Remove file"
                                    >
                                        &times;
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="chat-composer">
                <motion.button
                    className="composer-icon-button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                </motion.button>
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,text/*,.pdf,.csv,.json,.xml,.html,.css,.js,.ts,.tsx,.py,.md"
                    multiple
                />
                <motion.textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder="Ask AikonAI..."
                    rows={1}
                    className="composer-textarea"
                    layout
                />
                 <motion.button
                    onClick={handleSendOrCancel}
                    disabled={!isLoading && (!input.trim() && attachments.length === 0)}
                    className="composer-icon-button composer-send-button"
                    title={isLoading ? "Cancel Generation" : "Send"}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                     <AnimatePresence mode="popLayout" initial={false}>
                         <motion.div
                             key={isLoading ? 'cancel' : 'send'}
                             initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                             animate={{ opacity: 1, scale: 1, rotate: 0 }}
                             exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
                             transition={{ duration: 0.2, type: 'spring', stiffness: 400, damping: 20 }}
                         >
                             {isLoading ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <rect width="12" height="12" x="4" y="4" rx="2" />
                                </svg>
                             ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                                </svg>
                             )}
                         </motion.div>
                     </AnimatePresence>
                </motion.button>
            </div>
        </div>
    );
};

const ImageViewer: React.FC<{ imageUrl: string; onClose: () => void }> = ({ imageUrl, onClose }) => (
    <motion.div 
        className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-[200]" 
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
    >
        <motion.img 
            src={imageUrl} 
            alt="Full screen view" 
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            layoutId={`image-${imageUrl}`}
        />
    </motion.div>
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
        <motion.div 
            className="live-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div 
                className="live-content"
                initial={{ y: 20, scale: 0.95 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 20, scale: 0.95 }}
            >
                <p className="live-status">{getStatusText()}</p>
                <div className={`live-orb ${connectionState === 'connected' ? 'connected' : ''}`}>
                    {connectionState === 'connecting' && <div className="w-8 h-8 border-4 border-white/50 border-t-white rounded-full animate-spin"></div>}
                    {connectionState === 'connected' && <div className="live-orb-inner"></div>}
                     {connectionState === 'error' && <span className="text-red-500 text-4xl">!</span>}
                </div>
                <motion.button 
                    className="live-disconnect-button" 
                    onClick={onDisconnect}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2 2m-2-2v2.5M20 14v.5a2.5 2.5 0 01-2.5 2.5h-10A2.5 2.5 0 015 16.5V7.954a2.5 2.5 0 011.56-2.318l4.5-1.5a2.5 2.5 0 013.12 1.064M16 8a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    End Conversation
                </motion.button>
            </motion.div>
        </motion.div>
    );
};


const CustomPersonaModal: React.FC<{
    onClose: () => void;
    onSave: (persona: Persona, originalName?: string) => void;
    personaToEdit?: Persona | null;
}> = ({ onClose, onSave, personaToEdit }) => {
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('');
    const [description, setDescription] = useState('');
    const [systemInstruction, setSystemInstruction] = useState('');
    
    useEffect(() => {
        if (personaToEdit) {
            setName(personaToEdit.name);
            setIcon(personaToEdit.icon);
            setDescription(personaToEdit.description);
            setSystemInstruction(personaToEdit.systemInstruction);
        } else {
            setName('');
            setIcon('');
            setDescription('');
            setSystemInstruction('');
        }
    }, [personaToEdit]);

    const handleSave = () => {
        if (name.trim() && systemInstruction.trim()) {
            onSave({
                name: name.trim(),
                icon: icon.trim() || '👤',
                description: description.trim(),
                systemInstruction: systemInstruction.trim(),
                isCustom: true,
            }, personaToEdit?.name);
        }
    };

    return (
        <motion.div 
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div 
                className="modal-content" style={{ maxWidth: '600px' }}
                initial={{ y: 20, scale: 0.95 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 20, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
                <h2>{personaToEdit ? 'Edit Custom Persona' : 'Create Custom Persona'}</h2>
                <div className="form-group">
                    <label htmlFor="persona-name">Persona Name</label>
                    <input id="persona-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Sarcastic Python Developer" />
                </div>
                <div className="form-group">
                    <label htmlFor="persona-icon">Icon (Emoji)</label>
                    <input id="persona-icon" type="text" value={icon} onChange={e => setIcon(e.target.value)} placeholder="e.g., 🐍" />
                </div>
                 <div className="form-group">
                    <label htmlFor="persona-desc">Description (for tooltip)</label>
                    <textarea id="persona-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., A developer persona that provides Python code with a witty, sarcastic tone." />
                </div>
                <div className="form-group">
                    <label htmlFor="persona-instruction">System Instruction (The AI's rules)</label>
                    <textarea id="persona-instruction" value={systemInstruction} onChange={e => setSystemInstruction(e.target.value)} placeholder="You are a senior Python developer who is brilliant but also very sarcastic..." rows={6} />
                </div>
                <div className="modal-footer">
                    <motion.button onClick={onClose} className="secondary" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Cancel</motion.button>
                    <motion.button onClick={handleSave} className="primary" disabled={!name.trim() || !systemInstruction.trim()} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Save Persona</motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
};

const CodeHistoryPanel: React.FC<{
    history: CodeExecutionHistoryItem[],
    onRerun: (code: string) => void,
    onClose: () => void,
}> = ({ history, onRerun, onClose }) => {
    
    const handleCopy = (code: string) => {
        navigator.clipboard.writeText(code);
    };

    return (
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
                    <p className="text-center text-gray-500 italic mt-4">No code has been run yet.</p>
                ) : (
                    history.map(item => (
                        <div key={item.id} className="code-history-item">
                            <div className="code-history-item-code">
                               <CodeBlock code={item.code} language="python" />
                            </div>
                            <div className="code-history-item-footer">
                                <span className="code-history-timestamp">
                                    {item.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </span>
                                <div className="flex gap-2 code-history-actions">
                                    <button onClick={() => handleCopy(item.code)}>Copy</button>
                                    <button onClick={() => onRerun(item.code)}>Rerun</button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </motion.div>
    );
};


const AikonChatPage: React.FC<NavigationProps> = ({ navigateTo }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [history, setHistory] = useState<Content[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const { currentUser: authUserProfile, updateCurrentUser } = useAuth();
    
    const [userSettings, setUserSettings] = useState<Partial<UserProfile>>({});
    
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const savedTheme = localStorage.getItem('aikon-chat-theme');
        return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark';
    });

    const [isAgentModeEnabled, setIsAgentModeEnabled] = useState<boolean>(false);
    const [currentActivity, setCurrentActivity] = useState<ActivityType>(null);
    const [welcomeMessage, setWelcomeMessage] = useState<string>('');
    const [codeHistory, setCodeHistory] = useState<CodeExecutionHistoryItem[]>([]);
    const [isCodeHistoryOpen, setIsCodeHistoryOpen] = useState(false);


    const welcomeMessages = [
        "Ready to build something amazing?",
        "What's on your mind today?",
        "Let's bring your ideas to life.",
        "How can I assist you?",
        "Ask me anything, from code to creativity.",
        "Your digital companion, at your service.",
        "Let's get started."
    ];

    useEffect(() => {
        setWelcomeMessage(welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]);
    }, []);


    useEffect(() => {
        const body = document.body;
        body.classList.remove('dark-theme-body');
        
        if (theme === 'light') {
            body.classList.add('light-theme-chat');
            body.classList.remove('dark-theme-chat');
        } else {
            body.classList.add('dark-theme-chat');
            body.classList.remove('light-theme-chat');
        }
        
        localStorage.setItem('aikon-chat-theme', theme);

        return () => {
            body.classList.remove('light-theme-chat', 'dark-theme-chat');
            body.classList.add('dark-theme-body');
        };
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    };

    const SunIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>);
    const MoonIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>);

    useEffect(() => {
        if (authUserProfile) {
            setUserSettings(authUserProfile);
        }
    }, [authUserProfile]);

    const [input, setInput] = useState('');
    const [attachments, setAttachments] = useState<FileAttachment[]>([]);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [lastActiveImage, setLastActiveImage] = useState<FileAttachment | null>(null);

    // Persona State
    const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
    const [currentPersona, setCurrentPersona] = useState<Persona | null>(null);
    const [availablePersonas, setAvailablePersonas] = useState<Persona[]>(() => {
        try {
            const saved = localStorage.getItem(CUSTOM_PERSONAS_STORAGE_KEY);
            const custom = saved ? JSON.parse(saved) : [];
            return [...PERSONAS, ...custom];
        } catch (e) {
            console.error("Failed to parse custom personas from localStorage", e);
            return [...PERSONAS];
        }
    });
    const [isCustomPersonaModalOpen, setIsCustomPersonaModalOpen] = useState(false);
    const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
    const personaMenuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Code Interpreter State
    const [sessionFiles, setSessionFiles] = useState<VirtualFile[]>([]);
    const [isCanvasVisible, setIsCanvasVisible] = useState(false);
    const [canvasFiles, setCanvasFiles] = useState<CanvasFiles>({});
    const isCancelledRef = useRef(false);
    // FIX: Add a ref for the textarea to allow focusing from a parent component action.
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    const handleWorkflowToolCall = useCallback(async (
        tool_call: { name: string; args: any },
        currentFiles: VirtualFile[]
    ): Promise<{ output: StructuredToolOutput; updatedFiles: VirtualFile[] }> => {
        let output: StructuredToolOutput = null;
        let updatedFiles = [...currentFiles];

        switch (tool_call.name) {
            case 'search_and_summarize': {
                const searchResult = await performGoogleSearch(tool_call.args.query);
                output = { type: 'text', content: searchResult.text || "I searched online but couldn't find a clear answer." };
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

    const executeConfirmedWorkflow = useCallback(async (goal: string, plan: string[], files: FileAttachment[]) => {
        setIsLoading(true);
        setCurrentActivity('workflow');
        playSound('https://storage.googleapis.com/gemini-web-codelab-assets/codelab-magic-edit/workflow_start.mp3', 0.5);
        
        let localSessionFiles = [...sessionFiles];
        if (files && files.length > 0) {
            for (const file of files) {
                try {
                    const content = atob(file.base64);
                    const newFile = { name: file.name, content };
                    const existingIndex = localSessionFiles.findIndex(f => f.name === newFile.name);
                    if (existingIndex > -1) {
                        localSessionFiles[existingIndex] = newFile;
                    } else {
                        localSessionFiles.push(newFile);
                    }
                } catch(e) { console.error(`Error decoding file ${file.name} for workflow:`, e); }
            }
            setSessionFiles(localSessionFiles);
        }

        let workflow: Workflow = { goal, plan, steps: [], status: 'running', finalContent: null };
        const workflowMessageId = (Date.now() + 1).toString();
        const initialWorkflowMessage: Message = { id: workflowMessageId, text: '', sender: 'ai', timestamp: new Date(), workflow: { ...workflow } };
        setMessages(prev => [...prev, initialWorkflowMessage]);

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

        setSessionFiles(localSessionFiles);
        
        setIsLoading(false);
        setCurrentActivity(null);
    }, [sessionFiles, handleWorkflowToolCall]);

    const initiateWorkflow = async (goal: string, files: FileAttachment[]) => {
        setIsLoading(true);
        setCurrentActivity('workflow');
        
        const statusMessageId = Date.now().toString();
        const statusMessage: Message = {
            id: statusMessageId,
            text: 'STATUS: Generating a plan for your request...',
            sender: 'ai',
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, statusMessage]);
    
        const planResult = await generatePlan(goal);
        
        setMessages(prev => prev.filter(m => m.id !== statusMessageId));
    
        if ('error' in planResult) {
            const errorMessage: Message = {
                id: Date.now().toString(),
                text: `I couldn't create a plan for that goal. ${planResult.error}`,
                sender: 'ai',
                timestamp: new Date(),
                segments: parseMarkdown(`I couldn't create a plan for that goal. ${planResult.error}`)
            };
            setMessages(prev => [...prev, errorMessage]);
            setIsLoading(false);
            setCurrentActivity(null);
            return;
        }
    
        const confirmationMessageId = Date.now().toString();
        const confirmationMessage: Message = {
            id: confirmationMessageId,
            text: "Here is the plan to achieve your goal. Please review and confirm to proceed.",
            sender: 'ai',
            timestamp: new Date(),
            requiresAction: 'workflow_confirmation',
            actionData: { goal, plan: planResult.plan, files },
            actionTaken: false,
        };
        setMessages(prev => [...prev, confirmationMessage]);
        setIsLoading(false);
    };

    const handleConfirmWorkflow = useCallback(async (messageId: string) => {
        const message = messages.find(m => m.id === messageId);
        if (!message || !message.actionData) return;
    
        setMessages(prev => prev.map(m => 
            m.id === messageId 
            ? { ...m, actionTaken: true, text: 'Plan confirmed. Starting workflow...' } 
            : m
        ));
    
        const { goal, plan, files } = message.actionData;
        await executeConfirmedWorkflow(goal, plan, files);
    
    }, [messages, executeConfirmedWorkflow]);
    
    const handleCancelWorkflow = (messageId: string) => {
        setMessages(prev => prev.map(m => 
            m.id === messageId 
            ? { ...m, actionTaken: true, text: 'Workflow cancelled.' } 
            : m
        ));
        setCurrentActivity(null);
    };


    const handleToolCall = useCallback(async (aiMessageId: string, toolCall: { tool_call: string; [key: string]: any }) => {
        const { tool_call, ...args } = toolCall;

        // A helper to update a specific message
        const updateMessage = (id: string, updates: Partial<Message>) => {
            setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
        };

        try {
            switch (tool_call) {
                case 'get_weather':
                    setCurrentActivity('browsing');
                    updateMessage(aiMessageId, { text: `STATUS: Fetching weather for ${args.city}...` });
                    const weatherResult = await fetchWeather(args.city);
                    if ('error' in weatherResult) {
                        updateMessage(aiMessageId, { text: weatherResult.error, status: 'sent', segments: parseMarkdown(weatherResult.error) });
                    } else {
                        updateMessage(aiMessageId, { weatherData: weatherResult, text: '', status: 'sent' });
                    }
                    break;

                case 'generate_image':
                    setCurrentActivity('image_gen');
                    updateMessage(aiMessageId, {
                        generatedImage: { prompt: args.prompt, isLoading: true, aspectRatio: '1:1' }
                    });
                    const imageUrl = await generateImage(args.prompt);
                    updateMessage(aiMessageId, {
                        generatedImage: { prompt: args.prompt, isLoading: false, url: imageUrl || undefined }
                    });
                    break;
                
                case 'edit_image':
                    if (!lastActiveImage) {
                         updateMessage(aiMessageId, { text: "Please upload an image first to use the edit tool.", status: 'sent', segments: parseMarkdown("Please upload an image first to use the edit tool.") });
                        return;
                    }
                    setCurrentActivity('image_gen');
                    updateMessage(aiMessageId, {
                        editedImage: { beforeUrl: `data:${lastActiveImage.mimeType};base64,${lastActiveImage.base64}`, prompt: args.prompt, isLoading: true }
                    });
                    const editedUrl = await editImage(lastActiveImage, args.prompt);
                    updateMessage(aiMessageId, {
                        editedImage: { beforeUrl: `data:${lastActiveImage.mimeType};base64,${lastActiveImage.base64}`, prompt: args.prompt, isLoading: false, afterUrl: editedUrl || undefined }
                    });
                    break;

                case 'generate_video':
                    let operation = await generateVideo(args.prompt);
                    if (operation) {
                        updateMessage(aiMessageId, { generatedVideo: { status: 'generating', prompt: args.prompt } });
                        const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });
                        while (operation && !operation.done) {
                            await new Promise(resolve => setTimeout(resolve, 5000));
                             const ai = getAi();
                            operation = await ai.operations.getVideosOperation({ operation: operation });
                        }
                        if (operation?.response?.generatedVideos?.[0]?.video?.uri) {
                            const videoBlob = await fetchVideoFromUri(operation.response.generatedVideos[0].video.uri);
                            const videoUrl = URL.createObjectURL(videoBlob);
                            updateMessage(aiMessageId, { generatedVideo: { status: 'completed', prompt: args.prompt, url: videoUrl } });
                        } else {
                             updateMessage(aiMessageId, { generatedVideo: { status: 'error', prompt: args.prompt } });
                        }
                    } else {
                         updateMessage(aiMessageId, { text: "Video generation is not available at the moment.", status: 'sent' });
                    }
                    break;

                case 'text_to_speech':
                     setCurrentActivity('speech');
                    updateMessage(aiMessageId, { text: `STATUS: Generating audio for: "${args.text}"` });
                    const base64Audio = await generateSpeech(args.text);
                    if (base64Audio) {
                        const pcmData = decode(base64Audio);
                        const wavBlob = pcmToWav(pcmData, 24000, 1, 16);
                        const audioUrl = URL.createObjectURL(wavBlob);
                        updateMessage(aiMessageId, { text: '', audioUrl: audioUrl, status: 'sent' });
                    } else {
                        updateMessage(aiMessageId, { text: "Sorry, I couldn't generate the audio.", status: 'sent' });
                    }
                    break;
                
                 case 'create_storyboard':
                    setCurrentActivity('image_gen');
                    const prompts = args.prompts as string[];
                    if (!prompts || prompts.length === 0) {
                        updateMessage(aiMessageId, { text: "The storyboard needs at least one scene description.", status: 'sent', segments: parseMarkdown("The storyboard needs at least one scene description.") });
                        break;
                    }
                    updateMessage(aiMessageId, {
                        storyboardImages: prompts.map(p => ({ prompt: p, url: '' })),
                        text: '',
                        status: 'sent'
                    });
                    const imagePromises = prompts.map(prompt => generateImage(prompt, '1:1'));
                    imagePromises.forEach((promise, index) => {
                        promise.then(imageUrl => {
                            setMessages(prev => prev.map(m => {
                                if (m.id === aiMessageId && m.storyboardImages) {
                                    const updatedStoryboard = [...m.storyboardImages];
                                    updatedStoryboard[index] = { ...updatedStoryboard[index], url: imageUrl || 'error' };
                                    return { ...m, storyboardImages: updatedStoryboard };
                                }
                                return m;
                            }));
                        });
                    });
                    break;

                case 'create_powerpoint':
                    setCurrentActivity('workflow');
                    updateMessage(aiMessageId, { text: `STATUS: Generating content for presentation on "${args.topic}"...` });
                    const pptData = await generatePresentationContent(args.topic, args.num_slides || 5);
                    if ('error' in pptData) {
                        updateMessage(aiMessageId, { text: pptData.error, status: 'sent', segments: parseMarkdown(pptData.error) });
                    } else {
                        updateMessage(aiMessageId, {
                            generatedFile: { type: 'pptx', filename: `${args.topic.replace(/ /g, '_')}.pptx`, message: `I've prepared a presentation on "${args.topic}".`, data: pptData, isPreviewLoading: true },
                            text: '',
                            status: 'sent'
                        });

                        // Generate a preview image for the first slide
                        const previewPrompt = `Create a visually appealing, abstract, professional title slide background image for a presentation titled "${args.topic}". Use a modern, corporate style with colors like deep blue, gold, and white. Minimalist design.`;
                        const previewUrl = await generateImage(previewPrompt, '16:9');
                        updateMessage(aiMessageId, {
                             generatedFile: { type: 'pptx', filename: `${args.topic.replace(/ /g, '_')}.pptx`, message: `I've prepared a presentation on "${args.topic}".`, data: pptData, isPreviewLoading: false, previewImageUrl: previewUrl || undefined },
                        });
                    }
                    break;

                case 'create_word_document':
                     setCurrentActivity('workflow');
                    updateMessage(aiMessageId, { text: `STATUS: Generating content for document on "${args.topic}"...` });
                    const docData = await generateWordContent(args.topic, args.sections);
                    if ('error' in docData) {
                        updateMessage(aiMessageId, { text: docData.error, status: 'sent', segments: parseMarkdown(docData.error) });
                    } else {
                         updateMessage(aiMessageId, {
                            generatedFile: { type: 'docx', filename: `${args.topic.replace(/ /g, '_')}.docx`, message: `Here is the Word document on "${args.topic}".`, data: docData },
                            text: '',
                            status: 'sent'
                        });
                    }
                    break;

                 case 'create_excel_spreadsheet':
                    setCurrentActivity('workflow');
                    updateMessage(aiMessageId, { text: `STATUS: Generating spreadsheet data for "${args.data_description}"...` });
                    const excelData = await generateExcelContent(args.data_description, args.columns);
                    if ('error' in excelData) {
                        updateMessage(aiMessageId, { text: excelData.error, status: 'sent', segments: parseMarkdown(excelData.error) });
                    } else {
                         updateMessage(aiMessageId, {
                            generatedFile: { type: 'xlsx', filename: `${args.filename}.xlsx`, message: `Here is the spreadsheet for "${args.data_description}".`, data: { ...excelData, filename: args.filename } },
                            text: '',
                            status: 'sent'
                        });
                    }
                    break;
                
                case 'create_pdf_document':
                    setCurrentActivity('workflow');
                    updateMessage(aiMessageId, { text: `STATUS: Generating content for PDF document on "${args.topic}"...` });
                    const pdfDocData = await generateWordContent(args.topic, args.sections);
                    if ('error' in pdfDocData) {
                        updateMessage(aiMessageId, { text: pdfDocData.error, status: 'sent', segments: parseMarkdown(pdfDocData.error) });
                    } else {
                         await createPdfFile(pdfDocData);
                         updateMessage(aiMessageId, {
                            generatedFile: { type: 'pdf', filename: `${args.topic.replace(/ /g, '_')}.pdf`, message: `Your PDF document on "${args.topic}" has been downloaded.` },
                            text: '',
                            status: 'sent'
                        });
                    }
                    break;
                
                case 'generate_qr_code':
                    setCurrentActivity('workflow');
                    updateMessage(aiMessageId, { text: `STATUS: Generating QR code for "${args.text}"...` });
                    if (typeof QRCode !== 'undefined') {
                        try {
                            const dataUrl = await QRCode.toDataURL(args.text, { width: 256, margin: 2 });
                            updateMessage(aiMessageId, {
                                generatedQRCode: { text: args.text, dataUrl: dataUrl },
                                text: '',
                                status: 'sent'
                            });
                        } catch (e) {
                            console.error("QR Code generation failed:", e);
                            updateMessage(aiMessageId, { text: "Sorry, I couldn't generate the QR code.", status: 'sent' });
                        }
                    } else {
                         updateMessage(aiMessageId, { text: "QR Code generation is not available right now.", status: 'sent' });
                    }
                    break;
                
                case 'create_interactive_chart':
                    setCurrentActivity('workflow');
                    updateMessage(aiMessageId, { text: `STATUS: Creating chart...` });
                    const chartConfig: InteractiveChartData = args.chart_config;
                    if (chartConfig) {
                        updateMessage(aiMessageId, {
                            interactiveChartData: chartConfig,
                            text: '',
                            status: 'sent',
                        });
                    } else {
                        updateMessage(aiMessageId, { text: "Sorry, I couldn't create the chart.", status: 'sent' });
                    }
                    break;

                case 'initiate_workflow':
                    initiateWorkflow(args.goal, attachments);
                    setMessages(prev => prev.filter(m => m.id !== aiMessageId));
                    break;
                
                case 'summarize_document':
                    if (attachments.length === 0 || !attachments[0].mimeType.startsWith('text/')) {
                         updateMessage(aiMessageId, { text: "Please upload a text document to summarize.", status: 'sent', segments: parseMarkdown("Please upload a text document to summarize.") });
                        break;
                    }
                    setCurrentActivity('browsing');
                    updateMessage(aiMessageId, { text: `STATUS: Summarizing ${attachments[0].name}...` });
                    try {
                        const content = atob(attachments[0].base64);
                        const summary = await summarizeDocument(content);
                        updateMessage(aiMessageId, { text: summary, status: 'sent', segments: parseMarkdown(summary) });
                    } catch (e) {
                        updateMessage(aiMessageId, { text: "Sorry, I couldn't read or summarize that document.", status: 'sent' });
                    }
                    break;
                
                case 'send_email':
                    updateMessage(aiMessageId, { text: `I've prepared an email to ${args.recipient} with the subject "${args.subject}". Would you like to open it in your email client?`, requiresAction: 'open_mailto', actionData: { mailtoUrl: `mailto:${args.recipient}?subject=${encodeURIComponent(args.subject)}&body=${encodeURIComponent(args.body)}` }, status: 'sent' });
                    break;

                // Developer Sandbox tools
                case 'list_files':
                    updateMessage(aiMessageId, { text: 'STATUS: Listing files...' });
                    const fileList = sessionFiles.map(f => f.name).join('\n') || "No files in session.";
                    updateMessage(aiMessageId, { text: fileList, segments: parseMarkdown(fileList), status: 'sent' });
                    break;
                case 'read_file':
                    updateMessage(aiMessageId, { text: `STATUS: Reading file ${args.filename}...` });
                    const fileToRead = sessionFiles.find(f => f.name === args.filename);
                    const fileContent = fileToRead ? `Content of ${args.filename}:\n\n${fileToRead.content}` : `Error: File '${args.filename}' not found.`;
                    updateMessage(aiMessageId, { text: fileContent, segments: parseMarkdown(fileContent), status: 'sent' });
                    break;
                case 'write_file':
                    updateMessage(aiMessageId, { text: `STATUS: Writing to file ${args.filename}...` });
                    const newFile: VirtualFile = { name: args.filename, content: args.content };
                    const existingIndex = sessionFiles.findIndex(f => f.name === args.filename);
                    let newFiles = [...sessionFiles];
                    if (existingIndex > -1) {
                        newFiles[existingIndex] = newFile;
                    } else {
                        newFiles.push(newFile);
                    }
                    setSessionFiles(newFiles);
                    const writeSuccessMsg = `Successfully wrote content to ${args.filename}.`;
                    updateMessage(aiMessageId, { text: writeSuccessMsg, segments: parseMarkdown(writeSuccessMsg), status: 'sent' });
                    break;
                case 'execute_python_code':
                    updateMessage(aiMessageId, { text: 'STATUS: Executing Python code...' });
                    const output = await executePythonCode(args.code, sessionFiles);
                    setCodeHistory(prev => [{ id: Date.now().toString(), code: args.code, timestamp: new Date() }, ...prev]);
                    updateMessage(aiMessageId, { codeExecutionResult: { code: args.code, output }, text: '', status: 'sent' });
                    break;
            }
        } catch (error) {
            console.error("Tool call execution error:", error);
            updateMessage(aiMessageId, { text: "Sorry, I encountered an error while trying to use my tools.", status: 'sent', segments: parseMarkdown("Sorry, I encountered an error while trying to use my tools.") });
        } finally {
            setIsLoading(false);
            setCurrentActivity(null);
        }
    }, [lastActiveImage, sessionFiles, handleWorkflowToolCall, executeConfirmedWorkflow, attachments]);

    const handleSendMessage = useCallback(async (message: string, files: FileAttachment[]) => {
        if (isLoading) return;

        isCancelledRef.current = false;
        setIsLoading(true);
        setCurrentActivity('chat');

        const newUserMessage: Message = {
            id: Date.now().toString(),
            text: message,
            sender: 'user',
            timestamp: new Date(),
            status: 'sent',
            attachments: files,
        };
        setMessages(prev => [...prev, newUserMessage]);
        
        const imageAttachments = files.filter(f => f.mimeType.startsWith('image/'));
        if (imageAttachments.length > 0) {
            setLastActiveImage(imageAttachments[imageAttachments.length - 1]);
        }
        
        // This is a placeholder for a more robust location service
        const location = null; 

        try {
            const { stream, historyWithUserMessage } = await streamMessageToChat(
                history,
                message,
                files,
                location,
                userSettings,
                undefined,
                currentPersona?.systemInstruction || userSettings.customInstructions,
                isAgentModeEnabled
            );

            setHistory(historyWithUserMessage);
            let combinedText = '';
            const aiMessageId = (Date.now() + 1).toString();
            
            setMessages(prev => [...prev, {
                id: aiMessageId,
                text: '',
                sender: 'ai',
                timestamp: new Date(),
                status: 'streaming',
                segments: [],
            }]);

            let lastChunk: GenerateContentResponse | null = null;
            for await (const chunk of stream) {
                if (isCancelledRef.current) break;
                lastChunk = chunk;

                const chunkText = chunk.text;
                if (chunkText) {
                    combinedText += chunkText;
                    setMessages(prev => prev.map(m => m.id === aiMessageId
                        ? { ...m, text: combinedText, segments: parseMarkdown(combinedText) }
                        : m
                    ));
                }
            }
            
            if (isCancelledRef.current) {
                setMessages(prev => prev.map(m => m.id === aiMessageId
                    ? { ...m, status: 'sent', text: combinedText + "\n\nGeneration cancelled." }
                    : m
                ));
                setIsLoading(false);
                setCurrentActivity(null);
                return;
            }

            const groundingChunks = lastChunk?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            const sources: Source[] = groundingChunks.reduce((acc: Source[], chunk: GroundingChunk) => {
                if (chunk.web?.uri && chunk.web.title) {
                    acc.push({ uri: chunk.web.uri, title: chunk.web.title, type: 'web' });
                }
                if (chunk.maps?.uri && chunk.maps.title) {
                    acc.push({ uri: chunk.maps.uri, title: chunk.maps.title, type: 'map' });
                }
                return acc;
            }, []);
            
            let finalHistory = [...historyWithUserMessage, { role: 'model', parts: [{ text: combinedText }] }];
            setHistory(finalHistory);
            
             // Check for tool call
            try {
                const toolCallMatch = combinedText.match(/\{"tool_call":\s*".*?"\s*(,.*)?\}/s);
                if (toolCallMatch) {
                    const toolCallObject = JSON.parse(toolCallMatch[0]);
                    handleToolCall(aiMessageId, toolCallObject);
                    return; // Stop further processing as tool call will handle the rest
                }
            } catch (e) {
                // Not a valid tool call, treat as regular text
            }
            
            setMessages(prev => prev.map(m => m.id === aiMessageId
                ? { ...m, status: 'sent', text: combinedText, segments: parseMarkdown(combinedText), sources }
                : m
            ));

        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: "Sorry, I encountered an error. Please try again.",
                sender: 'ai',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setCurrentActivity(null);
        }

    }, [isLoading, history, userSettings, currentPersona, isAgentModeEnabled, handleToolCall]);

    const handleQuickAction = (prompt: string) => {
        setInput(prompt);
        textareaRef.current?.focus();
    };

    const handleCancel = () => {
        isCancelledRef.current = true;
    };

    const handleNewChat = () => {
        setMessages([]);
        setHistory([]);
        setAttachments([]);
        setInput('');
        setCurrentPersona(null);
        setIsAgentModeEnabled(false);
        setSessionFiles([]);
    };
    
    const handleSaveSettings = (newSettings: Partial<UserProfile>) => {
        setUserSettings(prev => ({...prev, ...newSettings}));
        if(authUserProfile) {
            updateCurrentUser(newSettings);
        }
        setIsSettingsOpen(false);
    };

    const handleDeleteAllChats = () => {
       handleNewChat();
       setIsSettingsOpen(false);
    };

    const handleSavePersona = (persona: Persona, originalName?: string) => {
        setAvailablePersonas(prev => {
            const newPersonas = originalName
                ? prev.map(p => p.name === originalName ? { ...persona, name: originalName } : p) // If editing, replace
                : [...prev, persona]; // If new, add
            
            const customPersonas = newPersonas.filter(p => p.isCustom);
            localStorage.setItem(CUSTOM_PERSONAS_STORAGE_KEY, JSON.stringify(customPersonas));
            return newPersonas;
        });
        setIsCustomPersonaModalOpen(false);
        setEditingPersona(null);
        // If the edited persona was the current one, update it
        if (currentPersona && currentPersona.name === originalName) {
            setCurrentPersona(persona);
        }
    };
    
    const handleDeletePersona = (name: string) => {
        if (currentPersona?.name === name) {
            setCurrentPersona(null);
        }
        setAvailablePersonas(prev => {
            const newPersonas = prev.filter(p => p.name !== name);
            const customPersonas = newPersonas.filter(p => p.isCustom);
            localStorage.setItem(CUSTOM_PERSONAS_STORAGE_KEY, JSON.stringify(customPersonas));
            return newPersonas;
        });
    }

    const handleDownloadGeneratedFile = (data: PresentationData | WordData | ExcelData, type: string, filename: string) => {
        if (!data) return;
        switch(type) {
            case 'pptx':
                createPptxFile(data as PresentationData, filename.replace('.pptx', ''));
                break;
            case 'docx':
                createDocxFile(data as WordData);
                break;
            case 'xlsx':
                 createXlsxFile(data as ExcelData);
                break;
        }
    }
    
    const downloadVirtualFile = (file: VirtualFile) => {
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

    const openFileInCanvas = (filename: string) => {
        const file = sessionFiles.find(f => f.name === filename);
        if (file) {
            setCanvasFiles({ [file.name]: file.content });
            setIsCanvasVisible(true);
        }
    };

    const rerunCode = (code: string) => {
        const fakeToolCall = { tool_call: 'execute_python_code', code };
        const aiMessageId = (Date.now() + 1).toString();
        
        setMessages(prev => [...prev, {
            id: aiMessageId,
            text: '', // This will be replaced by the tool call handler
            sender: 'ai',
            timestamp: new Date(),
        }]);

        handleToolCall(aiMessageId, fakeToolCall);
    };
    

    const quickActionPills = [
        { text: 'Write a poem about the monsoon', icon: '🌧️', disabled: isLoading },
        { text: 'Explain quantum computing', icon: '🔬', disabled: isLoading },
        { text: 'Plan a 3-day trip to Goa', icon: '✈️', disabled: isLoading },
        { text: 'Help me debug my Python code', icon: '🐛', disabled: isLoading || !isAgentModeEnabled },
        { text: 'Summarize a news article', icon: '📰', disabled: isLoading },
        { text: 'Start live conversation', icon: '🎙️', disabled: isLoading, onClick: () => handleStartLive() },
    ];
    
    // ... all other functions and state...
    
    // Placeholder functions to satisfy the component props for now
    const handleStartLive = () => { console.log("Live conversation started"); };
    const handleDisconnectLive = () => { console.log("Live conversation ended"); };

    return (
        <div className="chat-page-container">
            <header className="chat-header">
                <a href="#" onClick={() => navigateTo('home')} className="flex items-center gap-2">
                    <img src="/short_logo.jpeg" alt="AikonAI Logo" className="chat-header-logo" />
                    <span className="font-bold text-lg hidden sm:inline">AikonAI</span>
                </a>
                <div className="chat-header-actions">
                     <button onClick={handleNewChat} className="hidden sm:block">New Chat</button>
                    <button onClick={() => setIsSettingsOpen(true)} className="hidden sm:block">Settings</button>
                    {isAgentModeEnabled && <SessionFileManager files={sessionFiles} onOpenFile={openFileInCanvas} onDownloadFile={downloadVirtualFile} />}
                    {isAgentModeEnabled && (
                        <motion.button onClick={() => setIsCodeHistoryOpen(true)} title="Code History" className="theme-toggle-button" whileTap={{scale:0.9}} whileHover={{scale:1.1}}>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </motion.button>
                    )}
                    <motion.button onClick={toggleTheme} title="Toggle theme" className="theme-toggle-button" whileTap={{scale:0.9}} whileHover={{scale:1.1}}>
                        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                    </motion.button>
                </div>
            </header>

            <AnimatePresence>
                {viewingImage && <ImageViewer imageUrl={viewingImage} onClose={() => setViewingImage(null)} />}
                {liveConnectionState !== 'disconnected' && <LiveConversationOverlay connectionState={liveConnectionState} onDisconnect={handleDisconnectLive} />}
                {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} profile={userSettings} onSave={handleSaveSettings} onDeleteAllChats={handleDeleteAllChats} />}
                {isCustomPersonaModalOpen && <CustomPersonaModal onClose={() => {setIsCustomPersonaModalOpen(false); setEditingPersona(null);}} onSave={handleSavePersona} personaToEdit={editingPersona} />}
                 {isCodeHistoryOpen && <CodeHistoryPanel history={codeHistory} onRerun={rerunCode} onClose={() => setIsCodeHistoryOpen(false)} />}
            </AnimatePresence>

            {isCanvasVisible && <CodeCanvas files={canvasFiles} isVisible={isCanvasVisible} onClose={() => setIsCanvasVisible(false)} />}

            {messages.length === 0 ? (
                <div className="chat-welcome-screen">
                    <img src="/short_logo.jpeg" alt="AikonAI Logo" className="welcome-logo" />
                    <h1 className="welcome-title">{welcomeMessage}</h1>
                     <div className="welcome-actions">
                        {quickActionPills.map(pill => (
                            <motion.button 
                                key={pill.text}
                                className="action-pill" 
                                onClick={pill.onClick ? pill.onClick : () => handleQuickAction(pill.text)} 
                                disabled={pill.disabled}
                                whileHover={{ scale: !pill.disabled ? 1.05 : 1 }}
// FIX: Corrected the `whileTap` scale property which was receiving a boolean. It now correctly uses a ternary operator to return a number.
                                whileTap={{ scale: !pill.disabled ? 0.95 : 1 }}
                            >
                                <span className="text-xl mr-2">{pill.icon}</span>
                                <span>{pill.text}</span>
                            </motion.button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="chat-log" ref={chatWindowRef}>
                    {messages.map((msg) => (
                        <MessageLogItem 
                            key={msg.id} 
                            message={msg} 
                            onApprove={(stepIndex) => {}} // Placeholder
                            onDeny={(stepIndex) => {}} // Placeholder
                            onViewImage={setViewingImage}
                            userProfile={userSettings as UserProfile}
                            onDownloadGeneratedFile={handleDownloadGeneratedFile}
                            onConfirmWorkflow={handleConfirmWorkflow}
                            onCancelWorkflow={handleCancelWorkflow}
                            theme={theme}
                        />
                    ))}
                    {isLoading && <TypingIndicator activity={currentActivity} persona={currentPersona} />}
                    <div ref={bottomOfChatRef} />
                </div>
            )}
            
            <div className="chat-composer-section">
                <ChatComposer
                    onSendMessage={handleSendMessage}
                    isLoading={isLoading}
                    input={input}
                    setInput={setInput}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    onCancel={handleCancel}
                    textareaRef={textareaRef}
                />
            </div>

        </div>
    );
};

// FIX: Added a default export to the component to resolve the import error in App.tsx.
export default AikonChatPage;
