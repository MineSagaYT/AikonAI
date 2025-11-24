
import React from 'react';
import { motion } from 'framer-motion';

const MotionFooter = motion.footer as any;

const Footer: React.FC = () => {
    return (
        <MotionFooter 
            className="p-8 border-t border-white/5 text-center text-gray-600 text-xs bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <div className="relative z-10 group inline-block">
                <p className="cursor-help hover:text-gray-400 transition-colors font-mono uppercase tracking-wider">
                    &copy; 2025 Aikon Studios
                </p>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-4 w-64 p-4 bg-zinc-900 rounded border border-white/10 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-2xl z-50">
                    <p className="mb-2 font-bold text-white">The Origin</p>
                    Founded in 2024 by Aditya Jain, merging Sanatana Dharma with advanced AI.
                </div>
            </div>
        </MotionFooter>
    );
};

export default Footer;