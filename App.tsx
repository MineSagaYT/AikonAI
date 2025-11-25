import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import LandingPage from './components/LandingPage';
import AikonChatPage from './components/pages/AikonChatPage';
import LoginPage from './components/pages/LoginPage';
import LoadingSpinner from './components/LoadingSpinner';
import { AnimatePresence, motion } from 'framer-motion';

const App: React.FC = () => {
    const [view, setView] = useState<'landing' | 'chat' | 'login'>('landing');
    const { currentUser, loading } = useAuth();

    // Automatically redirect to chat if user logs in while on login page
    useEffect(() => {
        if (currentUser && view === 'login') {
            setView('chat');
        }
    }, [currentUser, view]);

    const switchView = (newView: 'landing' | 'chat' | 'login') => {
        if (newView === 'chat' && !currentUser) {
            setView('login');
        } else {
            setView(newView);
        }
        window.scrollTo(0, 0);
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="min-h-screen w-full overflow-x-hidden bg-[#F8FAFC]">
            <AnimatePresence mode="wait">
                {view === 'landing' && (
                    <motion.div
                        key="landing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <LandingPage onStart={() => switchView('chat')} />
                    </motion.div>
                )}
                {view === 'login' && (
                    <motion.div
                        key="login"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <LoginPage />
                    </motion.div>
                )}
                {view === 'chat' && (
                    <motion.div
                        key="chat"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="h-screen w-full"
                    >
                        <AikonChatPage onBack={() => switchView('landing')} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default App;