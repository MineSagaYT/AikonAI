
import React, { useState } from 'react';
import { NavigationProps } from '../../types';
import { generateSimpleText } from '../../services/geminiService';
import ParallaxCard from '../ParallaxCard';

const LoadingIcon: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


const HomePage: React.FC<NavigationProps> = ({ navigateTo }) => {
    const missionStatement = "Driven by a deep interest in **Sanatana Dharma** and technology, we aim to build tools that are ethical, impactful, and globally relevant.";
    const [founderQuote, setFounderQuote] = useState<string>('');
    const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false);

    const handleGenerateQuote = async () => {
        setIsLoadingQuote(true);
        const systemPrompt = "You are a visionary tech founder, Aditya Jain. Generate an inspiring, short quote about the future of technology.";
        const userQuery = "Generate a quote that links AI, coding, and the ethical principles of Sanatana Dharma. Keep it under 25 words.";
        const quoteRes = await generateSimpleText(systemPrompt, userQuery);
        if (quoteRes) setFounderQuote(quoteRes.replace(/"/g, ''));
        setIsLoadingQuote(false);
    };


    return (
        <main className="max-w-7xl mx-auto p-4 md:p-8 relative z-10">
            <section id="top" className="text-center py-20 md:py-32 animate-fade-in" style={{ animationDuration: '0.8s' }}>
                <div className="space-y-6">
                    <h2 className="text-5xl md:text-8xl font-black leading-tight tracking-tighter">
                        Crafting the Future with <span className="hero-gradient">Intelligent Design</span>
                    </h2>
                    <p className="text-xl md:text-2xl text-gray-400 max-w-4xl mx-auto pt-4">
                        Aikon Studios is where passion meets precision in the world of Artificial Intelligence, delivering <strong>ethical and impactful</strong> next-generation technology solutions.
                    </p>
                    <div className="pt-10">
                         <button onClick={() => navigateTo('projects')} className="px-10 py-4 text-black font-bold text-lg rounded-xl shadow-lg cta-button-animated tracking-wider">
                            EXPLORE OUR PROJECTS →
                        </button>
                    </div>
                </div>
            </section>

            <section id="mission" className="py-16 md:py-24">
                <h3 className="text-4xl font-bold text-center mb-16 hero-gradient tracking-wide animate-fade-in-up">OUR MISSION & EXPERTISE</h3>
                <div className="grid md:grid-cols-3 gap-8">
                    <ParallaxCard depth={10} className="p-8 border-t-4 border-amber-600/50 hover:shadow-[0_0_40px_rgba(255,193,7,0.5)] animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                        <div className="text-5xl mb-4 text-amber-400">🧠</div>
                        <h4 className="text-2xl font-semibold mb-3 text-white">Advanced AI Development</h4>
                        <p className="text-gray-400">From conversational agents like <strong>AikonAI</strong> to complex reasoning engines, we build sophisticated, custom-trained large language models tailored for unique challenges.</p>
                    </ParallaxCard>
                    <ParallaxCard depth={10} className="p-8 border-t-4 border-white/50 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                        <div className="text-5xl mb-4 text-white">💻</div>
                        <h4 className="text-2xl font-semibold mb-3 text-white">Full-Stack Software</h4>
                        <p className="text-gray-400">Developing robust, scalable web applications and systems, focusing on clean code, performance, and exceptional, modern user experience.</p>
                    </ParallaxCard>
                    <ParallaxCard depth={10} className="p-8 border-t-4 border-amber-500/50 hover:shadow-[0_0_40px_rgba(255,193,7,0.5)] animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                        <div>
                            <div className="text-5xl mb-4 text-amber-400">✨</div>
                            <h4 className="text-2xl font-semibold mb-3 text-white">Innovation with Purpose</h4>
                            <p className="text-gray-400 mb-4" dangerouslySetInnerHTML={{ __html: missionStatement.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        </div>
                    </ParallaxCard>
                </div>
            </section>

            <section id="founder" className="py-16 md:py-24">
                <h3 className="text-4xl font-bold text-center mb-16 hero-gradient tracking-wide animate-fade-in-up">THE FOUNDER'S VISION</h3>
                <ParallaxCard depth={15} className="max-w-5xl mx-auto p-8 md:p-16 flex flex-col lg:flex-row items-center space-y-8 lg:space-y-0 lg:space-x-12 ai-glow-border shadow-2xl shadow-gray-900 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    <div className="flex-shrink-0 w-40 h-40 rounded-full bg-gradient-to-br from-gray-700 to-amber-500 flex items-center justify-center text-7xl font-extrabold text-white shadow-xl ring-4 ring-amber-400/30">AJ</div>
                    <div className="text-center lg:text-left flex-grow">
                        <h4 className="text-4xl font-extrabold text-white mb-2">Aditya Jain</h4>
                        <p className="text-xl font-medium text-amber-400 mb-6 tracking-wide">Founder & Chief Architect, Aikon Studios</p>
                        <p className="text-gray-300 leading-relaxed text-lg mb-6">
                            Aditya is the driving force behind Aikon Studios, combining a profound passion for <strong>coding, AI, and the technological field</strong> with a strong inclination towards <strong>Sanatana Dharma</strong>. His vision is to fuse these worlds, creating ethical, highly intelligent, and user-friendly systems. He is dedicated to crafting technology that not only innovates but but also serves a higher purpose.
                        </p>
                        <div className="pt-6 border-t border-gray-700 w-full text-center lg:text-left">
                            <div className="text-lg text-amber-200 italic mb-4 min-h-[50px]">
                                {founderQuote ? `"${founderQuote}"` : ''}
                            </div>
                            <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                                <button onClick={handleGenerateQuote} disabled={isLoadingQuote} className="px-6 py-2 text-sm bg-gray-800 text-amber-400 rounded-xl hover:bg-gray-700 transition-colors duration-200 shadow-md flex items-center space-x-2 disabled:opacity-50">
                                    {isLoadingQuote ? <LoadingIcon /> : <span>✨</span>}
                                    <span>{isLoadingQuote ? 'Generating...' : 'Visionary Quote Generator'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </ParallaxCard>
            </section>
        </main>
    );
};

export default HomePage;