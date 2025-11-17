import React, { useState } from 'react';
import { NavigationProps } from '../../types';
import { motion, AnimatePresence, Variants } from 'framer-motion';

const faqData = [
    {
        question: "What is Aikon Studios?",
        answer: "Aikon Studios is a technology company founded by Aditya Jain, specializing in advanced AI development and full-stack software solutions. We focus on creating ethical, impactful, and intelligent systems like our flagship AI, AikonAI."
    },
    {
        question: "Who is Aditya Jain?",
        answer: "Aditya Jain is the founder and chief architect of Aikon Studios. He combines his expertise in AI and software development with principles from Sanatana Dharma to guide the company's vision of creating purposeful technology."
    },
    {
        question: "What is AikonAI?",
        answer: "AikonAI is our proprietary conversational AI assistant. It's a multi-modal, culturally fluent engine capable of complex reasoning, real-time web search, image and video generation, and even autonomous task execution."
    },
    {
        question: "Is my data safe with AikonAI?",
        answer: "We take data privacy very seriously. Our systems are designed with security as a priority. The current version of our application uses a local-first authentication and data storage model, meaning your conversations are stored directly on your device, ensuring maximum privacy."
    },
    {
        question: "What technologies are used in your projects?",
        answer: "We leverage a state-of-the-art tech stack including ReactJS, TypeScript, JavaScript, HTML, Tailwind CSS and others, for the frontend. Our backend is powered by proprietary AI model, powerful capabilities like video generation and web search."
    },
    {
        question: "How can I collaborate with Aikon Studios?",
        answer: "We're always open to new ideas and collaborations. Please visit our homepage and use the 'Get In Touch' contact form to send us a message about your project or idea. We'd love to hear from you!"
    }
];

const AccordionItem: React.FC<{
    item: { question: string; answer: string };
    isOpen: boolean;
    onClick: () => void;
}> = ({ item, isOpen, onClick }) => {
    return (
        <motion.div
            layout
            className="border-b border-gray-800"
            initial={{ borderRadius: 8 }}
        >
            <motion.header
                className="flex justify-between items-center p-6 cursor-pointer"
                onClick={onClick}
                initial={false}
            >
                <h4 className="text-xl font-semibold text-white">{item.question}</h4>
                <motion.div
                    animate={{ rotate: isOpen ? 90 : 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </motion.div>
            </motion.header>
            <AnimatePresence>
                {isOpen && (
                    <motion.section
                        key="content"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{
                            opacity: 1,
                            height: 'auto',
                            transition: { duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }
                        }}
                        exit={{
                            opacity: 0,
                            height: 0,
                            transition: { duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }
                        }}
                        className="overflow-hidden"
                    >
                        <div className="px-6 pb-6 text-gray-400 text-lg leading-relaxed">
                            {item.answer}
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const FAQPage: React.FC<NavigationProps> = ({ navigateTo }) => {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    const handleToggle = (index: number) => {
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
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

    return (
        <motion.main
            className="max-w-4xl mx-auto p-4 md:p-8 relative z-10"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <section className="text-center py-16 md:py-24">
                <motion.h2 variants={itemVariants} className="text-5xl md:text-7xl font-black leading-tight tracking-tighter">
                    <span className="hero-gradient">Frequently Asked</span> Questions
                </motion.h2>
                <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-400 max-w-4xl mx-auto pt-4 mb-16">
                    Have questions? We've got answers. Here are some of the most common inquiries about Aikon Studios and our work.
                </motion.p>
            </section>

            <motion.section variants={itemVariants} className="bg-[#111111] rounded-2xl shadow-2xl ai-glow-border">
                {faqData.map((item, index) => (
                    <AccordionItem
                        key={index}
                        item={item}
                        isOpen={expandedIndex === index}
                        onClick={() => handleToggle(index)}
                    />
                ))}
            </motion.section>
            
             <motion.div variants={itemVariants} className="text-center mt-16">
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

export default FAQPage;