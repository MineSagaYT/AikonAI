import React, { useState, useEffect, useRef } from 'react';
import { Message } from '../types';
import { motion } from 'framer-motion';
import { renderParagraph } from '../utils/markdown';
import CodeBlock from './CodeBlock';

const MotionDiv = motion.div as any;

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
    const isUser = message.sender === 'user';
    
    // Typewriter Effect State
    const [displayedText, setDisplayedText] = useState(isUser ? message.text : '');
    const textRef = useRef(message.text);

    useEffect(() => {
        // Update ref immediately when prop changes
        textRef.current = message.text;
        
        // If it's user message, show immediately
        if (isUser) {
            setDisplayedText(message.text);
            return;
        }

        // For AI messages, if it's already fully sent (e.g., history load), show all
        if (message.status === 'sent' && displayedText === message.text) {
            return;
        }

        // If completely done and we are just mounting, show all to avoid re-typing history
        if (message.status === 'sent' && !displayedText) {
             setDisplayedText(message.text);
             return;
        }

        // Typewriter Logic
        let timeoutId: any;
        
        const typeWriter = () => {
            setDisplayedText(current => {
                const fullText = textRef.current;
                if (current.length < fullText.length) {
                    // Calculate chunk size based on length difference to speed up if falling behind
                    const diff = fullText.length - current.length;
                    const chunkSize = diff > 50 ? 5 : diff > 20 ? 3 : 1; 
                    
                    // Schedule next char
                    timeoutId = setTimeout(typeWriter, 15); // 15ms per chunk
                    return fullText.slice(0, current.length + chunkSize);
                } else {
                    return fullText;
                }
            });
        };

        // Start typing if we have content
        if (message.text.length > displayedText.length) {
            typeWriter();
        }

        return () => clearTimeout(timeoutId);
    }, [message.text, message.status, isUser]); // Dependency on message.text ensures we keep typing as stream updates

    return (
        <MotionDiv 
            className={`flex ${isUser ? 'justify-end' : 'gap-4'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            {!isUser && (
                <div className="flex-shrink-0 mt-1">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-brand-600 shadow-sm">
                        <i className="ph-bold ph-brain text-lg"></i>
                    </div>
                </div>
            )}
            
            <div className={`px-6 py-5 max-w-[90%] md:max-w-[80%] text-[15px] leading-relaxed shadow-sm ${isUser ? 'msg-user' : 'msg-ai'}`}>
                {message.generatedImage && (
                    <div className="mb-3">
                        <img src={message.generatedImage.url} alt={message.generatedImage.prompt} className="rounded-lg border border-white/20 w-full" />
                    </div>
                )}
                
                {message.generatedWebsite && (
                    <div className="mb-3 p-4 bg-black/80 rounded-lg font-mono text-xs text-green-400 overflow-x-auto">
                        {message.generatedWebsite.isLoading ? 'Generating Website Code...' : 'Website Code Generated (Click to Preview)'}
                    </div>
                )}

                <div 
                    dangerouslySetInnerHTML={{ __html: renderParagraph(displayedText) }} 
                    className={!isUser ? 'prose prose-slate max-w-none' : ''} 
                />
                
                {/* Cursor for effect while streaming */}
                {!isUser && message.status === 'streaming' && displayedText.length < message.text.length && (
                    <span className="inline-block w-1.5 h-4 bg-brand-500 ml-1 animate-pulse align-middle"></span>
                )}
            </div>
        </MotionDiv>
    );
};

export default MessageBubble;