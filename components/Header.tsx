// FIX: Corrected import syntax for React hooks.
import React, { useState } from 'react';
import { Page, NavigationProps } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
// REMOVED: import longLogo from '../long_logo.jpeg';

// Hamburger Icon Component
const HamburgerIcon = ({ open, ...props }: { open: boolean } & React.ComponentPropsWithoutRef<'svg'>) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <motion.path
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
        <motion.path
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
        <motion.path
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
        { page: 'chat', label: 'AIKONAI', isButton: true },
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
        <motion.header 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="p-4 md:p-6 shadow-2xl sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-gray-800 w-full"
        >
            <div className="flex justify-between items-center mx-auto max-w-7xl">
                <motion.a 
                    href="#" 
                    onClick={(e) => handleNavigation(e, 'home')} 
                    className="flex items-center space-x-2 cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <img 
                        src="/long_logo.jpeg" 
                        alt="Aikon Studios Logo" 
                        className="h-10 w-auto object-contain rounded-lg shadow-md"
                    />
                    <h1 className="text-3xl font-extrabold hero-gradient hidden sm:block">Aikon Studios</h1>
                </motion.a>

                 {/* Desktop Nav */}
                 <nav className="hidden md:flex items-center space-x-6 font-medium">
                     <motion.a href="#" onClick={(e) => handleNavigation(e, 'home')} className={`text-gray-400 transition-colors duration-300 tracking-wider ${activePage === 'home' ? 'text-amber-400' : ''}`} whileHover={{ scale: 1.1, color: '#FFC107' }} whileTap={{ scale: 0.9 }}>HOME</motion.a>
                     <motion.a href="#" onClick={(e) => handleNavigation(e, 'projects')} className={`text-gray-400 transition-colors duration-300 tracking-wider ${activePage === 'projects' ? 'text-amber-400' : ''}`} whileHover={{ scale: 1.1, color: '#FFC107' }} whileTap={{ scale: 0.9 }}>PROJECTS</motion.a>
                     <motion.a href="#" onClick={(e) => handleNavigation(e, 'faq')} className={`text-gray-400 transition-colors duration-300 tracking-wider ${activePage === 'faq' ? 'text-amber-400' : ''}`} whileHover={{ scale: 1.1, color: '#FFC107' }} whileTap={{ scale: 0.9 }}>FAQ</motion.a>
                     <motion.a href="#" onClick={(e) => handleNavigation(e, 'chat')} className={`px-4 py-2 text-sm bg-gray-800 text-amber-400 rounded-xl hover:bg-gray-700 transition-colors duration-200 shadow-md ${activePage === 'chat' ? 'ring-2 ring-amber-500' : ''}`} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        AIKONAI
                    </motion.a>
                </nav>
                
                {/* Mobile Nav Button */}
                <div className="md:hidden z-50">
                     <motion.button 
                        className="text-white p-2"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        whileTap={{ scale: 0.85 }}
                        aria-label="Toggle navigation menu"
                    >
                        <HamburgerIcon open={isMobileMenuOpen} />
                    </motion.button>
                </div>
            </div>

             {/* Mobile Nav Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        className="mobile-nav-overlay"
                        variants={mobileMenuVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                    >
                        {navItems.map(item => (
                             <motion.a
                                key={item.page}
                                href="#"
                                onClick={(e) => handleNavigation(e, item.page as Page)}
                                className={activePage === item.page ? 'active' : ''}
                                variants={mobileLinkVariants}
                            >
                                {item.label}
                            </motion.a>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header>
    );
};

export default Header;