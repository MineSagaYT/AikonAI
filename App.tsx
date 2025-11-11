import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './components/pages/HomePage';
import ProjectsPage from './components/pages/ProjectsPage';
import AikonChatPage from './components/pages/AikonChatPage';
import LoginPage from './components/pages/LoginPage';
import { Page } from './types';
import { useAuth } from './context/AuthContext';
import { updateUserProfile } from './services/firebase';
import LoadingSpinner from './components/LoadingSpinner';
import { AnimatePresence, motion } from 'framer-motion';

const OnboardingPage: React.FC = () => {
    const { user, refetchProfile } = useAuth();
    const [name, setName] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const canSubmit = name.trim().length > 0 && agreed && !isSaving;

    const handleSubmit = async () => {
        if (!canSubmit || !user) return;
        setIsSaving(true);
        try {
            await updateUserProfile(user.uid, {
                aboutYou: name.trim(),
                onboardingCompleted: true,
            });
            await refetchProfile();
        } catch (error) {
            console.error("Failed to save onboarding data:", error);
            setIsSaving(false);
        }
    };
    
    const containerVariants = {
        visible: { transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };


    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-black">
            <motion.div
                className="w-full max-w-lg bg-[#18181b] p-8 rounded-2xl shadow-2xl border border-[#27272a] text-center"
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            >
                <motion.h1 variants={itemVariants} className="text-3xl font-bold mb-2 text-white">One last step...</motion.h1>
                <motion.p variants={itemVariants} className="text-gray-400 mb-8">Let's get your AikonAI experience personalized.</motion.p>

                <motion.div variants={itemVariants} className="space-y-6 text-left">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">What should AikonAI call you?</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Adi"
                            className="form-input"
                        />
                    </div>

                    <div className="flex items-start">
                        <input
                            id="terms"
                            type="checkbox"
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                            className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-amber-500 focus:ring-amber-600 cursor-pointer mt-1"
                        />
                        <label htmlFor="terms" className="ml-3 text-sm text-gray-400">
                            I confirm that I am 18 years of age or older and agree to the <a href="#" className="text-amber-400 hover:underline">Terms and Conditions</a> of Aikon Studios.
                        </label>
                    </div>
                </motion.div>

                <motion.button
                    variants={itemVariants}
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="w-full mt-8 text-black font-bold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cta-button-animated"
                    whileHover={{ scale: canSubmit ? 1.05 : 1 }}
                    whileTap={{ scale: canSubmit ? 0.95 : 1 }}
                >
                    {isSaving ? 'Saving...' : "Let's Go! →"}
                </motion.button>
            </motion.div>
        </div>
    );
};


const App: React.FC = () => {
    const { user, userProfile, loading, isGuest, setGuest } = useAuth();
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

    if (!user && !isGuest) {
        return <LoginPage onGuestLogin={() => setGuest(true)} />;
    }

    if (user && userProfile && !userProfile.onboardingCompleted) {
        return <OnboardingPage />;
    }
    
    if (activePage === 'chat') {
        return <AikonChatPage navigateTo={navigateTo} />;
    }


    const renderPage = () => {
        switch (activePage) {
            case 'home':
                return <HomePage navigateTo={navigateTo} />;
            case 'projects':
                return <ProjectsPage navigateTo={navigateTo} />;
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