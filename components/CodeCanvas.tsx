
import React, { useState, useEffect, useRef } from 'react';
import { CanvasFiles } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

declare const hljs: any;

interface CodeCanvasProps {
    files: CanvasFiles;
    isVisible: boolean;
    onClose: () => void;
}

const MotionDiv = motion.div as any;
const MotionButton = motion.button as any;

const CodeCanvas: React.FC<CodeCanvasProps> = ({ files, isVisible, onClose }) => {
    const fileKeys = Object.keys(files);
    const [activeFile, setActiveFile] = useState<string | null>(fileKeys.length > 0 ? fileKeys[0] : null);
    const [isCopied, setIsCopied] = useState(false);
    
    // Refs
    const lineNumbersRef = useRef<HTMLDivElement>(null);
    const codeEditorRef = useRef<HTMLDivElement>(null); // Highlight container
    const codeRef = useRef<HTMLElement>(null); // Code element
    const textareaRef = useRef<HTMLTextAreaElement>(null); // Interactive textarea

    const currentCode = activeFile ? files[activeFile] : '';
    const lineCount = currentCode.split('\n').length;
    const language = activeFile?.split('.').pop()?.replace('js', 'javascript').replace('py', 'python') || 'plaintext';
    
    useEffect(() => {
        if (isVisible && fileKeys.length > 0) {
            if (!activeFile || !fileKeys.includes(activeFile)) {
                 setActiveFile(fileKeys[0]);
            }
        }
    }, [isVisible, files, activeFile, fileKeys]);

    useEffect(() => {
        if (codeRef.current && activeFile) {
            codeRef.current.textContent = currentCode;
            if (typeof hljs !== 'undefined') {
                try {
                    codeRef.current.removeAttribute('data-highlighted');
                    hljs.highlightElement(codeRef.current);
                } catch(e) {
                    console.warn("Highlight.js warning:", e instanceof Error ? e.message : String(e));
                }
            }
        }
    }, [currentCode, language, activeFile]);

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        // Sync scroll from textarea to other elements
        if (codeEditorRef.current && lineNumbersRef.current) {
            const { scrollTop, scrollLeft } = e.currentTarget;
            
            // Sync highlight layer (both axes)
            codeEditorRef.current.scrollTop = scrollTop;
            codeEditorRef.current.scrollLeft = scrollLeft;
            
            // Sync line numbers (vertical only)
            lineNumbersRef.current.scrollTop = scrollTop;
        }
    };

    const handleCopy = async () => {
        if (!activeFile) return;
        try {
            await navigator.clipboard.writeText(files[activeFile]);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code: ', err);
        }
    };

    const handleDownload = () => {
        if (!activeFile) return;
        const blob = new Blob([files[activeFile]], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = activeFile;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <MotionDiv 
                    className="fixed inset-0 z-[60] flex items-center justify-end bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <MotionDiv 
                        className="w-full max-w-4xl h-full bg-[#1e1e1e] shadow-2xl flex flex-col border-l border-white/10"
                        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#252526]">
                            <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                                <i className="ph-bold ph-code"></i> Code Canvas
                            </h3>
                            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
                                <i className="ph-bold ph-x text-xl"></i>
                            </button>
                        </div>
                        
                        {/* Tabs */}
                        <div className="flex bg-[#252526] overflow-x-auto scrollbar-hide border-b border-white/10">
                            {fileKeys.map(filename => (
                                <button
                                    key={filename}
                                    className={`px-4 py-3 text-sm font-medium border-r border-white/5 flex-shrink-0 relative transition-colors ${
                                        activeFile === filename 
                                        ? 'bg-[#1e1e1e] text-amber-400' 
                                        : 'text-gray-400 hover:bg-[#2a2a2d] hover:text-gray-200'
                                    }`}
                                    onClick={() => setActiveFile(filename)}
                                >
                                    {filename}
                                    {activeFile === filename && (
                                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-400"></div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Editor Container */}
                        <div className="flex-grow flex relative overflow-hidden bg-[#1e1e1e]">
                            {/* Line Numbers */}
                            <div 
                                ref={lineNumbersRef}
                                className="flex-none w-12 pt-4 pr-3 text-right text-gray-600 border-r border-white/10 bg-[#1e1e1e] font-mono text-sm leading-6 select-none overflow-hidden"
                            >
                                {Array.from({ length: lineCount }, (_, i) => (
                                    <div key={i}>{i + 1}</div>
                                ))}
                            </div>

                            {/* Code Area */}
                            <div className="flex-grow relative overflow-hidden">
                                {/* Textarea (Interactive Layer) */}
                                <textarea
                                    ref={textareaRef}
                                    value={currentCode}
                                    readOnly
                                    onScroll={handleScroll}
                                    className="absolute inset-0 w-full h-full bg-transparent text-transparent caret-amber-400 p-4 font-mono text-sm leading-6 resize-none outline-none whitespace-pre overflow-auto z-10"
                                    spellCheck={false}
                                />
                                
                                {/* Highlight Layer (Visual Layer) */}
                                <div 
                                    ref={codeEditorRef} 
                                    className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-0 bg-[#1e1e1e]"
                                >
                                    <pre className="m-0 p-4 font-mono text-sm leading-6">
                                        <code ref={codeRef} className={`language-${language}`}>
                                            {/* HLJS injects here */}
                                        </code>
                                    </pre>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-white/10 bg-[#252526] flex justify-end gap-3">
                            <MotionButton 
                                whileHover={{ scale: 1.05 }} 
                                whileTap={{ scale: 0.95 }} 
                                onClick={handleDownload} 
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <i className="ph-bold ph-download-simple mr-2"></i> Download
                            </MotionButton>
                            <MotionButton 
                                whileHover={{ scale: 1.05 }} 
                                whileTap={{ scale: 0.95 }} 
                                onClick={handleCopy} 
                                className="px-4 py-2 bg-brand-primary hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-brand-primary/20"
                            >
                                <i className="ph-bold ph-copy mr-2"></i> {isCopied ? 'Copied!' : 'Copy Code'}
                            </MotionButton>
                        </div>

                    </MotionDiv>
                </MotionDiv>
            )}
        </AnimatePresence>
    );
};

export default CodeCanvas;
