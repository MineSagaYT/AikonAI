
import React from 'react';
import { motion } from 'framer-motion';

const Footer: React.FC = () => {
    return (
        <motion.footer 
            className="p-8 border-t border-gray-900 text-center text-gray-600 text-sm bg-black relative overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <div className="relative z-10 group inline-block">
                <p className="cursor-help transition-colors duration-300 hover:text-amber-500">
                    &copy; 2025 Aikon Studios. All rights reserved. Crafted with 💖 by Aditya Jain.
                </p>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 w-64 p-3 bg-zinc-800 rounded-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-xl border border-zinc-700">
                    Founded in 2024, Aikon Studios merges the depths of Sanatana Dharma with cutting-edge Artificial Intelligence.
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-8 border-transparent border-t-zinc-800"></div>
                </div>
            </div>
        </motion.footer>
    );
};

export default Footer;
