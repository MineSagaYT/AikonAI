import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

declare const hljs: any;

interface CodeBlockProps {
    code: string;
    language?: string;
    filename?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, filename }) => {
    const [isCopied, setIsCopied] = useState(false);
    const codeRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (codeRef.current) {
            if (typeof hljs !== 'undefined') {
                try {
                    hljs.highlightElement(codeRef.current);
                } catch (e) {
                    console.error("Highlight.js error:", e);
                }
            }
        }
    }, [code, language]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };
    
    return (
        <div className="code-block">
            <div className="code-block-header">
                <span>{filename ? `${filename} (${language || 'text'})` : (language || 'code')}</span>
                <div className="flex items-center gap-2">
                    <motion.button 
                        onClick={handleCopy} 
                        className="copy-button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <AnimatePresence mode="popLayout" initial={false}>
                            <motion.svg 
                                key={isCopied ? 'copied' : 'copy'}
                                xmlns="http://www.w3.org/2000/svg" 
                                className="h-4 w-4" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor" 
                                strokeWidth={2}
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                transition={{ duration: 0.15 }}
                            >
                                {isCopied ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                )}
                            </motion.svg>
                        </AnimatePresence>
                        {isCopied ? 'Copied!' : 'Copy'}
                    </motion.button>
                </div>
            </div>
            <pre>
                <code ref={codeRef} className={`language-${language}`}>
                    {code}
                </code>
            </pre>
        </div>
    );
};

export default CodeBlock;