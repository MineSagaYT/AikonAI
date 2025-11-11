
import React from 'react';
import { motion } from 'framer-motion';

const Footer: React.FC = () => {
    return (
        <motion.footer 
            className="p-8 border-t border-gray-900 text-center text-gray-600 text-sm bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <p>&copy; 2025 Aikon Studios. All rights reserved. Crafted with 💖 by Aditya Jain.</p>
        </motion.footer>
    );
};

export default Footer;