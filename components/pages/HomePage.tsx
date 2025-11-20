
import React, { useState } from 'react';
import { NavigationProps } from '../../types';
import { generateSimpleText, sendContactMessage } from '../../services/geminiService';
import ParallaxCard from '../ParallaxCard';
import { motion } from 'framer-motion';

const MotionSection = motion.section as any;
const MotionH2 = motion.h2 as any;
const MotionP = motion.p as any;
const MotionDiv = motion.div as any;
const MotionButton = motion.button as any;
const MotionH3 = motion.h3 as any;

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

    // State for contact form
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactMessage, setContactMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const handleGenerateQuote = async () => {
        setIsLoadingQuote(true);
        const systemPrompt = "You are a visionary tech founder, Aditya Jain. Generate an inspiring, short quote about the future of technology.";
        const userQuery = "Generate a quote that links AI, coding, and the ethical principles of Sanatana Dharma. Keep it under 25 words.";
        
        try {
            const quoteRes = await generateSimpleText(systemPrompt, userQuery);
            if (quoteRes) setFounderQuote(quoteRes.replace(/"/g, ''));
        } catch(e) {
            console.error(e);
            setFounderQuote("Could not generate quote. Please ensure your API key is set correctly.");
        } finally {
            setIsLoadingQuote(false);
        }
    };

    const handleContactSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contactName || !contactEmail || !contactMessage) {
            setFormStatus({ type: 'error', message: 'Please fill out all fields.' });
            return;
        }
        setIsSending(true);
        setFormStatus(null);
        try {
            const response = await sendContactMessage(contactName, contactEmail, contactMessage);
            if (response) {
                setFormStatus({ type: 'success', message: response });
                setContactName('');
                setContactEmail('');
                setContactMessage('');
            } else {
                throw new Error("No response from server.");
            }
        } catch (error) {
            console.error("Contact form error:", error);
            setFormStatus({ type: 'error', message: 'Sorry, there was an issue sending your message. Please try again later.' });
        } finally {
            setIsSending(false);
        }
    };


    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
                delayChildren: 0.1,
            }
        }
    };

    const itemVariants: any = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: "spring", stiffness: 100, damping: 20 }
        }
    };

    return (
        <main className="max-w-7xl mx-auto p-6 md:p-10 relative z-10 pt-24">
            <MotionSection 
                id="top" 
                className="text-center py-16 md:py-24"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <div className="space-y-8 max-w-4xl mx-auto">
                    <MotionH2 variants={itemVariants} className="text-5xl md:text-7xl font-black leading-none tracking-tight text-white">
                        Crafting the Future with <br /><span className="hero-gradient mt-2">Intelligent Design</span>
                    </MotionH2>
                    <MotionP variants={itemVariants} className="text-xl text-gray-400 pt-2 font-light">
                        Aikon Studios connects the precision of Artificial Intelligence with ethical depth, delivering impactful next-generation solutions.
                    </MotionP>
                    <MotionDiv variants={itemVariants} className="pt-8 flex justify-center gap-4">
                         <MotionButton 
                            onClick={() => navigateTo('projects')} 
                            className="px-8 py-3 bg-white text-black font-bold text-sm uppercase tracking-widest rounded hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                         >
                            View Projects
                        </MotionButton>
                        <MotionButton 
                            onClick={() => navigateTo('chat')} 
                            className="px-8 py-3 border border-white/20 text-white font-bold text-sm uppercase tracking-widest rounded hover:bg-white/10 transition-all"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                         >
                            Launch Studio
                        </MotionButton>
                    </MotionDiv>
                </div>
            </MotionSection>

            <MotionSection 
                id="mission" 
                className="py-16"
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
            >
                <MotionH3 variants={itemVariants} className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] text-center mb-12">Our Mission & Expertise</MotionH3>
                <div className="grid md:grid-cols-3 gap-6">
                    <MotionDiv variants={itemVariants}>
                        <ParallaxCard className="p-8 h-full border border-amber-500/20 bg-amber-950/10 hover:border-amber-500/40">
                            <div className="text-3xl mb-4 text-amber-500">🧠</div>
                            <h4 className="text-xl font-bold mb-3 text-white">AI Development</h4>
                            <p className="text-sm text-gray-400 leading-relaxed">From conversational agents like <strong>AikonAI</strong> to complex reasoning engines, we build sophisticated models tailored for unique challenges.</p>
                        </ParallaxCard>
                    </MotionDiv>
                    <MotionDiv variants={itemVariants}>
                        <ParallaxCard className="p-8 h-full border border-white/10 bg-white/5 hover:border-white/20">
                            <div className="text-3xl mb-4 text-white">💻</div>
                            <h4 className="text-xl font-bold mb-3 text-white">Full-Stack Software</h4>
                            <p className="text-sm text-gray-400 leading-relaxed">Developing robust, scalable web applications and systems, focusing on clean code, performance, and exceptional UX.</p>
                        </ParallaxCard>
                    </MotionDiv>
                    <MotionDiv variants={itemVariants}>
                        <ParallaxCard className="p-8 h-full border border-purple-500/20 bg-purple-950/10 hover:border-purple-500/40">
                            <div className="text-3xl mb-4 text-purple-500">✨</div>
                            <h4 className="text-xl font-bold mb-3 text-white">Innovation with Purpose</h4>
                            <p className="text-sm text-gray-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: missionStatement.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        </ParallaxCard>
                    </MotionDiv>
                </div>
            </MotionSection>

            <MotionSection 
                id="founder" 
                className="py-16"
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
            >
                <MotionDiv variants={itemVariants}>
                    <ParallaxCard className="max-w-4xl mx-auto p-8 md:p-12 flex flex-col md:flex-row items-center gap-12 border border-white/10 bg-[#0c0c0c]">
                        <div className="flex-shrink-0 w-32 h-32 rounded-full bg-gradient-to-b from-gray-800 to-black flex items-center justify-center text-4xl font-black text-white border border-white/10 shadow-2xl">AJ</div>
                        <div className="text-center md:text-left flex-grow">
                            <h4 className="text-3xl font-bold text-white mb-1">Aditya Jain</h4>
                            <p className="text-sm font-mono text-amber-500 uppercase tracking-wider mb-6">Founder & Chief Architect</p>
                            <p className="text-gray-400 leading-relaxed text-sm mb-6">
                                Aditya is the driving force behind Aikon Studios, combining a profound passion for <strong>coding and AI</strong> with a strong inclination towards <strong>Sanatana Dharma</strong>. His vision is to fuse these worlds, creating ethical, highly intelligent systems.
                            </p>
                            <div className="pt-6 border-t border-white/5 w-full">
                                <div className="text-base text-white italic mb-4 min-h-[40px] font-serif">
                                    {founderQuote ? `"${founderQuote}"` : ''}
                                </div>
                                <div className="flex justify-center md:justify-start">
                                    <MotionButton 
                                        onClick={handleGenerateQuote} 
                                        disabled={isLoadingQuote} 
                                        className="text-xs text-gray-500 hover:text-white flex items-center gap-2 transition-colors"
                                        whileHover={{ x: 2 }}
                                    >
                                        {isLoadingQuote ? <LoadingIcon /> : <span>✨</span>}
                                        <span>{isLoadingQuote ? 'Generating...' : 'Generate Quote'}</span>
                                    </MotionButton>
                                </div>
                            </div>
                        </div>
                    </ParallaxCard>
                </MotionDiv>
            </MotionSection>
            
             <MotionSection
                id="contact"
                className="py-16"
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
            >
                <MotionH3 variants={itemVariants} className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] text-center mb-12">Contact Us</MotionH3>
                <MotionDiv variants={itemVariants}>
                    <ParallaxCard className="max-w-2xl mx-auto p-8 md:p-12 border border-white/10 shadow-2xl">
                        <h4 className="text-2xl font-bold text-white mb-2 text-center">Start a Conversation</h4>
                        <p className="text-sm text-gray-500 mb-8 text-center">We're ready to build the extraordinary.</p>
                        <form onSubmit={handleContactSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="name" className="sr-only">Name</label>
                                    <input
                                        type="text"
                                        id="name"
                                        name="name"
                                        placeholder="NAME"
                                        className="form-input bg-transparent border-white/10 text-xs uppercase tracking-wider placeholder-gray-600"
                                        value={contactName}
                                        onChange={(e) => setContactName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="email" className="sr-only">Email</label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        placeholder="EMAIL ADDRESS"
                                        className="form-input bg-transparent border-white/10 text-xs uppercase tracking-wider placeholder-gray-600"
                                        value={contactEmail}
                                        onChange={(e) => setContactEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="message" className="sr-only">Message</label>
                                <textarea
                                    id="message"
                                    name="message"
                                    placeholder="PROJECT DETAILS..."
                                    className="form-textarea bg-transparent border-white/10 text-sm placeholder-gray-600 font-sans"
                                    value={contactMessage}
                                    onChange={(e) => setContactMessage(e.target.value)}
                                    required
                                ></textarea>
                            </div>
                            <div className="text-center pt-2">
                                <MotionButton
                                    type="submit"
                                    disabled={isSending}
                                    className="px-12 py-3 bg-white text-black font-bold text-xs uppercase tracking-widest rounded hover:bg-gray-200 transition-all w-full md:w-auto"
                                    whileHover={{ scale: !isSending ? 1.02 : 1 }}
                                    whileTap={{ scale: !isSending ? 0.98 : 1 }}
                                >
                                    {isSending ? 'TRANSMITTING...' : 'SEND MESSAGE'}
                                </MotionButton>
                            </div>
                        </form>
                         {formStatus && (
                            <div className={`mt-6 p-3 rounded text-center text-xs font-mono ${formStatus.type === 'success' ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                                {formStatus.message}
                            </div>
                        )}
                    </ParallaxCard>
                </MotionDiv>
            </MotionSection>

        </main>
    );
};

export default HomePage;