
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { motion } from 'framer-motion';

// --- Icon Components ---
const PersonalizationIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);
const DataIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7l8-4 8 4m-8 12v4m0 0l-4-4m4 4l4-4" /></svg>);

type SettingsTab = 'Personalization' | 'Data Controls';

const SettingsItem: React.FC<{title: string; description?: string; children: React.ReactNode;}> = ({ title, description, children }) => (
    <div className="settings-item flex flex-col md:flex-row md:justify-between md:items-start py-4 border-b border-zinc-700/50 last:border-b-0">
        <div className="settings-item-label mb-3 md:mb-0 md:mr-6">
            <h3 className="font-semibold text-white">{title}</h3>
            {description && <p>{description}</p>}
        </div>
        <div className="settings-item-control flex-shrink-0 w-full md:w-auto">
            {children}
        </div>
    </div>
);


interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: Partial<UserProfile> | null;
    onSave: (settings: Partial<UserProfile>) => void;
    onDeleteAllChats: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, profile, onSave, onDeleteAllChats }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('Personalization');
    const [customInstructions, setCustomInstructions] = useState('');
    const [aboutYou, setAboutYou] = useState('');

    useEffect(() => {
        if (isOpen && profile) {
            setCustomInstructions(profile.customInstructions || '');
            setAboutYou(profile.aboutYou || '');
        }
    }, [isOpen, profile]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave({ customInstructions, aboutYou });
    };

    const renderContent = () => {
        switch(activeTab) {
            case 'Personalization':
                 return (
                    <div className="settings-section">
                        <h2 className="sr-only">Personalization</h2>
                        <SettingsItem title="Custom Instructions" description="Tell AikonAI about yourself and how you want it to respond.">
                            <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="e.g., I am a senior software developer..." className="form-input" />
                        </SettingsItem>
                        <SettingsItem title="How should AikonAI address you?" description="e.g., Please call me Adi.">
                             <input type="text" value={aboutYou} onChange={(e) => setAboutYou(e.target.value)} placeholder="e.g., Adi" className="form-input" />
                        </SettingsItem>
                    </div>
                );
            case 'Data Controls':
                return (
                     <div className="settings-section">
                        <h2 className="sr-only">Data Controls</h2>
                        <SettingsItem title="Clear current chat" description="Permanently clear all messages from your current session. This cannot be undone.">
                            <motion.button 
                                className="danger" 
                                onClick={onDeleteAllChats}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Clear chat
                            </motion.button>
                        </SettingsItem>
                    </div>
                );
        }
    }

    const NavItem: React.FC<{tabName: SettingsTab; icon: React.ReactNode; children: React.ReactNode;}> = ({ tabName, icon, children }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`settings-nav-item ${activeTab === tabName ? 'active' : ''}`}
        >
            {icon} <span>{children}</span>
            {activeTab === tabName && (
                <motion.div className="active-nav-indicator" layoutId="activeSettingsTab" />
            )}
        </button>
    );

    return (
        <motion.div 
            className="modal-backdrop" 
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div 
                className="settings-modal-content modal-content" 
                onClick={(e) => e.stopPropagation()}
                initial={{ y: 20, scale: 0.95 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 20, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
                <nav className="settings-nav">
                    <NavItem tabName="Personalization" icon={<PersonalizationIcon />}>Personalization</NavItem>
                    <NavItem tabName="Data Controls" icon={<DataIcon />}>Data</NavItem>
                </nav>
                <div className="settings-content">
                    {renderContent()}
                </div>
                 <div className="settings-footer modal-footer">
                    <motion.button onClick={onClose} className="secondary" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Cancel</motion.button>
                    <motion.button onClick={handleSave} className="primary" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Save Changes</motion.button>
                </div>
                <motion.button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold" whileTap={{ scale: 0.9 }}>&times;</motion.button>
            </motion.div>
        </motion.div>
    );
};

export default SettingsModal;