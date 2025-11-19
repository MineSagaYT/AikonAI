

import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface ParallaxCardProps {
    children: ReactNode;
    depth?: number;
    className?: string;
    style?: React.CSSProperties;
}

const ParallaxCard: React.FC<ParallaxCardProps> = ({ children, className = '', style }) => {
    return (
        <motion.div
            className={`card-bg rounded-3xl transition-all duration-500 ${className}`}
            style={style}
            whileHover={{ scale: 1.02 }}
        >
            {children}
        </motion.div>
    );
};

export default ParallaxCard;