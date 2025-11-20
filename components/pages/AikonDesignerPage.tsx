
import React, { useState, useEffect, useRef } from 'react';
import { NavigationProps, ProjectStructure, ProjectFile } from '../../types';
import { generateComplexProjectStream } from '../../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';

declare const hljs: any;

// --- ICONS ---
const FileIcon: React.FC<{ name: string }> = ({ name }) => {
    const ext = name.split('.').pop();
    let color = "text-gray-400";
    let icon = "📄";

    switch (ext) {
        case 'tsx':
        case 'ts':
            color = "text-blue-400";
            icon = "TS";
            break;
        case 'jsx':
        case 'js':
            color = "text-yellow-400";
            icon = "JS";
            break;
        case 'css':
            color = "text-blue-300";
            icon = "#";
            break;
        case 'html':
            color = "text-orange-500";
            icon = "<>";
            break;
        case 'json':
            color = "text-green-400";
            icon = "{ }";
            break;
    }

    return <span className={`font-bold text-[10px] w-4 text-center ${color}`}>{icon}</span>;
};

const RefreshIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
);

// --- COMPONENTS ---

const FileTreeItem: React.FC<{ file: ProjectFile, active: boolean, onClick: () => void }> = ({ file, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 rounded-md transition-all duration-200 group ${
            active 
            ? 'bg-white/10 text-white font-medium' 
            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }`}
    >
        <FileIcon name={file.name} />
        <span className="truncate font-mono tracking-tight">{file.name}</span>
    </button>
);

const BrowserFrame: React.FC<{ children: React.ReactNode, url?: string, onRefresh?: () => void }> = ({ children, url = "localhost:3000", onRefresh }) => (
    <div className="flex flex-col h-full w-full bg-white rounded-lg overflow-hidden shadow-2xl">
        {/* Browser Chrome */}
        <div className="bg-[#f1f3f5] border-b border-[#e1e3e5] h-10 flex items-center px-4 gap-3 flex-shrink-0">
            <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e]"></div>
                <div className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d89e24]"></div>
                <div className="w-3 h-3 rounded-full bg-[#28c840] border border-[#1aab29]"></div>
            </div>
            <div className="flex gap-3 ml-2 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </div>
            <div className="flex-grow bg-white h-7 rounded-md border border-[#e1e3e5] flex items-center px-3 gap-2 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><path d="M9 21V9"/></svg>
                <span className="text-xs text-gray-600 font-medium truncate select-none">{url}</span>
            </div>
            <button onClick={onRefresh} className="text-gray-500 hover:text-gray-700 transition-colors p-1">
                <RefreshIcon />
            </button>
        </div>
        {/* Browser Content */}
        <div className="flex-grow relative bg-white">
            {children}
        </div>
    </div>
);

const AikonDesignerPage: React.FC<NavigationProps> = ({ navigateTo }) => {
    // --- STATE ---
    const [project, setProject] = useState<ProjectStructure>({ description: '', files: [], previewHtml: '' });
    const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
    const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
    
    // Refs
    const streamingContentRef = useRef('');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const codeEditorRef = useRef<HTMLDivElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);
    const codeRef = useRef<HTMLElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    // Syntax Highlighting Effect
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

    // Sync Scroll between Textarea and Highlight Pre
    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
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
            streamingContentRef.current = '';

            for await (const chunk of stream) {
                const chunkText = chunk.text || '';
                fullResponse += chunkText;
                streamingContentRef.current += chunkText;
                
                // Update Chat UI description
                const descriptionMatch = fullResponse.split('<file')[0];
                setChatHistory(prev => {
                    const newHistory = [...prev];
                    newHistory[newHistory.length - 1].text = descriptionMatch.trim();
                    return newHistory;
                });

                const stripMarkdown = (content: string) => {
                     let cleaned = content.trim();
                     if (cleaned.startsWith('```')) {
                         cleaned = cleaned.replace(/^```[^\n]*\n/, '').replace(/```$/, '');
                     }
                     return cleaned.trim();
                };

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
            <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#050505]/80 backdrop-blur-md flex-shrink-0 z-20">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigateTo('projects')} className="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        Back
                    </button>
                    <div className="h-4 w-px bg-white/10"></div>
                    <div className="flex items-center gap-3">
                        <span className="text-amber-400 font-black text-lg tracking-tight">AIKON DESIGNER</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">BETA</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                        <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></div>
                        <span className="text-xs text-gray-400 font-medium">{isGenerating ? 'Architecting...' : 'Ready'}</span>
                     </div>
                </div>
            </header>

            {/* Main Layout */}
            <div className="flex-grow flex overflow-hidden">
                
                {/* Left Panel: Chat & Context */}
                <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-white/5 bg-[#080808] relative">
                    <div className="flex-grow overflow-y-auto p-4 pb-32 space-y-6 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                        {chatHistory.length === 0 && (
                            <div className="mt-20 px-6 text-center">
                                <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl mx-auto mb-6 shadow-[0_0_40px_-10px_rgba(255,165,0,0.3)] flex items-center justify-center text-3xl">🚀</div>
                                <h2 className="text-xl font-bold text-white mb-3">I am Aikon.</h2>
                                <p className="text-sm text-gray-500 mb-8 leading-relaxed">The world's most advanced AI Website Architect. I don't just code; I engineer production-ready full-stack applications. Challenge me.</p>
                                <div className="space-y-2">
                                    {[
                                        "Clone Netflix with a modern carousel", 
                                        "Build a CRM with AI-driven insights", 
                                        "Create a 3D portfolio using Three.js"
                                    ].map(suggestion => (
                                        <button 
                                            key={suggestion} 
                                            onClick={() => setPrompt(suggestion)} 
                                            className="w-full text-left px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-sm text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/10 transition-all group"
                                        >
                                            <span className="mr-2 opacity-50 group-hover:opacity-100">✨</span>
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-lg ${msg.role === 'user' ? 'bg-gradient-to-br from-blue-600 to-indigo-600' : 'bg-gradient-to-br from-amber-500 to-orange-600'}`}>
                                    {msg.role === 'user' ? 'U' : 'AI'}
                                </div>
                                <div className={`max-w-[85%] text-sm leading-relaxed p-3.5 rounded-2xl shadow-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-white/10 text-white rounded-tr-sm' 
                                    : 'bg-[#151515] text-gray-300 border border-white/5 rounded-tl-sm'
                                }`}>
                                    {msg.role === 'ai' && msg.text === '' ? (
                                        <div className="flex gap-1 h-4 items-center px-2">
                                            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                        </div>
                                    ) : (
                                        msg.text
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Floating Input Area */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#080808] via-[#080808] to-transparent pt-10">
                        <div className="relative bg-[#151515]/80 backdrop-blur-xl rounded-2xl border border-white/10 focus-within:border-amber-500/50 focus-within:bg-[#1a1a1a] transition-all shadow-2xl">
                            <textarea 
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Describe your vision..."
                                className="w-full bg-transparent text-sm text-white p-4 pr-12 outline-none resize-none h-14 max-h-32 placeholder-gray-600"
                                disabled={isGenerating}
                            />
                            <button 
                                onClick={handleGenerate}
                                disabled={!prompt.trim() || isGenerating}
                                className="absolute right-2 top-2.5 p-2 bg-amber-500 text-black rounded-xl hover:bg-amber-400 disabled:opacity-0 disabled:scale-75 transition-all shadow-lg shadow-amber-500/20"
                            >
                                {isGenerating ? (
                                     <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                                )}
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-3 text-center font-medium tracking-wide">AIKON ARCHITECT MAY PRODUCE COMPLEX CODE.</p>
                    </div>
                </div>

                {/* Right Panel: Workspace */}
                <div className="flex-grow flex flex-col bg-[#09090b] relative overflow-hidden">
                    {/* Workspace Toolbar */}
                    <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 bg-[#09090b]">
                        <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/5">
                            <button 
                                onClick={() => setViewMode('code')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                                    viewMode === 'code' 
                                    ? 'bg-white/10 text-white shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                                Code
                            </button>
                            <button 
                                onClick={() => setViewMode('preview')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                                    viewMode === 'preview' 
                                    ? 'bg-white/10 text-white shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                Preview
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            {activeFile && viewMode === 'code' && (
                                <div className="flex items-center gap-2 text-xs text-gray-500 font-mono bg-white/5 px-3 py-1.5 rounded border border-white/5">
                                    <span className="opacity-50">{project.files.find(f => f.path === activeFile.path)?.path}</span>
                                    {isGenerating && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Workspace Content */}
                    <div className="flex-grow relative overflow-hidden">
                        
                        {/* CODE VIEW */}
                        <div className={`absolute inset-0 flex transition-opacity duration-300 ${viewMode === 'code' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                            {/* File Sidebar */}
                            <div className="w-60 border-r border-white/5 bg-[#0a0a0c] flex flex-col">
                                <div className="p-4 pb-2">
                                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Explorer</h3>
                                </div>
                                <div className="flex-grow overflow-y-auto px-2 space-y-0.5">
                                    {project.files.length === 0 && (
                                        <div className="text-center mt-10 p-4">
                                            <p className="text-xs text-gray-600 italic">No files yet.</p>
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
                                {/* Editor Tabs */}
                                {activeFile && (
                                    <div className="flex items-center border-b border-white/5 bg-[#0c0c0e]">
                                        <div className="px-4 py-2.5 text-xs font-medium text-gray-300 border-r border-white/5 bg-[#09090b] border-t-2 border-t-amber-500 flex items-center gap-2">
                                            <FileIcon name={activeFile.name} />
                                            {activeFile.name}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex-grow relative font-mono text-sm">
                                    {activeFile ? (
                                        <>
                                            <div ref={lineNumbersRef} className="absolute top-0 left-0 bottom-0 w-12 bg-[#0c0c0e] border-r border-white/5 text-right pr-3 pt-4 text-gray-700 select-none z-20 overflow-hidden text-[13px] leading-relaxed">
                                                {activeFile.content.split('\n').map((_, i) => (
                                                    <div key={i}>{i + 1}</div>
                                                ))}
                                            </div>
                                            <div className="absolute top-0 left-12 right-0 bottom-0 overflow-auto" onScroll={handleScroll} ref={codeEditorRef}>
                                                <div className="relative min-h-full">
                                                    {/* Syntax Highlight Layer */}
                                                    <pre className="absolute top-0 left-0 right-0 bottom-0 p-4 pointer-events-none z-10 m-0 bg-transparent">
                                                        <code ref={codeRef} className={`language-${activeFile.language} bg-transparent !p-0 !m-0 text-[13px] leading-relaxed font-mono block min-h-full`}>
                                                        </code>
                                                    </pre>
                                                    {/* Editable Layer */}
                                                    <textarea 
                                                        ref={textareaRef}
                                                        className="absolute top-0 left-0 right-0 bottom-0 w-full h-full bg-transparent text-transparent caret-white p-4 outline-none resize-none z-20 text-[13px] leading-relaxed font-mono"
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
                                        <div className="flex items-center justify-center h-full text-gray-600 text-sm flex-col gap-2">
                                            <div className="text-4xl opacity-20">📝</div>
                                            <p>Select a file to edit</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* PREVIEW VIEW */}
                        <div className={`absolute inset-0 bg-[#09090b] flex flex-col items-center justify-center p-8 transition-opacity duration-300 ${viewMode === 'preview' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                             <div className="w-full h-full max-w-6xl">
                                {project.previewHtml ? (
                                     <BrowserFrame onRefresh={refreshPreview}>
                                         <iframe 
                                            srcDoc={project.previewHtml}
                                            className="w-full h-full border-0 bg-white"
                                            title="Live Preview"
                                            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                                         />
                                     </BrowserFrame>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 border-2 border-dashed border-white/10 rounded-xl bg-white/5">
                                        {isGenerating ? (
                                            <>
                                                <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-4"></div>
                                                <p className="font-medium text-gray-400">Compiling preview...</p>
                                            </>
                                        ) : (
                                            <>
                                                <div className="text-5xl mb-4 opacity-30">🖥️</div>
                                                <p className="font-medium">No preview available yet.</p>
                                                <p className="text-xs mt-2 opacity-50">Generate a project to see it live.</p>
                                            </>
                                        )}
                                    </div>
                                )}
                             </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
};

export default AikonDesignerPage;
