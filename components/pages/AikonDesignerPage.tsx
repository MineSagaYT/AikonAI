
import React, { useState, useEffect, useRef } from 'react';
import { NavigationProps, ProjectStructure, ProjectFile } from '../../types';
import { generateComplexProjectStream } from '../../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';

declare const hljs: any;

const MotionDiv = motion.div as any;
const MotionButton = motion.button as any;

// --- SUB-COMPONENTS FOR DESIGNER ---

const FileIcon: React.FC<{ name: string }> = ({ name }) => {
    const ext = name.split('.').pop();
    let color = "text-gray-500";
    let icon = "📄";

    switch (ext) {
        case 'tsx': color = "text-sky-400"; icon = "⚛️"; break;
        case 'ts': color = "text-blue-400"; icon = "TS"; break;
        case 'jsx': color = "text-yellow-400"; icon = "JS"; break;
        case 'js': color = "text-yellow-300"; icon = "JS"; break;
        case 'css': color = "text-pink-400"; icon = "#"; break;
        case 'html': color = "text-orange-500"; icon = "<>"; break;
        case 'json': color = "text-green-400"; icon = "{ }"; break;
    }

    return <span className={`font-bold text-[10px] w-5 text-center ${color}`}>{icon}</span>;
};

const FileTreeItem: React.FC<{ file: ProjectFile, active: boolean, onClick: () => void }> = ({ file, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden ${
            active 
            ? 'bg-white/10 text-white font-medium shadow-lg shadow-black/20 border border-white/10' 
            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
        }`}
    >
        <FileIcon name={file.name} />
        <span className="truncate font-mono tracking-tight relative z-10">{file.name}</span>
        {active && <MotionDiv layoutId="activeFileGlow" className="absolute inset-0 bg-amber-500/5" />}
    </button>
);

const BrowserFrame: React.FC<{ children: React.ReactNode, url?: string, onRefresh?: () => void, deviceMode: 'desktop' | 'tablet' | 'mobile' }> = ({ children, url = "localhost:3000", onRefresh, deviceMode }) => {
    const getWidth = () => {
        switch(deviceMode) {
            case 'mobile': return '375px';
            case 'tablet': return '768px';
            default: return '100%';
        }
    };

    return (
        <div className="flex flex-col h-full w-full items-center bg-[#0c0c0e] overflow-hidden relative">
            <MotionDiv 
                className="flex flex-col h-full bg-white rounded-xl overflow-hidden shadow-2xl border border-white/10 transition-all duration-500 ease-in-out"
                style={{ width: getWidth() }}
                layout
            >
                {/* Browser Chrome */}
                <div className="bg-[#1a1a1a] border-b border-white/10 h-10 flex items-center px-4 gap-3 flex-shrink-0 select-none">
                    <div className="flex gap-2 group">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f57] group-hover:brightness-110"></div>
                        <div className="w-3 h-3 rounded-full bg-[#febc2e] group-hover:brightness-110"></div>
                        <div className="w-3 h-3 rounded-full bg-[#28c840] group-hover:brightness-110"></div>
                    </div>
                    <div className="flex-grow flex justify-center px-4">
                        <div className="bg-[#2a2a2a] h-6 w-full max-w-md rounded-md flex items-center px-3 text-[10px] text-gray-500 font-mono border border-white/5 shadow-inner">
                            <span className="text-green-500 mr-2">🔒</span>
                            {url}
                        </div>
                    </div>
                    <button onClick={onRefresh} className="text-gray-500 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74 2.74L3 16"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                    </button>
                </div>
                {/* Browser Content */}
                <div className="flex-grow relative bg-white w-full">
                    {children}
                </div>
            </MotionDiv>
        </div>
    );
};

// --- MAIN COMPONENT ---

const AikonDesignerPage: React.FC<NavigationProps> = ({ navigateTo }) => {
    // --- STATE ---
    const [project, setProject] = useState<ProjectStructure>({ description: '', files: [], previewHtml: '' });
    const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
    const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
    const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    
    // Refs
    const chatEndRef = useRef<HTMLDivElement>(null);
    const codeEditorRef = useRef<HTMLDivElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);
    const codeRef = useRef<HTMLElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Load from local storage on mount
    useEffect(() => {
        const savedData = localStorage.getItem('aikon_designer_project');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                setProject(parsed);
                if (parsed.files && parsed.files.length > 0) {
                    setActiveFile(parsed.files[0]);
                }
                // If there is a preview, switch to it for instant gratification
                if (parsed.previewHtml) {
                    setViewMode('preview');
                }
                // Try to get last save time if stored separately, or just assume now-ish
                // Simplified: we don't store timestamp separately, so just leave null until saved again
            } catch (e) {
                console.error("Failed to load saved project", e);
            }
        }
    }, []);

    const handleSaveProject = () => {
        try {
            localStorage.setItem('aikon_designer_project', JSON.stringify(project));
            setLastSaved(new Date());
        } catch (e) {
            console.error("Failed to save project", e);
            alert("Failed to save project locally. Storage quota might be exceeded.");
        }
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    useEffect(() => {
        if (codeRef.current && activeFile) {
            codeRef.current.textContent = activeFile.content;
            if (typeof hljs !== 'undefined') {
                try {
                    codeRef.current.removeAttribute('data-highlighted');
                    hljs.highlightElement(codeRef.current);
                } catch(e) {
                    console.warn("Highlight.js warning:", e instanceof Error ? e.message : String(e));
                }
            }
        }
    }, [activeFile?.content, activeFile?.language]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (codeEditorRef.current && lineNumbersRef.current) {
            const top = e.currentTarget.scrollTop;
            const left = e.currentTarget.scrollLeft;
            codeEditorRef.current.scrollTop = top;
            codeEditorRef.current.scrollLeft = left;
            lineNumbersRef.current.scrollTop = top;
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        const userPrompt = prompt;
        setPrompt('');
        setIsGenerating(true);
        setChatHistory(prev => [...prev, { role: 'user', text: userPrompt }]);
        setChatHistory(prev => [...prev, { role: 'ai', text: '' }]);

        try {
            const { stream } = await generateComplexProjectStream(userPrompt, project);
            
            let fullResponse = '';
            
            for await (const chunk of stream) {
                const chunkText = chunk.text || '';
                fullResponse += chunkText;
                
                // Update Chat UI description dynamically (show plan)
                const planMatch = /<plan>([\s\S]*?)<\/plan>/.exec(fullResponse);
                if (planMatch) {
                     setChatHistory(prev => {
                        const newHistory = [...prev];
                        newHistory[newHistory.length - 1].text = planMatch[1].trim();
                        return newHistory;
                    });
                } else if (!fullResponse.includes('<')) {
                    // Stream thinking text before XML starts
                    setChatHistory(prev => {
                        const newHistory = [...prev];
                        newHistory[newHistory.length - 1].text = fullResponse;
                        return newHistory;
                    });
                }

                const stripMarkdown = (content: string) => {
                     let cleaned = content.trim();
                     if (cleaned.startsWith('```')) {
                         cleaned = cleaned.replace(/^```[^\n]*\n/, '').replace(/```$/, '');
                     }
                     return cleaned.trim();
                };

                // Parse Files
                const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
                let match;
                const newFiles: ProjectFile[] = [];
                
                while ((match = fileRegex.exec(fullResponse)) !== null) {
                    const [_, path, content] = match;
                    const name = path.split('/').pop() || path;
                    const language = name.endsWith('css') ? 'css' : name.endsWith('tsx') || name.endsWith('ts') ? 'typescript' : 'javascript';
                    newFiles.push({ name, path, content: stripMarkdown(content), language });
                }
                
                if (newFiles.length > 0) {
                    setProject(prev => {
                        const updatedFiles = [...prev.files];
                        newFiles.forEach(newFile => {
                            const idx = updatedFiles.findIndex(f => f.path === newFile.path);
                            if (idx >= 0) updatedFiles[idx] = newFile;
                            else updatedFiles.push(newFile);
                        });
                        return { ...prev, files: updatedFiles };
                    });
                    
                    if (!activeFile && newFiles.length > 0) setActiveFile(newFiles[0]);
                    if (activeFile) {
                        const currentStreamedFile = newFiles.find(f => f.path === activeFile.path);
                        if (currentStreamedFile) setActiveFile(currentStreamedFile);
                    }
                }

                // Parse Preview
                const previewMatch = /<preview>([\s\S]*?)<\/preview>/.exec(fullResponse);
                if (previewMatch) {
                    const rawHtml = previewMatch[1];
                    setProject(prev => ({ ...prev, previewHtml: stripMarkdown(rawHtml) }));
                    if (viewMode === 'code') setViewMode('preview');
                }
            }

        } catch (e) {
            setChatHistory(prev => [...prev, { role: 'ai', text: `Error: ${String(e)}` }]);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleGenerate();
        }
    };

    const handleCodeChange = (newCode: string) => {
        if (activeFile) {
             const updatedFile = { ...activeFile, content: newCode };
             setActiveFile(updatedFile);
             setProject(prev => ({
                 ...prev,
                 files: prev.files.map(f => f.path === activeFile.path ? updatedFile : f)
             }));
        }
    };

    const refreshPreview = () => {
        const currentHtml = project.previewHtml;
        setProject(prev => ({ ...prev, previewHtml: '' }));
        setTimeout(() => setProject(prev => ({ ...prev, previewHtml: currentHtml })), 100);
    };

    return (
        <div className="h-screen w-screen flex flex-col bg-[#050505] text-white font-sans overflow-hidden selection:bg-amber-500/30">
            {/* Top Bar */}
            <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#050505]/80 backdrop-blur-md flex-shrink-0 z-20 shadow-xl">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigateTo('projects')} className="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 group">
                        <span className="group-hover:-translate-x-1 transition-transform">←</span>
                        Back
                    </button>
                    <div className="h-4 w-px bg-white/10"></div>
                    <div className="flex items-center gap-3">
                        <span className="text-amber-400 font-black text-lg tracking-tighter">AIKON OMEGA</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(251,191,36,0.2)]">ARCHITECT</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                     {lastSaved && (
                         <span className="text-[10px] text-gray-600 hidden sm:inline">
                             Last saved: {lastSaved.toLocaleTimeString()}
                         </span>
                     )}
                     <button 
                        onClick={handleSaveProject}
                        className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 transition-all flex items-center gap-2"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Save Project
                     </button>
                     
                     <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 transition-all ${isGenerating ? 'border-amber-500/50 shadow-[0_0_15px_rgba(251,191,36,0.1)]' : ''}`}>
                        <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></div>
                        <span className="text-xs text-gray-400 font-medium tracking-wide">{isGenerating ? 'CONSTRUCTING...' : 'ONLINE'}</span>
                     </div>
                </div>
            </header>

            {/* Main Layout */}
            <div className="flex-grow flex overflow-hidden">
                
                {/* Left Panel: Command Center */}
                <div className="w-[400px] flex-shrink-0 flex flex-col border-r border-white/5 bg-[#050505] relative z-10">
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none opacity-20"></div>
                    
                    <div className="flex-grow overflow-y-auto p-4 pb-32 space-y-6 scrollbar-none">
                        {chatHistory.length === 0 && (
                            <div className="mt-24 px-6 text-center">
                                <MotionDiv 
                                    initial={{ opacity: 0, y: 20 }} 
                                    animate={{ opacity: 1, y: 0 }} 
                                    className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-600 rounded-3xl mx-auto mb-6 shadow-[0_0_60px_-10px_rgba(255,165,0,0.4)] flex items-center justify-center text-4xl text-black font-black"
                                >
                                    Ω
                                </MotionDiv>
                                <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">Aikon Omega</h2>
                                <p className="text-sm text-gray-500 mb-8 leading-relaxed max-w-xs mx-auto">The world's most advanced AI architect. Capable of generating award-winning, full-stack web applications with zero friction.</p>
                                <div className="space-y-2">
                                    {[
                                        "Clone Netflix with Framer Motion", 
                                        "Build a SaaS Dashboard with Charts", 
                                        "Design a futuristic 3D Landing Page"
                                    ].map((suggestion, i) => (
                                        <MotionButton 
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            key={suggestion} 
                                            onClick={() => setPrompt(suggestion)} 
                                            className="w-full text-left px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-sm text-gray-400 hover:bg-white/10 hover:text-white hover:border-amber-500/30 transition-all group relative overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                            <span className="mr-2 opacity-50 group-hover:opacity-100 group-hover:text-amber-400">⚡</span>
                                            {suggestion}
                                        </MotionButton>
                                    ))}
                                </div>
                            </div>
                        )}
                        {chatHistory.map((msg, idx) => (
                            <MotionDiv 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={idx} 
                                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black shadow-lg border border-white/10 ${msg.role === 'user' ? 'bg-gradient-to-br from-blue-600 to-indigo-600' : 'bg-gradient-to-br from-amber-500 to-orange-600 text-black'}`}>
                                    {msg.role === 'user' ? 'USR' : 'Ω'}
                                </div>
                                <div className={`max-w-[85%] text-sm leading-relaxed p-4 rounded-2xl shadow-xl backdrop-blur-md ${
                                    msg.role === 'user' 
                                    ? 'bg-white/5 text-white border border-white/10 rounded-tr-none' 
                                    : 'bg-black/40 text-gray-300 border border-white/5 rounded-tl-none'
                                }`}>
                                    {msg.role === 'ai' && msg.text === '' ? (
                                        <div className="flex gap-1 h-4 items-center px-2">
                                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"></div>
                                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce delay-75"></div>
                                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce delay-150"></div>
                                        </div>
                                    ) : (
                                        msg.text.split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>)
                                    )}
                                </div>
                            </MotionDiv>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Floating Input Area */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent pt-20">
                        <div className="relative bg-[#111]/90 backdrop-blur-xl rounded-2xl border border-white/10 focus-within:border-amber-500/50 focus-within:bg-[#161616] transition-all shadow-2xl group">
                            <textarea 
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Describe your vision..."
                                className="w-full bg-transparent text-sm text-white p-4 pr-14 outline-none resize-none h-14 max-h-32 placeholder-gray-600 font-medium"
                                disabled={isGenerating}
                            />
                            <button 
                                onClick={handleGenerate}
                                disabled={!prompt.trim() || isGenerating}
                                className="absolute right-2 top-2.5 p-2.5 bg-white text-black rounded-xl hover:bg-amber-400 hover:scale-105 disabled:opacity-0 disabled:scale-75 transition-all shadow-lg"
                            >
                                {isGenerating ? (
                                     <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Workspace */}
                <div className="flex-grow flex flex-col bg-[#0c0c0e] relative overflow-hidden">
                    {/* Workspace Toolbar */}
                    <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 bg-[#0c0c0e]">
                        <div className="flex items-center bg-black/40 rounded-lg p-1 border border-white/5">
                            <button 
                                onClick={() => setViewMode('code')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                                    viewMode === 'code' 
                                    ? 'bg-white/10 text-white shadow-sm border border-white/5' 
                                    : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                Code
                            </button>
                            <button 
                                onClick={() => setViewMode('preview')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                                    viewMode === 'preview' 
                                    ? 'bg-white/10 text-white shadow-sm border border-white/5' 
                                    : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                Preview
                            </button>
                        </div>

                        {viewMode === 'preview' && (
                            <div className="flex items-center gap-2 bg-black/40 rounded-lg p-1 border border-white/5">
                                <button onClick={() => setDeviceMode('desktop')} className={`p-1.5 rounded-md ${deviceMode === 'desktop' ? 'bg-white/10 text-white' : 'text-gray-500'}`} title="Desktop"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg></button>
                                <button onClick={() => setDeviceMode('tablet')} className={`p-1.5 rounded-md ${deviceMode === 'tablet' ? 'bg-white/10 text-white' : 'text-gray-500'}`} title="Tablet"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg></button>
                                <button onClick={() => setDeviceMode('mobile')} className={`p-1.5 rounded-md ${deviceMode === 'mobile' ? 'bg-white/10 text-white' : 'text-gray-500'}`} title="Mobile"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/></svg></button>
                            </div>
                        )}

                        <div className="flex items-center gap-4">
                            {activeFile && viewMode === 'code' && (
                                <div className="flex items-center gap-2 text-xs text-gray-500 font-mono bg-black/40 px-3 py-1.5 rounded border border-white/5">
                                    <span className="text-amber-500">●</span>
                                    <span className="opacity-70">{activeFile.path}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Workspace Content */}
                    <div className="flex-grow relative overflow-hidden">
                        
                        {/* CODE VIEW */}
                        <div className={`absolute inset-0 flex transition-opacity duration-300 ${viewMode === 'code' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                            {/* File Sidebar */}
                            <div className="w-64 border-r border-white/5 bg-[#0a0a0c] flex flex-col">
                                <div className="p-4 border-b border-white/5 bg-[#0a0a0c]">
                                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Project Files</h3>
                                </div>
                                <div className="flex-grow overflow-y-auto p-2 space-y-1">
                                    {project.files.length === 0 && (
                                        <div className="text-center mt-10">
                                            <p className="text-xs text-gray-600 italic">Generating filesystem...</p>
                                        </div>
                                    )}
                                    {project.files.map(file => (
                                        <FileTreeItem 
                                            key={file.path} 
                                            file={file} 
                                            active={activeFile?.path === file.path} 
                                            onClick={() => setActiveFile(file)} 
                                        />
                                    ))}
                                </div>
                            </div>
                            {/* Editor */}
                            <div className="flex-grow bg-[#09090b] relative flex flex-col">
                                {activeFile ? (
                                    <>
                                        <div className="absolute top-0 left-0 bottom-0 w-12 bg-[#0c0c0e] border-r border-white/5 text-right pr-3 pt-4 text-gray-700 select-none z-20 overflow-hidden text-[13px] leading-relaxed font-mono">
                                            {activeFile.content.split('\n').map((_, i) => (
                                                <div key={i}>{i + 1}</div>
                                            ))}
                                        </div>
                                        <div className="absolute top-0 left-12 right-0 bottom-0 overflow-auto" onScroll={handleScroll} ref={codeEditorRef}>
                                            <div className="relative min-h-full">
                                                <pre className="absolute top-0 left-0 right-0 bottom-0 p-4 pointer-events-none z-10 m-0 bg-transparent">
                                                    <code ref={codeRef} className={`language-${activeFile.language} bg-transparent !p-0 !m-0 text-[13px] leading-relaxed font-mono block min-h-full`}>
                                                    </code>
                                                </pre>
                                                <textarea 
                                                    ref={textareaRef}
                                                    className="absolute top-0 left-0 right-0 bottom-0 w-full h-full bg-transparent text-transparent caret-amber-500 p-4 outline-none resize-none z-20 text-[13px] leading-relaxed font-mono"
                                                    value={activeFile.content}
                                                    onChange={(e) => handleCodeChange(e.target.value)}
                                                    spellCheck={false}
                                                    autoCapitalize="off"
                                                    autoComplete="off"
                                                    autoCorrect="off"
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-600 text-sm flex-col gap-4">
                                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                                            <span className="text-2xl grayscale opacity-50">💠</span>
                                        </div>
                                        <p>Select a file to begin editing</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* PREVIEW VIEW */}
                        <div className={`absolute inset-0 bg-[#050505] flex flex-col items-center justify-center p-8 transition-opacity duration-300 ${viewMode === 'preview' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                             {project.previewHtml ? (
                                 <BrowserFrame onRefresh={refreshPreview} deviceMode={deviceMode}>
                                     <iframe 
                                        srcDoc={project.previewHtml}
                                        className="w-full h-full border-0 bg-white"
                                        title="Live Preview"
                                        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                                     />
                                 </BrowserFrame>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full">
                                    {isGenerating ? (
                                        <>
                                            <div className="relative w-24 h-24 mb-8">
                                                <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full"></div>
                                                <div className="absolute inset-0 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                                <div className="absolute inset-0 flex items-center justify-center font-black text-amber-500 animate-pulse">Ω</div>
                                            </div>
                                            <p className="font-bold text-white text-lg tracking-widest uppercase">Compiling Logic...</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-6xl mb-6 opacity-10 grayscale">🖥️</div>
                                            <p className="text-gray-500 font-medium">No preview available.</p>
                                            <p className="text-xs mt-2 text-gray-700 uppercase tracking-widest">Generate a project to ignite the engine.</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
};

export default AikonDesignerPage;