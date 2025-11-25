import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile } from '../../services/firebase';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfilePageProps {
    onBack: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ onBack }) => {
    const { currentUser, updateCurrentUser, updateEmailAddress, resetPassword, deleteAccount, logout, connectGmail, disconnectGmail, googleAccessToken } = useAuth();
    
    // Form States
    const [displayName, setDisplayName] = useState('');
    const [aboutYou, setAboutYou] = useState('');
    const [age, setAge] = useState('');
    const [bio, setBio] = useState('');
    const [customInstructions, setCustomInstructions] = useState('');
    const [email, setEmail] = useState('');
    
    // UI States
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (currentUser) {
            setDisplayName(currentUser.displayName || '');
            setAboutYou(currentUser.aboutYou || '');
            setAge(currentUser.age || '');
            setBio(currentUser.bio || '');
            setCustomInstructions(currentUser.customInstructions || '');
            setEmail(currentUser.email || '');
            setPhotoPreview(currentUser.photoURL || null);
        }
    }, [currentUser]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result as string;
                setPhotoPreview(base64);
                // Mark as editing to prompt save
                setIsEditing(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            const updates: any = {
                displayName,
                aboutYou,
                age,
                bio,
                customInstructions,
                photoURL: photoPreview // In a real app, upload to storage first
            };

            // 1. Update Firestore
            await updateUserProfile(currentUser.uid, updates);
            
            // 2. Update Local State
            updateCurrentUser(updates);

            // 3. Update Email if changed
            if (email !== currentUser.email) {
                try {
                    await updateEmailAddress(email);
                    showToast("Profile and Email updated successfully!");
                } catch (err: any) {
                    console.error("Email update failed:", err);
                    showToast("Profile saved, but Email update failed (requires recent login).");
                }
            } else {
                 showToast("Profile updated successfully!");
            }
            
            setIsEditing(false);
        } catch (error) {
            console.error("Save error:", error);
            showToast("Failed to save profile.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!email) return;
        try {
            await resetPassword(email);
            showToast(`Password reset link sent to ${email}`);
        } catch (e) {
            showToast("Failed to send reset link.");
        }
    };

    const handleDelete = async () => {
        if (window.confirm("Are you sure? This action is irreversible.")) {
            try {
                await deleteAccount();
                onBack(); // Or redirect to home/login handled by auth state
            } catch (e) {
                showToast("Delete failed. Please re-login and try again.");
            }
        }
    };
    
    const handleGmailConnection = async () => {
        if (currentUser?.connections?.gmail) {
            if(window.confirm("Disconnect Gmail? You won't be able to send emails until you reconnect.")) {
                disconnectGmail();
                showToast("Gmail disconnected.");
            }
        } else {
            try {
                await connectGmail();
                showToast("Gmail connected successfully!");
            } catch (e) {
                showToast("Failed to connect Gmail.");
            }
        }
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-r from-brand-600 to-accent-600"></div>
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-white/10 rounded-full blur-[100px]"></div>

            <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 text-white">
                    <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition text-sm font-semibold">
                        <i className="ph-bold ph-arrow-left"></i> Back to Chat
                    </button>
                    <button onClick={logout} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 backdrop-blur-md rounded-full hover:bg-red-500/30 transition text-sm font-semibold border border-red-500/30">
                        <i className="ph-bold ph-sign-out"></i> Sign Out
                    </button>
                </div>

                {/* Main Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100"
                >
                    <div className="p-8 md:p-12">
                        {/* Profile Header Section */}
                        <div className="flex flex-col md:flex-row gap-8 items-start mb-12">
                            <div className="relative group">
                                <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100 relative">
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-slate-300">
                                            {displayName.charAt(0)}
                                        </div>
                                    )}
                                    
                                    {/* Upload Overlay */}
                                    <div 
                                        onClick={() => isEditing && fileInputRef.current?.click()}
                                        className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 ${isEditing ? 'group-hover:opacity-100 cursor-pointer' : ''} transition-opacity duration-300`}
                                    >
                                        <i className="ph-bold ph-camera text-white text-2xl"></i>
                                    </div>
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} disabled={!isEditing} />
                                {isEditing && <p className="text-center text-xs text-slate-500 mt-2">Tap to change</p>}
                            </div>

                            <div className="flex-1 w-full">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h1 className="text-3xl font-bold text-slate-800 mb-1">{currentUser?.displayName}</h1>
                                        <p className="text-slate-500 font-medium">{currentUser?.email}</p>
                                        <div className="flex gap-2 mt-4">
                                            <span className="px-3 py-1 bg-brand-50 text-brand-600 text-xs font-bold rounded-full border border-brand-100">PRO PLAN</span>
                                            <span className="px-3 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-full border border-green-100">VERIFIED</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                                        className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg transition-all ${isEditing ? 'bg-slate-900 text-white hover:bg-brand-600' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        {isLoading ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <i className={`ph-bold ${isEditing ? 'ph-check' : 'ph-pencil-simple'}`}></i>
                                                {isEditing ? 'Save Changes' : 'Edit Profile'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100 mb-8"></div>
                        
                        {/* Connected Apps Section - NEW */}
                        <div className="mb-10">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                                <i className="ph-duotone ph-plugs-connected text-brand-500"></i> Connected Apps
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Gmail Connection Card */}
                                <div className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between bg-slate-50">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-red-500 text-2xl">
                                            <i className="ph-fill ph-envelope-simple"></i>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm">Gmail</h4>
                                            {currentUser?.connections?.gmail ? (
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Connected
                                                    </span>
                                                    {currentUser.connections.gmailEmail && (
                                                        <span className="text-xs text-slate-400 truncate max-w-[150px]">{currentUser.connections.gmailEmail}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Not Connected
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleGmailConnection}
                                        disabled={!isEditing && currentUser?.connections?.gmail}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                            currentUser?.connections?.gmail 
                                                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100' 
                                                : 'bg-slate-900 text-white hover:bg-brand-600 shadow-lg shadow-slate-900/10'
                                        }`}
                                    >
                                        {currentUser?.connections?.gmail ? 'Disconnect' : 'Connect'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100 mb-8"></div>

                        {/* Form Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Personal Info */}
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <i className="ph-duotone ph-user text-brand-500"></i> Personal Details
                                </h3>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-slate-500 mb-1.5">Full Name</label>
                                    <input 
                                        type="text" 
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        disabled={!isEditing}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:bg-white transition disabled:opacity-70 disabled:cursor-not-allowed"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-500 mb-1.5">Age</label>
                                        <input 
                                            type="number" 
                                            value={age}
                                            onChange={(e) => setAge(e.target.value)}
                                            disabled={!isEditing}
                                            placeholder="25"
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:bg-white transition disabled:opacity-70 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-500 mb-1.5">Nickname (AI use)</label>
                                        <input 
                                            type="text" 
                                            value={aboutYou}
                                            onChange={(e) => setAboutYou(e.target.value)}
                                            disabled={!isEditing}
                                            placeholder="Adi"
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:bg-white transition disabled:opacity-70 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-500 mb-1.5">Bio</label>
                                    <textarea 
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        disabled={!isEditing}
                                        rows={4}
                                        placeholder="Tell us a bit about yourself..."
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:bg-white transition disabled:opacity-70 disabled:cursor-not-allowed resize-none"
                                    />
                                </div>
                            </div>

                            {/* Account & AI Settings */}
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <i className="ph-duotone ph-shield-check text-brand-500"></i> Account & AI
                                </h3>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-500 mb-1.5">Email Address</label>
                                    <input 
                                        type="email" 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={!isEditing}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:bg-white transition disabled:opacity-70 disabled:cursor-not-allowed"
                                    />
                                    {isEditing && <p className="text-xs text-amber-600 mt-1"><i className="ph-bold ph-warning"></i> Changing email requires recent login.</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-500 mb-1.5">Custom Instructions</label>
                                    <textarea 
                                        value={customInstructions}
                                        onChange={(e) => setCustomInstructions(e.target.value)}
                                        disabled={!isEditing}
                                        rows={3}
                                        placeholder="How should Aikon behave?"
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:bg-white transition disabled:opacity-70 disabled:cursor-not-allowed resize-none"
                                    />
                                </div>

                                <div className="pt-4 space-y-3">
                                    <button 
                                        onClick={handleResetPassword}
                                        className="w-full py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-900 transition flex items-center justify-center gap-2"
                                    >
                                        <i className="ph-bold ph-key"></i> Send Password Reset Link
                                    </button>
                                    
                                    <button 
                                        onClick={handleDelete}
                                        className="w-full py-3 px-4 rounded-xl border border-red-100 text-red-500 font-semibold hover:bg-red-50 transition flex items-center justify-center gap-2"
                                    >
                                        <i className="ph-bold ph-trash"></i> Delete Account
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Toast Notification */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50"
                    >
                        <i className="ph-fill ph-check-circle text-brand-400"></i>
                        <span className="font-medium">{toastMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProfilePage;