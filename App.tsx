
import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import AikonChatPage from './components/pages/AikonChatPage';
import { useAuth } from './context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';

const MotionDiv = motion.div as any;

const App: React.FC = () => {
    const { currentUser } = useAuth();
    const [showChat, setShowChat] = useState(false);

    // Function to transition from Landing Page to Chat
    const handleLaunchApp = () => {
        setShowChat(true);
    };

    return (
        <div className="relative w-full h-full font-sans">
            <AnimatePresence mode="wait">
                {!showChat ? (
                    <MotionDiv
                        key="landing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, y: -50 }}
                        transition={{ duration: 0.5 }}
                    >
                        <LandingPage onStart={handleLaunchApp} />
                    </MotionDiv>
                ) : (
                    <MotionDiv
                        key="chat"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, ease: "circOut" }}
                        className="fixed inset-0 bg-white"
                    >
                        <AikonChatPage navigateTo={() => setShowChat(false)} />
                    </MotionDiv>
                )}
            </AnimatePresence>
        </div>
    );
};

export default App;