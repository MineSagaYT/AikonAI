
import React, { useState, useEffect, useRef } from 'react';
import { NavigationProps, ProjectStructure, ProjectFile } from '../../types';
import { generateComplexProject } from '../../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';
import CodeBlock from '../CodeBlock';

const AikonDesignerPage: React.FC<NavigationProps> = ({ navigateTo }) => {
    // --- STATE ---
    const [project, setProject] = useState<ProjectStructure | null>(null);
    const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
    const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', text: string }[]>([]);

    // --- HANDLERS ---

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        const userPrompt = prompt;
        setPrompt('');
        setIsGenerating(true);
        setError(null);
        setChatHistory(prev => [...prev, { role: 'user', text: userPrompt }]);

        // Optimistic UI update
        setChatHistory(prev => [...prev, { role: 'ai', text: "Architecting solution..." }]);

        try {
            const result = await generateComplexProject(userPrompt, project);
            
            if ('error' in result) {
                setError(result.error);
                setChatHistory(prev => [...prev.slice(0, -1), { role: 'ai', text: `Error: ${result.error}` }]);
            } else {
                setProject(result);
                // Select first file by default if none selected
                if (!activeFile && result.files.length > 0) {
                    setActiveFile(result.files[0]);
                }
                // Update AI response
                setChatHistory(prev => [...prev.slice(0, -1), { role: 'ai', text: result.description }]);
                // Auto-switch to preview for instant gratification
                setViewMode('preview');
            }
        } catch (e) {
            console.error(e);
            setError("An unexpected error occurred.");
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

    // --- COMPONENTS ---

    const FileExplorer = () => (
        <div className="w-64 bg-[#18181b] border-r border-[#27272a] flex flex-col h-full">
            <div className="p-4 border-b border-[#27272a]">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Project Files</h3>
            </div>
            <div className="flex-grow overflow-y-auto p-2 space-y-1">
                {project?.files.map((file) => (
                    <button
                        key={file.path}
                        onClick={() => { setActiveFile(file); setViewMode('code'); }}
                        className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
                            activeFile?.path === file.path 
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                            : 'text-gray-400 hover:bg-[#27272a] hover:text-white'
                        }`}
                    >
                        <span className="text-xs opacity-70">
                            {file.name.endsWith('css') ? '#' : file.name.endsWith('tsx') ? 'TS' : '<>'}
                        </span>
                        <span className="truncate">{file.name}</span>
                    </button>
                ))}
                {!project && (
                    <div className="text-center p-4 text-gray-600 text-xs italic">
                        No files yet. Start by describing your project.
                    </div>
                )}
            </div>
        </div>
    );

    const EditorArea = () => (
        <div className="flex-grow bg-[#0d0d0d] flex flex-col h-full overflow-hidden relative">
            {/* Tabs / Header */}
            <div className="h-10 bg-[#18181b] border-b border-[#27272a] flex items-center px-4 justify-between">
                <div className="flex items-center gap-2">
                     <span className="text-xs text-gray-500">{activeFile?.path || 'No file selected'}</span>
                </div>
                <div className="flex bg-[#27272a] rounded p-0.5">
                    <button 
                        onClick={() => setViewMode('code')}
                        className={`px-3 py-0.5 text-xs rounded ${viewMode === 'code' ? 'bg-[#0d0d0d] text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        Code
                    </button>
                    <button 
                        onClick={() => setViewMode('preview')}
                        className={`px-3 py-0.5 text-xs rounded ${viewMode === 'preview' ? 'bg-[#0d0d0d] text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        Preview
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-grow overflow-auto relative">
                {viewMode === 'code' ? (
                    activeFile ? (
                        <div className="absolute inset-0 p-4">
                             <CodeBlock code={activeFile.content} language={activeFile.language} filename={activeFile.name} />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                            Select a file to edit
                        </div>
                    )
                ) : (
                    <div className="w-full h-full bg-white">
                        {project?.previewHtml ? (
                            <iframe 
                                srcDoc={project.previewHtml}
                                className="w-full h-full border-0"
                                title="Project Preview"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                No preview available.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    const AIChatPanel = () => (
        <div className="w-80 bg-[#111] border-l border-[#27272a] flex flex-col h-full">
             <div className="p-4 border-b border-[#27272a] bg-[#18181b]">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>🤖</span> Aikon Architect
                </h3>
            </div>
            
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {chatHistory.length === 0 && (
                    <div className="text-center mt-10 space-y-4">
                        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                            <span className="text-2xl">🚀</span>
                        </div>
                        <p className="text-gray-400 text-sm">
                            Describe the web app you want to build. I will architect the file structure, write the React code, and build the preview.
                        </p>
                        <div className="space-y-2">
                             <button onClick={() => setPrompt("Create a modern landing page for a coffee shop")} className="w-full text-left text-xs p-2 bg-[#1f1f1f] hover:bg-[#2a2a2a] rounded text-gray-300 border border-[#333]">
                                "Landing page for coffee shop"
                             </button>
                             <button onClick={() => setPrompt("Build a To-Do list app with drag and drop")} className="w-full text-left text-xs p-2 bg-[#1f1f1f] hover:bg-[#2a2a2a] rounded text-gray-300 border border-[#333]">
                                "To-Do list app"
                             </button>
                        </div>
                    </div>
                )}
                
                {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div 
                            className={`max-w-[90%] p-3 rounded-xl text-sm ${
                                msg.role === 'user' 
                                ? 'bg-amber-600 text-white rounded-br-none' 
                                : 'bg-[#1f1f1f] text-gray-300 border border-[#333] rounded-bl-none'
                            }`}
                        >
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isGenerating && (
                     <div className="flex items-center gap-2 text-xs text-gray-500 animate-pulse">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        Architecting...
                     </div>
                )}
            </div>

            <div className="p-4 border-t border-[#27272a] bg-[#111]">
                <div className="relative">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe changes or new features..."
                        className="w-full bg-[#1f1f1f] border border-[#333] rounded-lg p-3 text-sm text-white focus:outline-none focus:border-amber-500 pr-10 resize-none"
                        rows={3}
                        disabled={isGenerating}
                    />
                    <button 
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        className="absolute bottom-3 right-3 text-amber-500 hover:text-amber-400 disabled:opacity-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-screen w-screen flex flex-col bg-[#09090b] text-white overflow-hidden">
            {/* App Header */}
            <header className="h-14 border-b border-[#27272a] flex items-center justify-between px-4 bg-[#09090b]">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigateTo('projects')} className="text-gray-400 hover:text-white flex items-center gap-2 text-sm">
                        <span>←</span> Back
                    </button>
                    <div className="h-6 w-px bg-[#27272a]"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-lg">⚡</span>
                        <span className="font-bold tracking-tight">Aikon <span className="text-amber-500">Designer</span></span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">BETA</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                     <button 
                        className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-1.5 rounded-md text-sm font-medium shadow-lg shadow-amber-900/20 flex items-center gap-2"
                        onClick={() => alert("Export functionality coming soon! For now, you can copy files from the explorer.")}
                     >
                        <span>⬇</span> Export Project
                     </button>
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex-grow flex overflow-hidden">
                <FileExplorer />
                <EditorArea />
                <AIChatPanel />
            </div>
        </div>
    );
};

export default AikonDesignerPage;
