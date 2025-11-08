import React from 'react';
import { NavigationProps } from '../../types';
import ParallaxCard from '../ParallaxCard';

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
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-amber-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
);


const ProjectsPage: React.FC<NavigationProps> = ({ navigateTo }) => {
    return (
        <main className="max-w-7xl mx-auto p-4 md:p-8 relative z-10">
            <section className="text-center py-16 md:py-24">
                <h2 className="text-5xl md:text-7xl font-black leading-tight tracking-tighter animate-fade-in-up">
                    Showcase of <span className="hero-gradient">AI Innovations</span>
                </h2>
                <p className="text-xl md:text-2xl text-gray-400 max-w-4xl mx-auto pt-4 mb-16 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                    Explore the core technologies and flagship projects that define Aikon Studios. Each system is designed for intelligence, adaptability, and real-world impact.
                </p>

                <div className="grid md:grid-cols-2 gap-8 text-left">
                    {/* --- Project 1: AikonAI --- */}
                    <ParallaxCard depth={15} className="p-8 ai-glow-border hover:shadow-[0_0_50px_rgba(255,193,7,0.3)] animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                        <AikonAIIcon />
                        <h3 className="text-3xl font-extrabold text-white mb-2">AikonAI</h3>
                        <p className="text-xl font-medium text-amber-400 mb-6">The Core Conversational & Reasoning Engine</p>
                        <p className="text-gray-400 mb-6">Our flagship AI assistant, designed for natural, multi-modal interaction and intelligent task completion. It serves as the user-facing gateway to our entire suite of AI capabilities.</p>
                        <ul className="space-y-3 text-gray-300 border-t border-gray-700 pt-4">
                            <li className="flex items-start space-x-3"><span className="text-amber-400 font-bold mt-1">▸</span><p><strong className="text-white">Cognitive Reasoning:</strong> Powered by advanced models, it performs complex task breakdown and tool use for real-world problem-solving.</p></li>
                            <li className="flex items-start space-x-3"><span className="text-amber-400 font-bold mt-1">▸</span><p><strong className="text-white">Real-Time Context:</strong> Maintains persistent memory to understand user history, preferences, and conversational nuances.</p></li>
                            <li className="flex items-start space-x-3"><span className="text-amber-400 font-bold mt-1">▸</span><p><strong className="text-white">Cultural Fluency:</strong> Expertly trained to speak in natural <strong className="text-amber-300">Hinglish</strong>, making interactions fluid and relatable for the Indian tech space.</p></li>
                        </ul>
                         <button onClick={() => navigateTo('chat')} className="inline-block px-6 py-2 mt-8 text-black font-bold text-base rounded-xl shadow-lg cta-button-animated tracking-wider">
                            Experience AikonAI →
                        </button>
                    </ParallaxCard>

                    {/* --- Project 2: Autonomous Agent Framework --- */}
                    <ParallaxCard depth={15} className="p-8 ai-glow-border hover:shadow-[0_0_50px_rgba(255,193,7,0.3)] animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                        <AgentIcon />
                        <h3 className="text-3xl font-extrabold text-white mb-2">Autonomous Agent Framework</h3>
                        <p className="text-xl font-medium text-amber-400 mb-6">From Goal to Execution, Intelligently.</p>
                        <p className="text-gray-400 mb-6">The "brain" that empowers AikonAI to move beyond simple chat. This framework allows the AI to autonomously plan and execute multi-step tasks by intelligently selecting and using a variety of digital tools.</p>
                        <ul className="space-y-3 text-gray-300 border-t border-gray-700 pt-4">
                            <li className="flex items-start space-x-3"><span className="text-amber-400 font-bold mt-1">▸</span><p><strong className="text-white">Multi-Step Planning:</strong> The agent analyzes a user's goal and generates a logical sequence of actions to achieve it.</p></li>
                            <li className="flex items-start space-x-3"><span className="text-amber-400 font-bold mt-1">▸</span><p><strong className="text-white">Dynamic Tool Use:</strong> Can seamlessly utilize tools like <strong className="text-amber-300">Google Search</strong>, webpage browsing, and a file system for reading/writing documents.</p></li>
                             <li className="flex items-start space-x-3"><span className="text-amber-400 font-bold mt-1">▸</span><p><strong className="text-white">Self-Correction & Approval:</strong> Can identify when a tool fails, attempt alternative solutions, or pause and ask the user for approval before proceeding with critical actions.</p></li>
                        </ul>
                        <button disabled className="inline-block px-6 py-2 mt-8 text-black font-bold text-base rounded-xl shadow-lg bg-gray-600 tracking-wider cursor-not-allowed">
                            View Architecture (Soon)
                        </button>
                    </ParallaxCard>
                    
                     {/* --- Project 3: Real-Time Conversational AI --- */}
                    <ParallaxCard depth={15} className="p-8 ai-glow-border hover:shadow-[0_0_50px_rgba(255,193,7,0.3)] animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                        <LiveKitIcon />
                        <h3 className="text-3xl font-extrabold text-white mb-2">Real-Time Conversational AI</h3>
                        <p className="text-xl font-medium text-amber-400 mb-6">Fluid Voice Interactions via LiveKit & Gemini</p>
                        <p className="text-gray-400 mb-6">We elevate human-computer interaction by enabling real-time, low-latency voice conversations. This system bypasses traditional text interfaces for a more natural and efficient conversational flow.</p>
                        <ul className="space-y-3 text-gray-300 border-t border-gray-700 pt-4">
                            <li className="flex items-start space-x-3"><span className="text-amber-400 font-bold mt-1">▸</span><p><strong className="text-white">LiveKit Infrastructure:</strong> Built on the robust, open-source <strong className="text-amber-300">LiveKit.io</strong> platform, ensuring scalable and reliable WebRTC-based audio streaming.</p></li>
                            <li className="flex items-start space-x-3"><span className="text-amber-400 font-bold mt-1">▸</span><p><strong className="text-white">Gemini Live API:</strong> AikonAI's intelligence is streamed directly as audio using the <strong className="text-amber-300">Gemini Live API</strong>, allowing the AI to listen and respond in a continuous, uninterrupted conversation.</p></li>
                            <li className="flex items-start space-x-3"><span className="text-amber-400 font-bold mt-1">▸</span><p><strong className="text-white">Instantaneous & Expressive:</strong> Experience AikonAI's personality and intelligence through spoken word, complete with natural intonation, making interactions more personal and engaging.</p></li>
                        </ul>
                         <button onClick={() => navigateTo('chat')} className="inline-block px-6 py-2 mt-8 text-black font-bold text-base rounded-xl shadow-lg cta-button-animated tracking-wider">
                            Try Live Voice Chat →
                        </button>
                    </ParallaxCard>

                    {/* --- Project 4: Video Generation --- */}
                     <ParallaxCard depth={15} className="p-8 ai-glow-border hover:shadow-[0_0_50px_rgba(255,193,7,0.3)] animate-fade-in-up" style={{ animationDelay: '500ms' }}>
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
                </div>
            </section>
            <div className="text-center mt-12">
                <button onClick={() => navigateTo('home')} className="text-lg text-gray-400 hover:text-amber-400 transition-colors duration-300 tracking-wider flex items-center justify-center mx-auto space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                    <span>Back to Home</span>
                </button>
            </div>
        </main>
    );
};

export default ProjectsPage;