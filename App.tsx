
import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import LandingPage from './components/LandingPage';
import AikonChatPage from './components/pages/AikonChatPage';
import { AnimatePresence, motion } from 'framer-motion';

const App: React.FC = () => {
    const [view, setView] = useState<'landing' | 'chat'>('landing');
    const { login } = useAuth();

    useEffect(() => {
        // Auto-login guest for immediate access
        login('Guest', '0000');
    }, []);

    const switchView = (newView: 'landing' | 'chat') => {
        setView(newView);
        window.scrollTo(0, 0);
    };

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
