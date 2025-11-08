
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';

// --- Icon Components ---
const PersonalizationIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);
const DataIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7l8-4 8 4m-8 12v4m0 0l-4-4m4 4l4-4" /></svg>);

type SettingsTab = 'Personalization' | 'Data Controls';

const SettingsItem: React.FC<{title: string; description?: string; children: React.ReactNode; isRow?: boolean;}> = ({ title, description, children, isRow=false }) => (
    <div className="settings-item">
        <div className={isRow ? 'settings-item-row' : ''}>
            <div className="settings-item-label">
                <h3>{title}</h3>
                {description && <p>{description}</p>}
            </div>
            <div className={`settings-item-control ${isRow ? 'flex-shrink-0' : 'mt-4'}`}>
                {children}
            </div>
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
                        <h2>Personalization</h2>
                        <SettingsItem title="Custom Instructions" description="Tell AikonAI about yourself and how you want it to respond. It will remember this for the current session.">
                            <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="e.g., I am a senior software developer. Always provide code examples in TypeScript. My tone should be professional but friendly." />
                        </SettingsItem>
                        <SettingsItem title="How would you like AikonAI to address you?" description="This helps AikonAI personalize its responses to you.">
                             <textarea value={aboutYou} onChange={(e) => setAboutYou(e.target.value)} placeholder="e.g., Please call me Adi. I'm based in New Delhi." />
                        </SettingsItem>
                    </div>
                );
            case 'Data Controls':
                return (
                     <div className="settings-section">
                        <h2>Data Controls</h2>
                        <SettingsItem title="Clear current chat" description="Permanently clear all messages from your current session. This cannot be undone.">
                            <button className="danger" onClick={onDeleteAllChats}>Clear chat</button>
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
            {icon} {children}
        </button>
    );

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="settings-modal-content" onClick={(e) => e.stopPropagation()}>
                <nav className="settings-nav">
                    <NavItem tabName="Personalization" icon={<PersonalizationIcon />}>Personalization</NavItem>
                    <NavItem tabName="Data Controls" icon={<DataIcon />}>Data Controls</NavItem>
                </nav>
                <div className="settings-content">
                    {renderContent()}
                </div>
                 <div className="settings-footer">
                    <button onClick={onClose} className="bg-gray-700 text-white font-semibold">Cancel</button>
                    <button onClick={handleSave} className="bg-amber-500 text-black font-semibold">Save Changes</button>
                </div>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
            </div>
        </div>
    );
};

export default SettingsModal;