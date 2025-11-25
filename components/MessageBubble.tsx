import React, { useState, useEffect, useRef } from 'react';
import { Message } from '../types';
import { motion } from 'framer-motion';
import { renderParagraph } from '../utils/markdown';
import CodeBlock from './CodeBlock';

const MotionDiv = motion.div as any;

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
    const isUser = message.sender === 'user';
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [justShared, setJustShared] = useState(false);
    
    // Typewriter Effect State
    const [displayedText, setDisplayedText] = useState(isUser ? message.text : '');
    const textRef = useRef(message.text);
    const timerRef = useRef<any>(null);

    // Cleanup speech on unmount
    useEffect(() => {
        return () => {
            window.speechSynthesis.cancel();
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    useEffect(() => {
        // Update reference immediately when prop changes (streaming update)
        textRef.current = message.text;
        
        // 1. If it's a user message, show immediately.
        if (isUser) {
            setDisplayedText(message.text);
            return;
        }

        // 2. Handling History vs New Stream:
        // If the message is already 'sent' (finished) AND we haven't shown anything yet (initial render of history),
        // show it all at once to prevent re-typing old chats.
        if (message.status === 'sent' && displayedText === '') {
             setDisplayedText(message.text);
             return;
        }

        // 3. If we have already displayed the full text, stop.
        if (displayedText === message.text) return;

        // 4. The Typewriter Engine
        // Uses a recursive setTimeout to simulate typing. 
        // Dynamic delay helps catch up if the stream is very fast or the text is long.
        const typeNextChar = () => {
            setDisplayedText((current) => {
                const fullText = textRef.current;
                
                // If we caught up, stop
                if (current.length >= fullText.length) {
                    return fullText; 
                }

                // Logic to determine how many chars to add in this frame.
                // If we are far behind (>20 chars), add a chunk to catch up.
                // Otherwise, add 1 char for the smooth typing feel.
                const distance = fullText.length - current.length;
                const chunkSize = distance > 50 ? 5 : distance > 20 ? 2 : 1;
                
                const nextText = fullText.slice(0, current.length + chunkSize);
                
                // Schedule next tick. 
                // 10ms-20ms is a good "fast typing" speed.
                // If we added a big chunk, delay a bit more to let the eye register.
                const delay = chunkSize > 1 ? 30 : 15;
                
                timerRef.current = setTimeout(typeNextChar, delay);
                
                return nextText;
            });
        };

        // Ensure we don't have multiple timers running
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(typeNextChar, 15);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [message.text, isUser, message.status]); // Dependencies ensure we react to stream updates

    const handleSpeak = () => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            const utterance = new SpeechSynthesisUtterance(message.text);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);
            
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha')) || voices[0];
            if (preferredVoice) utterance.voice = preferredVoice;

            window.speechSynthesis.speak(utterance);
            setIsSpeaking(true);
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    text: message.text,
                });
            } catch (err) {
                // Share cancelled or failed
            }
        } else {
            navigator.clipboard.writeText(message.text);
            setJustShared(true);
            setTimeout(() => setJustShared(false), 2000);
        }
    };

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
            
            <div className={`flex flex-col max-w-[90%] md:max-w-[80%]`}>
                <div className={`px-6 py-5 text-[15px] leading-relaxed shadow-sm ${isUser ? 'msg-user rounded-2xl rounded-tr-sm' : 'msg-ai rounded-2xl rounded-tl-sm bg-white border border-slate-100'}`}>
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
                    
                    {/* Cursor for effect while writing */}
                    {!isUser && displayedText.length < message.text.length && (
                        <span className="inline-block w-1.5 h-4 bg-brand-500 ml-1 animate-pulse align-middle"></span>
                    )}
                </div>

                {/* Action Bar for AI Messages */}
                {!isUser && message.status !== 'streaming' && (
                    <div className="flex items-center gap-2 mt-1.5 ml-2 opacity-0 hover:opacity-100 transition-opacity duration-200 group-hover:opacity-100">
                        <button 
                            onClick={handleSpeak}
                            className={`p-1.5 rounded-full transition-colors flex items-center gap-1 ${isSpeaking ? 'bg-brand-100 text-brand-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                            title={isSpeaking ? "Stop Reading" : "Read Aloud"}
                        >
                            <i className={`ph-bold ${isSpeaking ? 'ph-stop' : 'ph-speaker-high'} text-lg`}></i>
                        </button>
                        <button 
                            onClick={handleShare}
                            className={`p-1.5 rounded-full transition-colors flex items-center gap-1 ${justShared ? 'text-emerald-500' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                            title="Share"
                        >
                            <i className={`ph-bold ${justShared ? 'ph-check' : 'ph-share-network'} text-lg`}></i>
                        </button>
                    </div>
                )}
            </div>
        </MotionDiv>
    );
};

export default MessageBubble;