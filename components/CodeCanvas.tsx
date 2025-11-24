
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
    
    const codeEditorRef = useRef<HTMLDivElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);
    const codeRef = useRef<HTMLElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        if (codeEditorRef.current && lineNumbersRef.current) {
            const top = e.currentTarget.scrollTop;
            const left = e.currentTarget.scrollLeft;
            codeEditorRef.current.scrollTop = top;
            codeEditorRef.current.scrollLeft = left;
            lineNumbersRef.current.scrollTop = top;
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
                    className="code-canvas visible"
                    onClick={onClose}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <MotionDiv 
                        className="code-canvas-container" 
                        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    >
                        <div className="code-canvas-header">
                            <h3 className="text-lg font-bold text-amber-400">Code Canvas</h3>
                            <MotionButton whileTap={{scale: 0.9}} onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</MotionButton>
                        </div>
                        <div className="code-canvas-tabs">
                            {fileKeys.map(filename => (
                                <div
                                    key={filename}
                                    className={`code-canvas-tab ${activeFile === filename ? 'active' : ''}`}
                                    onClick={() => setActiveFile(filename)}
                                >
                                    {filename}
                                    {activeFile === filename && (
                                        <MotionDiv className="active-tab-indicator" layoutId="activeTabIndicator" />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="code-canvas-editor">
                            <div ref={lineNumbersRef} className="line-numbers">
                                {Array.from({ length: lineCount }, (_, i) => (
                                    <span key={i}>{i + 1}</span>
                                ))}
                            </div>
                            <div className="editor-content">
                                <textarea
                                    ref={textareaRef}
                                    value={currentCode}
                                    // The editor is readonly for now to focus on viewing.
                                    // To enable editing: onChange={(e) => activeFile && onCodeChange(activeFile, e.target.value)}
                                    readOnly
                                    onScroll={handleScroll}
                                    spellCheck="false"
                                    aria-label="Code editor"
                                    className="editor-textarea"
                                />
                                <div ref={codeEditorRef} className="highlight-container">
                                    <pre><code ref={codeRef} className={`hljs language-${language}`}>
                                        {/* Content is set via ref to prevent React re-rendering issues with hljs */}
                                    </code></pre>
                                </div>
                            </div>
                        </div>
                        <div className="code-canvas-footer">
                            <MotionButton whileHover={{scale: 1.1}} whileTap={{scale: 0.9}} onClick={handleDownload} className="copy-button">
                                Download
                            </MotionButton>
                            <MotionButton whileHover={{scale: 1.1}} whileTap={{scale: 0.9}} onClick={handleCopy} className="copy-button">
                                {isCopied ? 'Copied!' : 'Copy'}
                            </MotionButton>
                        </div>
                    </MotionDiv>
                </MotionDiv>
            )}
        </AnimatePresence>
    );
};

export default CodeCanvas;