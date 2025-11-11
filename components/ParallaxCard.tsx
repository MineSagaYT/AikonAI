
import React, { useRef, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface ParallaxCardProps {
    children: ReactNode;
    depth?: number;
    className?: string;
    style?: React.CSSProperties;
}

const ParallaxCard: React.FC<ParallaxCardProps> = ({ children, depth = 10, className = '', style }) => {
    const cardRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const card = cardRef.current;
        const rect = card.getBoundingClientRect();
        
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const offsetX = e.clientX - centerX;
        const offsetY = e.clientY - centerY;
        
        const rotateX = -offsetY / depth;
        const rotateY = offsetX / depth;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        card.style.transition = 'transform 0.1s ease-out';
    };

    const handleMouseLeave = () => {
        if (!cardRef.current) return;
        cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
        cardRef.current.style.transition = 'transform 0.4s ease-out';
    };

    return (
        <motion.div
            ref={cardRef}
            className={`card-bg rounded-3xl transition-all duration-500 ${className}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={style}
            whileHover={{ scale: 1.02 }}
        >
            {children}
        </motion.div>
    );
};

export default ParallaxCard;