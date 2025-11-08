
import React from 'react';
import { Page, NavigationProps } from '../types';

interface HeaderProps extends NavigationProps {
    activePage: Page;
}

const Header: React.FC<HeaderProps> = ({ navigateTo, activePage }) => {
    const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, page: Page) => {
        e.preventDefault();
        navigateTo(page);
    };

    return (
        <header className="p-4 md:p-6 shadow-2xl sticky top-0 z-20 bg-black border-b border-gray-800 w-full animate-slide-in-down">
            <div className="flex justify-between items-center mx-auto max-w-7xl">
                <a href="#" onClick={(e) => handleNavigation(e, 'home')} className="flex items-center space-x-2 cursor-pointer">
                    <img 
                        src="/fetch/file/uploaded:Gemini_Generated_Image_5g4oit5g4oit5g4o.jpg-061ec57d-1239-4e36-910a-030c8a2e32e5" 
                        alt="Aikon Studios Logo" 
                        className="h-10 w-auto object-contain rounded-lg shadow-md"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null; 
                            target.src='https://placehold.co/100x40/FFC107/111111?text=AIKON';
                        }}
                    />
                    <h1 className="text-3xl font-extrabold hero-gradient hidden sm:block">Aikon Studios</h1>
                </a>

                 <nav className="flex items-center space-x-6 font-medium">
                     <a href="#" onClick={(e) => handleNavigation(e, 'home')} className={`text-gray-400 hover:text-amber-400 transition-colors duration-300 tracking-wider ${activePage === 'home' ? 'text-amber-400' : ''}`}>HOME</a>
                     <a href="#" onClick={(e) => handleNavigation(e, 'projects')} className={`text-gray-400 hover:text-amber-400 transition-colors duration-300 tracking-wider ${activePage === 'projects' ? 'text-amber-400' : ''}`}>PROJECTS</a>
                     <a href="#" onClick={(e) => handleNavigation(e, 'chat')} className={`px-4 py-2 text-sm bg-gray-800 text-amber-400 rounded-xl hover:bg-gray-700 transition-colors duration-200 shadow-md ${activePage === 'chat' ? 'ring-2 ring-amber-500' : ''}`}>
                        AIKONAI
                    </a>
                </nav>
            </div>
        </header>
    );
};

export default Header;