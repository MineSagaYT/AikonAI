import React, { useState } from 'react';
import { NavigationProps } from '../../types';
import ParallaxCard from '../ParallaxCard';
import { motion, AnimatePresence, Variants } from 'framer-motion';

// --- SVG Icons for Project Cards ---

const AikonAIIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-amber-400 mb-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
        <path d="M12 6c-3.31 0-6 2.69-6 6h2c0-2.21 1.79-4 4-4s4 1.79 4 4h2c0-3.31-2.69-6-6-6z"/>
        <path d="M12 10c-1.1 0-2 .9-2 2h4c0-1.1-.9-2-2-2z"/>
    </svg>
);

const AgentIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-amber-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M12 6a2 2 0 100-4 2 2 0 000 4zm0 14a2 2 0 100-4 2 2 0 000 4zm6-8a2 2 0 100-4 2 2 0 000 4zm-12 0a2 2 0 100-4 2 2 0 000 4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12l6 6m-6-6l-6 6m6-6l6-6m-6 6l-6-6" />
    </svg>
);

const VideoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-amber-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const LiveKitIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-amber-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
);


const ProjectsPage: React.FC<NavigationProps> = ({ navigateTo }) => {
    const [isAikonAiExpanded, setIsAikonAiExpanded] = useState(false);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.15 }
        }
    };

    const itemVariants: Variants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: "spring", stiffness: 100, damping: 15 }
        }
    };
    
    const aikonFeatures = [
        { icon: '🧠', title: 'Multi-Modal Reasoning', description: 'Understands and processes both text and image inputs simultaneously.' },
        { icon: '🌐', title: 'Live Web Search', description: 'Accesses real-time information from Google for up-to-date answers.' },
        { icon: '🤖', title: 'Autonomous Agent', description: 'Executes complex, multi-step tasks by creating and following a plan.' },
        { icon: '🎨', title: 'Image Generation', description: 'Creates original, high-quality images and art from text prompts.' },
        { icon: '🎬', title: 'Video Generation', description: 'Generates high-fidelity video clips from text or image inputs via Google Veo.' },
        { icon: '🔊', title: 'Text-to-Speech', description: 'Converts text into natural, human-like audio.' },
        { icon: '📊', title: 'PowerPoint Generation', description: 'Automatically creates professional .pptx presentations on any topic.' },
        { icon: '📄', title: 'Word & Excel Files', description: 'Generates structured .docx documents and data-filled .xlsx spreadsheets.' },
        { icon: '📝', title: 'Document Summarization', description: 'Quickly condenses long documents, articles, or text files into key points.' },
        { icon: '💬', title: 'Live Conversation', description: 'Engages in real-time, low-latency voice conversations.' },
        { icon: '🎭', title: 'Custom Personas', description: 'Adapts its personality and expertise by switching or creating new personas.' },
        { icon: '🛠️', title: 'Developer Sandbox', description: 'Executes Python code and manages files in a secure environment for advanced tasks.' },
    ];
    
    const listVariants = {
        visible: { transition: { staggerChildren: 0.05 } }
    };
    const featureVariants = {
        hidden: { opacity: 0, x: -10 },
        visible: { opacity: 1, x: 0 },
    };


    return (
        <motion.main 
            className="max-w-7xl mx-auto p-4 md:p-8 relative z-10"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <section className="text-center py-16 md:py-24">
                <motion.h2 variants={itemVariants} className="text-5xl md:text-7xl font-black leading-tight tracking-tighter">
                    Showcase of <span className="hero-gradient">AI Innovations</span>
                </motion.h2>
                <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-400 max-w-4xl mx-auto pt-4 mb-16">
                    Explore the core technologies and flagship projects that define Aikon Studios. Each system is designed for intelligence, adaptability, and real-world impact.
                </motion.p>

                <motion.div 
                    className="grid md:grid-cols-2 gap-8 text-left"
                    variants={containerVariants}
                >
                    {/* --- Project 1: AikonAI --- */}
                    <motion.div variants={itemVariants}>
                        <ParallaxCard depth={3} className="p-8 ai-glow-border hover:shadow-[0_0_50px_rgba(255,193,7,0.3)] h-full flex flex-col">
                            <AikonAIIcon />
                            <h3 className="text-3xl font-extrabold text-white mb-2">AikonAI</h3>
                            <p className="text-xl font-medium text-amber-400 mb-6">The Core Conversational & Reasoning Engine</p>
                            <p className="text-gray-400 mb-6">Our flagship AI assistant, designed for natural, multi-modal interaction and intelligent task completion. It serves as the user-facing gateway to our entire suite of AI capabilities.</p>
                            
                             <div className="border-t border-gray-700 pt-4 mb-6">
                                <p className="text-gray-300">
                                    <strong className="text-white">Core Principles:</strong> Cognitive Reasoning, Real-Time Context, and Cultural Fluency (<strong className="text-amber-300">Hinglish</strong>).
                                </p>
                            </div>
                            
                            <AnimatePresence>
                                {isAikonAiExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                        animate={{ height: 'auto', opacity: 1, marginTop: '1.5rem' }}
                                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                                        className="overflow-hidden"
                                    >
                                        <motion.div 
                                            className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 border-t border-gray-700 pt-6"
                                            variants={listVariants}
                                            initial="hidden"
                                            animate="visible"
                                        >
                                            {aikonFeatures.map(feature => (
                                                <motion.div key={feature.title} variants={featureVariants} className="flex items-start space-x-3">
                                                    <span className="text-xl mt-1 flex-shrink-0">{feature.icon}</span>
                                                    <div>
                                                        <h4 className="font-bold text-white">{feature.title}</h4>
                                                        <p className="text-gray-400 text-sm">{feature.description}</p>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="mt-auto pt-8 flex items-center flex-wrap gap-4">
                                <motion.button 
                                    onClick={() => navigateTo('chat')} 
                                    className="inline-block px-6 py-2 text-black font-bold text-base rounded-xl shadow-lg cta-button-animated tracking-wider"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Experience AikonAI →
                                </motion.button>
                                 <motion.button 
                                    onClick={() => setIsAikonAiExpanded(!isAikonAiExpanded)} 
                                    className="text-amber-400 font-semibold text-sm hover:underline px-4 py-2"
                                    whileTap={{ scale: 0.95 }}
                                >
                                    {isAikonAiExpanded ? 'Hide All Features' : 'View All Features'}
                                </motion.button>
                            </div>
                        </ParallaxCard>
                    </motion.div>

                    {/* --- Project 4: Video Generation --- */}
                    <motion.div variants={itemVariants}>
                        <ParallaxCard depth={3} className="p-8 ai-glow-border hover:shadow-[0_0_50px_rgba(255,193,7,0.3)] h-full">
                            <VideoIcon />
                            <h3 className="text-3xl font-extrabold text-white mb-2">AI-Powered Video Generation</h3>
                            <p className="text-xl font-medium text-amber-400 mb-6">Bringing Ideas to Life with Google's 'Veo'</p>
                            <p className="text-gray-400 mb-6">We integrate state-of-the-art generative models to transform simple text prompts into rich, dynamic video content. This opens up new frontiers for creative storytelling, marketing, and rapid visualization.</p>
                            <ul className="space-y-3 text-gray-300 border-t border-gray-700 pt-4">
                                <li className="flex items-start space-x-3"><span className="text-amber-400 font-bold mt-1">▸</span><p><strong className="text-white">High-Fidelity Output:</strong> Leverages <strong className="text-amber-300">Google's Veo model</strong> to produce stunning, high-definition (720p/1080p) video clips with remarkable coherence and detail.</p></li>
                                <li className="flex items-start space-x-3"><span className="text-amber-400 font-bold mt-1">▸</span><p><strong className="text-white">Text-to-Video Synthesis:</strong> Simply describe a scene, an action, or a style, and the AI director generates a video to match your vision.</p></li>
                                <li className="flex items-start space-x-3"><span className="text-amber-400 font-bold mt-1">▸</span><p><strong className="text-white">Creative Control:</strong> Supports various aspect ratios (16:9, 9:16) to tailor content for different platforms, from cinematic shorts to social media stories.</p></li>
                            </ul>
                            <button disabled className="inline-block px-6 py-2 mt-8 text-black font-bold text-base rounded-xl shadow-lg bg-gray-600 tracking-wider cursor-not-allowed">
                                Watch Demo (Soon)
                            </button>
                        </ParallaxCard>
                    </motion.div>
                </motion.div>
            </section>
            <motion.div variants={itemVariants} className="text-center mt-12">
                <motion.button 
                    onClick={() => navigateTo('home')} 
                    className="text-lg text-gray-400 hover:text-amber-400 transition-colors duration-300 tracking-wider flex items-center justify-center mx-auto space-x-2"
                    whileHover={{ scale: 1.05, x: -4 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                    <span>Back to Home</span>
                </motion.button>
            </motion.div>
        </motion.main>
    );
};

export default ProjectsPage;