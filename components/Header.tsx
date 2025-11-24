
import React, { useState, useEffect } from 'react';
import { Page, NavigationProps } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
// REMOVED: import longLogo from '../long_logo.jpeg';

const MotionPath = motion.path as any;
const MotionHeader = motion.header as any;
const MotionA = motion.a as any;
const MotionButton = motion.button as any;
const MotionDiv = motion.div as any;

// Hamburger Icon Component
const HamburgerIcon = ({ open, ...props }: { open: boolean } & React.ComponentPropsWithoutRef<'svg'>) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <MotionPath
            d="M3 12H21"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            variants={{
                closed: { d: "M3 12H21" },
                open: { d: "M5 19L19 5" }
            }}
            initial="closed"
            animate={open ? "open" : "closed"}
            transition={{ duration: 0.3 }}
        />
        <MotionPath
            d="M3 6H21"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            variants={{
                closed: { opacity: 1, y: 0 },
                open: { opacity: 0, y: 6 }
            }}
            initial="closed"
            animate={open ? "open" : "closed"}
            transition={{ duration: 0.3 }}
        />
        <MotionPath
            d="M3 18H21"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
             variants={{
                closed: { d: "M3 18H21" },
                open: { d: "M5 5L19 19" }
            }}
            initial="closed"
            animate={open ? "open" : "closed"}
            transition={{ duration: 0.3 }}
        />
    </svg>
);


interface HeaderProps extends NavigationProps {
    activePage: Page;
}

const Header: React.FC<HeaderProps> = ({ navigateTo, activePage }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, page: Page) => {
        e.preventDefault();
        navigateTo(page);
        setIsMobileMenuOpen(false); // Close mobile menu on navigation
    };

    const navItems = [
        { page: 'home', label: 'HOME' },
        { page: 'projects', label: 'PROJECTS' },
        { page: 'faq', label: 'FAQ' },
        { page: 'chat', label: 'AIKON STUDIO', isButton: true },
    ];
    
    const mobileMenuVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
    };
    
    const mobileLinkVariants = {
        hidden: { opacity: 0, y: -20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <MotionHeader 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="fixed top-0 z-50 w-full px-4 md:px-6 py-3 bg-black/80 backdrop-blur-md border-b border-white/10 shadow-lg"
        >
            <div className="flex justify-between items-center mx-auto max-w-7xl h-12">
                <MotionA 
                    href="#" 
                    onClick={(e: React.MouseEvent<HTMLAnchorElement>) => handleNavigation(e, 'home')} 
                    className="flex items-center space-x-3 cursor-pointer group"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <img 
                        src="/long_logo.jpeg" 
                        alt="Aikon Studios Logo" 
                        className="h-8 w-auto object-contain rounded shadow-sm group-hover:shadow-md transition-all"
                    />
                    <span className="text-lg font-bold text-white tracking-tight hidden sm:block">Aikon Studios</span>
                </MotionA>

                 {/* Desktop Nav */}
                 <nav className="hidden md:flex items-center space-x-8 font-medium text-sm">
                     <MotionA href="#" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => handleNavigation(e, 'home')} className={`transition-colors duration-200 ${activePage === 'home' ? 'text-amber-400' : 'text-gray-400 hover:text-white'}`} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>HOME</MotionA>
                     <MotionA href="#" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => handleNavigation(e, 'projects')} className={`transition-colors duration-200 ${activePage === 'projects' ? 'text-amber-400' : 'text-gray-400 hover:text-white'}`} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>PROJECTS</MotionA>
                     <MotionA href="#" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => handleNavigation(e, 'faq')} className={`transition-colors duration-200 ${activePage === 'faq' ? 'text-amber-400' : 'text-gray-400 hover:text-white'}`} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>FAQ</MotionA>
                     <div className="h-5 w-px bg-gray-700 mx-2"></div>
                     <MotionA 
                        href="#" 
                        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => handleNavigation(e, 'chat')} 
                        className={`px-5 py-2 text-xs font-bold bg-white/10 text-white rounded hover:bg-white/20 transition-colors duration-200 border border-white/10 ${activePage === 'chat' ? 'ring-1 ring-amber-500/50 bg-amber-500/10 text-amber-400' : ''}`} 
                        whileHover={{ scale: 1.05 }} 
                        whileTap={{ scale: 0.95 }}
                    >
                        AIKON STUDIO
                    </MotionA>
                </nav>
                
                {/* Mobile Nav Button */}
                <div className="md:hidden z-50">
                     <MotionButton 
                        className="text-white p-2"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        whileTap={{ scale: 0.9 }}
                        aria-label="Toggle navigation menu"
                    >
                        <HamburgerIcon open={isMobileMenuOpen} />
                    </MotionButton>
                </div>
            </div>

             {/* Mobile Nav Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <MotionDiv
                        className="fixed inset-0 bg-black/95 z-40 flex flex-col items-center justify-center gap-10 text-xl font-bold backdrop-blur-xl"
                        variants={mobileMenuVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                    >
                        {navItems.map(item => (
                             <MotionA
                                key={item.page}
                                href="#"
                                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => handleNavigation(e, item.page as Page)}
                                className={`${activePage === item.page ? 'text-amber-400' : 'text-white'} tracking-widest uppercase`}
                                variants={mobileLinkVariants}
                                whileTap={{ scale: 0.9 }}
                            >
                                {item.label}
                            </MotionA>
                        ))}
                    </MotionDiv>
                )}
            </AnimatePresence>
        </MotionHeader>
    );
};

export default Header;