
import React from 'react';
import { Message } from '../types';
import { motion } from 'framer-motion';
import { renderParagraph } from '../utils/markdown';

const MotionDiv = motion.div as any;

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
    const isUser = message.sender === 'user';

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

                <div dangerouslySetInnerHTML={{ __html: renderParagraph(message.text) }} className={!isUser ? 'prose prose-slate max-w-none' : ''} />
            </div>
        </MotionDiv>
    );
};

export default MessageBubble;
