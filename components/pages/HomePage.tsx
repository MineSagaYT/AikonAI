import React, { useState } from 'react';
import { NavigationProps } from '../../types';
import { generateSimpleText, sendContactMessage } from '../../services/geminiService';
import ParallaxCard from '../ParallaxCard';
import { motion, Variants } from 'framer-motion';

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
                staggerChildren: 0.3,
                delayChildren: 0.1,
            }
        }
    };

    const itemVariants: Variants = {
        hidden: { y: 30, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: "spring", stiffness: 120, damping: 15 }
        }
    };

    return (
        <main className="max-w-7xl mx-auto p-4 md:p-8 relative z-10">
            <motion.section 
                id="top" 
                className="text-center py-20 md:py-32"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <div className="space-y-6">
                    <motion.h2 variants={itemVariants} className="text-5xl md:text-8xl font-black leading-tight tracking-tighter">
                        Crafting the Future with <span className="hero-gradient">Intelligent Design</span>
                    </motion.h2>
                    <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-400 max-w-4xl mx-auto pt-4">
                        Aikon Studios is where passion meets precision in the world of Artificial Intelligence, delivering <strong>ethical and impactful</strong> next-generation technology solutions.
                    </motion.p>
                    <motion.div variants={itemVariants} className="pt-10">
                         <motion.button 
                            onClick={() => navigateTo('projects')} 
                            className="px-10 py-4 text-black font-bold text-lg rounded-xl shadow-lg cta-button-animated tracking-wider"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                         >
                            EXPLORE OUR PROJECTS →
                        </motion.button>
                    </motion.div>
                </div>
            </motion.section>

            <motion.section 
                id="mission" 
                className="py-16 md:py-24"
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
            >
                <motion.h3 variants={itemVariants} className="text-4xl font-bold text-center mb-16 hero-gradient tracking-wide">OUR MISSION & EXPERTISE</motion.h3>
                <div className="grid md:grid-cols-3 gap-8">
                    <motion.div variants={itemVariants}>
                        <ParallaxCard depth={6} className="p-8 border-t-4 border-amber-600/50 hover:shadow-[0_0_40px_rgba(255,193,7,0.5)] h-full">
                            <div className="text-5xl mb-4 text-amber-400">🧠</div>
                            <h4 className="text-2xl font-semibold mb-3 text-white">Advanced AI Development</h4>
                            <p className="text-gray-400">From conversational agents like <strong>AikonAI</strong> to complex reasoning engines, we build sophisticated, custom-trained large language models tailored for unique challenges.</p>
                        </ParallaxCard>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <ParallaxCard depth={6} className="p-8 border-t-4 border-white/50 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] h-full">
                            <div className="text-5xl mb-4 text-white">💻</div>
                            <h4 className="text-2xl font-semibold mb-3 text-white">Full-Stack Software</h4>
                            <p className="text-gray-400">Developing robust, scalable web applications and systems, focusing on clean code, performance, and exceptional, modern user experience.</p>
                        </ParallaxCard>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <ParallaxCard depth={6} className="p-8 border-t-4 border-amber-500/50 hover:shadow-[0_0_40px_rgba(255,193,7,0.5)] h-full">
                            <div>
                                <div className="text-5xl mb-4 text-amber-400">✨</div>
                                <h4 className="text-2xl font-semibold mb-3 text-white">Innovation with Purpose</h4>
                                <p className="text-gray-400 mb-4" dangerouslySetInnerHTML={{ __html: missionStatement.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                            </div>
                        </ParallaxCard>
                    </motion.div>
                </div>
            </motion.section>

            <motion.section 
                id="founder" 
                className="py-16 md:py-24"
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
            >
                <motion.h3 variants={itemVariants} className="text-4xl font-bold text-center mb-16 hero-gradient tracking-wide">THE FOUNDER'S VISION</motion.h3>
                <motion.div variants={itemVariants}>
                    <ParallaxCard depth={3} className="max-w-5xl mx-auto p-8 md:p-16 flex flex-col lg:flex-row items-center space-y-8 lg:space-y-0 lg:space-x-12 ai-glow-border shadow-2xl shadow-gray-900">
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
                                    <motion.button 
                                        onClick={handleGenerateQuote} 
                                        disabled={isLoadingQuote} 
                                        className="px-6 py-2 text-sm bg-gray-800 text-amber-400 rounded-xl hover:bg-gray-700 transition-colors duration-200 shadow-md flex items-center space-x-2 disabled:opacity-50"
                                        whileHover={{ scale: !isLoadingQuote ? 1.1 : 1 }}
                                        whileTap={{ scale: !isLoadingQuote ? 0.9 : 1 }}
                                    >
                                        {isLoadingQuote ? <LoadingIcon /> : <span>✨</span>}
                                        <span>{isLoadingQuote ? 'Generating...' : 'Visionary Quote Generator'}</span>
                                    </motion.button>
                                </div>
                            </div>
                        </div>
                    </ParallaxCard>
                </motion.div>
            </motion.section>

             <motion.section
                id="contact"
                className="py-16 md:py-24"
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
            >
                <motion.h3 variants={itemVariants} className="text-4xl font-bold text-center mb-16 hero-gradient tracking-wide">GET IN TOUCH</motion.h3>
                <motion.div variants={itemVariants}>
                    <ParallaxCard depth={3} className="max-w-3xl mx-auto p-8 md:p-12 ai-glow-border shadow-2xl shadow-gray-900">
                        <h4 className="text-3xl font-bold text-white mb-2 text-center">Have a project in mind?</h4>
                        <p className="text-gray-400 mb-8 text-center">Let's build the future together. Drop us a line.</p>
                        <form onSubmit={handleContactSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="name" className="sr-only">Name</label>
                                    <input
                                        type="text"
                                        id="name"
                                        name="name"
                                        placeholder="Your Name"
                                        className="form-input"
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
                                        placeholder="Your Email Address"
                                        className="form-input"
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
                                    placeholder="Tell us about your project or idea..."
                                    className="form-textarea"
                                    value={contactMessage}
                                    onChange={(e) => setContactMessage(e.target.value)}
                                    required
                                ></textarea>
                            </div>
                            <div className="text-center">
                                <motion.button
                                    type="submit"
                                    disabled={isSending}
                                    className="px-10 py-4 text-black font-bold text-lg rounded-xl shadow-lg cta-button-animated tracking-wider w-full md:w-auto flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                                    whileHover={{ scale: !isSending ? 1.05 : 1 }}
                                    whileTap={{ scale: !isSending ? 0.95 : 1 }}
                                >
                                    {isSending ? <LoadingIcon /> : null}
                                    <span>{isSending ? 'Sending...' : 'Send Message'}</span>
                                </motion.button>
                            </div>
                        </form>
                         {formStatus && (
                            <div className={`mt-6 p-4 rounded-lg text-center ${formStatus.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                                {formStatus.message}
                            </div>
                        )}
                    </ParallaxCard>
                </motion.div>
            </motion.section>

        </main>
    );
};

export default HomePage;
