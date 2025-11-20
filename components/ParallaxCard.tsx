import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface ParallaxCardProps {
    children: ReactNode;
    depth?: number; // Kept for prop compatibility, but unused for 3D
    className?: string;
    style?: React.CSSProperties;
}

const ParallaxCard: React.FC<ParallaxCardProps> = ({ children, className = '', style }) => {
    return (
        <motion.div
            className={`card-bg rounded-3xl transition-all duration-300 ${className}`}
            style={style}
            whileHover={{ y: -5, scale: 1.01, boxShadow: "0 20px 40px -5px rgba(0, 0, 0, 0.6)" }}
            initial={{ y: 0 }}
        >
            {children}
        </motion.div>
    );
};

export default ParallaxCard;