import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './components/pages/HomePage';
import ProjectsPage from './components/pages/ProjectsPage';
import AikonChatPage from './components/pages/AikonChatPage';
import LoginPage from './components/pages/LoginPage';
import { Page } from './types';
import { useAuth } from './context/AuthContext';
import LoadingSpinner from './components/LoadingSpinner';


const App: React.FC = () => {
    const { user, loading, isGuest, setGuest } = useAuth();
    const [activePage, setActivePage] = useState<Page>('home');
    const [isExiting, setIsExiting] = useState<boolean>(false);
    const [pageToRender, setPageToRender] = useState<Page>('home');

    const navigateTo = useCallback((page: Page) => {
        if (page === pageToRender) return;
        if(activePage !== 'chat' && page !== 'chat') {
            setIsExiting(true);
            setTimeout(() => {
                setActivePage(page);
                setPageToRender(page);
                setIsExiting(false);
                window.scrollTo(0, 0);
            }, 350);
        } else {
             setActivePage(page);
             setPageToRender(page);
        }
    }, [pageToRender, activePage]);
    
    useEffect(() => {
        document.body.classList.add('dark-theme-body');
    }, []);

    useEffect(() => {
        if (!isExiting) {
            setPageToRender(activePage);
        }
    }, [activePage, isExiting]);
    
    if (loading) {
        return <LoadingSpinner />;
    }

    if (!user && !isGuest) {
        return <LoginPage onGuestLogin={() => setGuest(true)} />;
    }
    
    if (pageToRender === 'chat') {
        return <AikonChatPage navigateTo={navigateTo} />;
    }


    const renderPage = () => {
        switch (pageToRender) {
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
                 <div className={`page-view flex-grow flex flex-col ${isExiting ? 'page-exit-active' : ''}`}>
                    {renderPage()}
                </div>
            </div>
            <Footer />
        </div>
    );
};


export default App;