
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './components/pages/HomePage';
import ProjectsPage from './components/pages/ProjectsPage';
import AikonChatPage from './components/pages/AikonChatPage';
import LoginPage from './components/pages/LoginPage';
import FAQPage from './components/pages/FAQPage';
import AikonDesignerPage from './components/pages/AikonDesignerPage';
import { Page } from './types';
import { useAuth } from './context/AuthContext';
import LoadingSpinner from './components/LoadingSpinner';
import { AnimatePresence, motion } from 'framer-motion';

const App: React.FC = () => {
    const { currentUser, loading } = useAuth();
    const [activePage, setActivePage] = useState<Page>('home');

    const navigateTo = useCallback((page: Page) => {
        setActivePage(page);
        window.scrollTo(0, 0);
    }, []);
    
    useEffect(() => {
        document.body.classList.add('dark-theme-body');
    }, []);
    
    if (loading) {
        return <LoadingSpinner />;
    }

    if (!currentUser) {
        return <LoginPage />;
    }
    
    // Special full-screen pages that don't use standard layout
    if (activePage === 'chat') {
        return <AikonChatPage navigateTo={navigateTo} />;
    }
    if (activePage === 'designer') {
        return <AikonDesignerPage navigateTo={navigateTo} />;
    }

    const renderPage = () => {
        switch (activePage) {
            case 'home':
                return <HomePage navigateTo={navigateTo} />;
            case 'projects':
                return <ProjectsPage navigateTo={navigateTo} />;
            case 'faq':
                return <FAQPage navigateTo={navigateTo} />;
            default:
                return <HomePage navigateTo={navigateTo} />;
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <div className="ai-core-bg"></div>
            <Header navigateTo={navigateTo} activePage={activePage} />
            <div id="app-container" className="flex-grow flex flex-col">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activePage}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 25 }}
                        className="flex-grow flex flex-col w-full"
                    >
                        {renderPage()}
                    </motion.div>
                </AnimatePresence>
            </div>
            <Footer />
        </div>
    );
};


export default App;
