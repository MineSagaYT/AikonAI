import React, { useState, useEffect } from 'react';
import { UserProfile, Persona } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

// --- Icon Components ---
const PersonalizationIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);
const DataIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7l8-4 8 4m-8 12v4m0 0l-4-4m4 4l4-4" /></svg>);
const PersonaIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>);

type SettingsTab = 'Personalization' | 'Personas' | 'Data Controls';

const MotionDiv = motion.div as any;
const MotionButton = motion.button as any;

const SettingsItem: React.FC<{title: string; description?: string; children: React.ReactNode;}> = ({ title, description, children }) => (
    <div className="settings-item flex flex-col md:flex-row md:justify-between md:items-start py-4 border-b border-slate-200 last:border-b-0">
        <div className="settings-item-label mb-3 md:mb-0 md:mr-6">
            <h3 className="font-semibold text-slate-800">{title}</h3>
            {description && <p className="text-slate-500 text-sm">{description}</p>}
        </div>
        <div className="settings-item-control flex-shrink-0 w-full md:w-auto">
            {children}
        </div>
    </div>
);

const NavItem: React.FC<{
    tabName: SettingsTab; 
    icon: React.ReactNode; 
    children: React.ReactNode; 
    activeTab: SettingsTab; 
    onClick: (tabName: SettingsTab) => void;
}> = ({ tabName, icon, children, activeTab, onClick }) => (
    <button
        onClick={() => onClick(tabName)}
        className={`settings-nav-item ${activeTab === tabName ? 'active text-brand-600 bg-brand-50' : 'text-slate-500 hover:bg-slate-50'}`}
    >
        {icon} <span>{children}</span>
        {activeTab === tabName && (
            <MotionDiv className="active-nav-indicator bg-brand-600" layoutId="activeSettingsTab" />
        )}
    </button>
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
    
    // Persona Management State
    const [customPersonas, setCustomPersonas] = useState<Persona[]>([]);
    const [newPersonaName, setNewPersonaName] = useState('');
    const [newPersonaIcon, setNewPersonaIcon] = useState('🤖');
    const [newPersonaDesc, setNewPersonaDesc] = useState('');
    const [newPersonaInstruct, setNewPersonaInstruct] = useState('');
    const [isAddingPersona, setIsAddingPersona] = useState(false);

    useEffect(() => {
        if (isOpen && profile) {
            setCustomInstructions(profile.customInstructions || '');
            setAboutYou(profile.aboutYou || '');
            setCustomPersonas(profile.customPersonas || []);
        }
    }, [isOpen, profile]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave({ 
            customInstructions, 
            aboutYou,
            customPersonas // Save the updated list of personas
        });
    };

    const handleAddPersona = () => {
        if (!newPersonaName.trim() || !newPersonaInstruct.trim()) return;
        
        const newPersona: Persona = {
            name: newPersonaName.trim(),
            icon: newPersonaIcon.trim() || '🤖',
            description: newPersonaDesc.trim() || 'A custom AI assistant.',
            systemInstruction: newPersonaInstruct.trim(),
            isCustom: true
        };
        
        setCustomPersonas([...customPersonas, newPersona]);
        
        // Reset form
        setNewPersonaName('');
        setNewPersonaIcon('🤖');
        setNewPersonaDesc('');
        setNewPersonaInstruct('');
        setIsAddingPersona(false);
    };

    const handleDeletePersona = (index: number) => {
        const updated = [...customPersonas];
        updated.splice(index, 1);
        setCustomPersonas(updated);
    };

    const renderContent = () => {
        switch(activeTab) {
            case 'Personalization':
                 return (
                    <div className="settings-section">
                        <h2 className="sr-only">Personalization</h2>
                        <SettingsItem title="Custom Instructions" description="Tell AikonAI about yourself and how you want it to respond.">
                            <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="e.g., I am a senior software developer..." className="form-input bg-slate-50 border-slate-200 text-slate-800" />
                        </SettingsItem>
                        <SettingsItem title="How should AikonAI address you?" description="e.g., Please call me Adi.">
                             <input type="text" value={aboutYou} onChange={(e) => setAboutYou(e.target.value)} placeholder="e.g., Adi" className="form-input bg-slate-50 border-slate-200 text-slate-800" />
                        </SettingsItem>
                    </div>
                );
            case 'Personas':
                return (
                    <div className="settings-section">
                        <h2 className="sr-only">Manage Personas</h2>
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-800">Your Custom Personas</h3>
                                <button 
                                    onClick={() => setIsAddingPersona(!isAddingPersona)}
                                    className="text-xs bg-amber-500 text-white px-3 py-1 rounded-full font-bold hover:bg-amber-600 shadow-sm"
                                >
                                    {isAddingPersona ? 'Cancel' : '+ Create New'}
                                </button>
                            </div>

                            {/* Creation Form */}
                            <AnimatePresence>
                                {isAddingPersona && (
                                    <MotionDiv 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 space-y-3"
                                    >
                                        <div className="flex gap-3">
                                            <div className="w-1/4">
                                                <label className="text-xs text-slate-500 block mb-1">Icon (Emoji)</label>
                                                <input type="text" value={newPersonaIcon} onChange={e => setNewPersonaIcon(e.target.value)} className="form-input text-center bg-white border-slate-200 text-slate-800" maxLength={2} placeholder="🤖" />
                                            </div>
                                            <div className="w-3/4">
                                                <label className="text-xs text-slate-500 block mb-1">Name</label>
                                                <input type="text" value={newPersonaName} onChange={e => setNewPersonaName(e.target.value)} className="form-input bg-white border-slate-200 text-slate-800" placeholder="e.g. Chef Bot" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 block mb-1">Short Description</label>
                                            <input type="text" value={newPersonaDesc} onChange={e => setNewPersonaDesc(e.target.value)} className="form-input bg-white border-slate-200 text-slate-800" placeholder="Helps with cooking recipes..." />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 block mb-1">System Instructions</label>
                                            <textarea 
                                                value={newPersonaInstruct} 
                                                onChange={e => setNewPersonaInstruct(e.target.value)} 
                                                className="form-input h-24 bg-white border-slate-200 text-slate-800" 
                                                placeholder="You are an expert chef. Provide detailed recipes..." 
                                            />
                                        </div>
                                        <button 
                                            onClick={handleAddPersona}
                                            disabled={!newPersonaName || !newPersonaInstruct}
                                            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50"
                                        >
                                            Add Persona
                                        </button>
                                    </MotionDiv>
                                )}
                            </AnimatePresence>

                            {/* List */}
                            {customPersonas.length === 0 ? (
                                <p className="text-slate-400 italic text-sm">No custom personas yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {customPersonas.map((persona, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{persona.icon}</span>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm">{persona.name}</h4>
                                                    <p className="text-xs text-slate-500">{persona.description}</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleDeletePersona(idx)}
                                                className="text-red-400 hover:text-red-600 p-2"
                                                title="Delete Persona"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'Data Controls':
                return (
                     <div className="settings-section">
                        <h2 className="sr-only">Data Controls</h2>
                        <SettingsItem title="Clear current chat" description="Permanently clear all messages from your current session. This cannot be undone.">
                            <MotionButton 
                                className="px-4 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg font-semibold text-sm" 
                                onClick={onDeleteAllChats}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Clear chat
                            </MotionButton>
                        </SettingsItem>
                    </div>
                );
        }
    }

    return (
        <MotionDiv 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <MotionDiv 
                className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]" 
                onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                initial={{ y: 20, scale: 0.95 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 20, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
                <div className="flex border-b border-slate-200">
                    <NavItem 
                        tabName="Personalization" 
                        icon={<PersonalizationIcon />} 
                        activeTab={activeTab} 
                        onClick={setActiveTab}
                    >
                        Personalization
                    </NavItem>
                    <NavItem 
                        tabName="Personas" 
                        icon={<PersonaIcon />} 
                        activeTab={activeTab} 
                        onClick={setActiveTab}
                    >
                        Personas
                    </NavItem>
                    <NavItem 
                        tabName="Data Controls" 
                        icon={<DataIcon />}
                        activeTab={activeTab} 
                        onClick={setActiveTab}
                    >
                        Data
                    </NavItem>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                    {renderContent()}
                </div>
                
                 <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                    <MotionButton onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-semibold" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Cancel</MotionButton>
                    <MotionButton onClick={handleSave} className="px-4 py-2 bg-brand-600 text-white hover:bg-brand-700 rounded-lg font-semibold shadow-lg shadow-brand-500/30" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Save Changes</MotionButton>
                </div>
                <MotionButton onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-2xl font-bold" whileTap={{ scale: 0.9 }}>&times;</MotionButton>
            </MotionDiv>
        </MotionDiv>
    );
};

export default SettingsModal;