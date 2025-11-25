import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const LoginPage: React.FC = () => {
    const { login, loginWithGoogle, register, resetPassword } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Verification State
    const [showVerification, setShowVerification] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState('');

    // Forgot Password State
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [resetEmailSent, setResetEmailSent] = useState(false);

    // Form Fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setPhoto(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            if (isLogin) {
                await login(email, password);
            } else {
                if (password !== confirmPassword) {
                    throw new Error("Passwords do not match.");
                }
                if (!name.trim()) {
                    throw new Error("Name is required.");
                }
                await register(email, password, name, photo || undefined);
                
                // Registration successful, show verification screen
                setVerificationEmail(email);
                setShowVerification(true);
            }
        } catch (err: any) {
            console.error("Auth Error:", err);
            
            if (err.message === 'EMAIL_NOT_VERIFIED') {
                setVerificationEmail(email);
                setShowVerification(true);
                return;
            }

            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError("Password or Email Incorrect");
            } else if (err.code === 'auth/email-already-in-use') {
                setError("User already exists. Sign in?");
                // Optional: Automatically switch to login? 
                // setIsLogin(true); 
            } else if (err.code === 'auth/weak-password') {
                setError("Password should be at least 6 characters.");
            } else {
                setError(err.message || "An unexpected error occurred.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setIsLoading(true);
        try {
            await loginWithGoogle();
        } catch (err: any) {
             console.error("Google Auth Error:", err);
             setError("Failed to sign in with Google.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            if (!email) {
                throw new Error("Please enter your email address.");
            }
            await resetPassword(email);
            setResetEmailSent(true);
        } catch (err: any) {
            console.error("Reset Password Error:", err);
            if (err.code === 'auth/user-not-found') {
                setError("No user found with this email.");
            } else if (err.code === 'auth/invalid-email') {
                setError("Invalid email address.");
            } else {
                setError(err.message || "Failed to send reset email.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackToLogin = () => {
        setShowVerification(false);
        setIsForgotPassword(false);
        setResetEmailSent(false);
        setIsLogin(true);
        setError(null);
        // Do not clear email so user can easily retry
    };

    // Render Verification Screen
    if (showVerification) {
        return (
             <div className="min-h-screen flex items-center justify-center relative bg-[#F8FAFC] px-4 overflow-hidden">
                {/* Background Blobs */}
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-300/30 rounded-full blur-[100px] animate-blob"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent-300/30 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>

                <motion.div 
                    className="bg-white/80 backdrop-blur-xl border border-white/50 w-full max-w-md p-8 rounded-3xl shadow-2xl relative z-10 text-center"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6 text-green-600 shadow-sm">
                        <i className="ph-fill ph-envelope-simple-open text-4xl"></i>
                    </div>
                    <h2 className="text-2xl font-heading font-bold text-slate-800 mb-3">Verify your email</h2>
                    <p className="text-slate-600 mb-8 leading-relaxed">
                        We have sent you a verification email to <br/>
                        <span className="font-semibold text-slate-900">{verificationEmail}</span>. <br/>
                        Please verify it and log in.
                    </p>
                    <button 
                        onClick={handleBackToLogin}
                        className="w-full py-3.5 bg-slate-900 hover:bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 hover:shadow-brand-600/30 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer"
                    >
                        Login
                    </button>
                </motion.div>
             </div>
        );
    }

    // Render Forgot Password Screen
    if (isForgotPassword) {
        return (
            <div className="min-h-screen flex items-center justify-center relative bg-[#F8FAFC] px-4 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-300/30 rounded-full blur-[100px] animate-blob"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent-300/30 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>

                <motion.div 
                    className="bg-white/80 backdrop-blur-xl border border-white/50 w-full max-w-md p-8 rounded-3xl shadow-2xl relative z-10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    {resetEmailSent ? (
                         <div className="text-center">
                            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6 text-blue-600 shadow-sm">
                                <i className="ph-fill ph-check-circle text-4xl"></i>
                            </div>
                            <h2 className="text-2xl font-heading font-bold text-slate-800 mb-3">Check your mail</h2>
                            <p className="text-slate-600 mb-8 leading-relaxed">
                                We have sent you a password change link to <br/>
                                <span className="font-semibold text-slate-900">{email}</span>.
                            </p>
                            <button 
                                onClick={handleBackToLogin}
                                className="w-full py-3.5 bg-slate-900 hover:bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 hover:shadow-brand-600/30 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer"
                            >
                                Sign In
                            </button>
                         </div>
                    ) : (
                        <>
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 shadow-sm mx-auto mb-4">
                                    <i className="ph-bold ph-lock-key-open text-3xl"></i>
                                </div>
                                <h2 className="text-3xl font-heading font-bold text-slate-800">Forgot Password?</h2>
                                <p className="text-slate-500 mt-2">No worries, we'll send you reset instructions.</p>
                            </div>

                            <AnimatePresence mode="wait">
                                {error && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium mb-6 border border-red-100 flex items-center gap-2"
                                    >
                                        <i className="ph-bold ph-warning-circle text-lg"></i>
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                                    <div className="relative">
                                        <i className="ph-bold ph-envelope absolute left-3.5 top-3.5 text-slate-400"></i>
                                        <input 
                                            type="email" 
                                            required 
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition outline-none" 
                                            placeholder="you@aikon.ai"
                                        />
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={isLoading}
                                    className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-600/20 hover:shadow-brand-600/30 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        'Get Reset Link'
                                    )}
                                </button>
                            </form>
                            
                            <div className="mt-6 text-center">
                                <button 
                                    onClick={handleBackToLogin}
                                    className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition flex items-center justify-center gap-2 w-full"
                                >
                                    <i className="ph-bold ph-arrow-left"></i> Back to Sign In
                                </button>
                            </div>
                        </>
                    )}
                </motion.div>
            </div>
        );
    }

    // Render Main Login/Register Form
    return (
        <div className="min-h-screen flex items-center justify-center relative bg-[#F8FAFC] px-4 overflow-hidden">
            {/* Background Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-300/30 rounded-full blur-[100px] animate-blob"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent-300/30 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>

            <motion.div 
                className="bg-white/80 backdrop-blur-xl border border-white/50 w-full max-w-md p-8 rounded-3xl shadow-2xl relative z-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-accent-500 flex items-center justify-center text-white shadow-lg mx-auto mb-4">
                        <i className="ph-bold ph-brain text-3xl"></i>
                    </div>
                    <h2 className="text-3xl font-heading font-bold text-slate-800">
                        {isLogin ? 'Welcome Back' : 'Join Aikon'}
                    </h2>
                    <p className="text-slate-500 mt-2">
                        {isLogin ? 'Enter your details to access your workspace.' : 'Create an account to start innovating.'}
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium mb-6 border border-red-100 flex items-center gap-2"
                        >
                            <i className="ph-bold ph-warning-circle text-lg"></i>
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <AnimatePresence initial={false}>
                        {!isLogin && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-4 overflow-hidden"
                            >
                                <div className="flex justify-center mb-2">
                                    <div className="relative group cursor-pointer">
                                        <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden hover:border-brand-500 transition">
                                            {photoPreview ? (
                                                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <i className="ph-duotone ph-camera-plus text-3xl text-slate-400 group-hover:text-brand-500"></i>
                                            )}
                                        </div>
                                        <input type="file" accept="image/*" onChange={handlePhotoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                                    <div className="relative">
                                        <i className="ph-bold ph-user absolute left-3.5 top-3.5 text-slate-400"></i>
                                        <input 
                                            type="text" 
                                            required={!isLogin}
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition outline-none" 
                                            placeholder="Aditya Jain"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                        <div className="relative">
                            <i className="ph-bold ph-envelope absolute left-3.5 top-3.5 text-slate-400"></i>
                            <input 
                                type="email" 
                                required 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition outline-none" 
                                placeholder="you@aikon.ai"
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Password</label>
                            {isLogin && (
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setIsForgotPassword(true);
                                        setError(null);
                                    }}
                                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                                >
                                    Forgot password?
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <i className="ph-bold ph-lock-key absolute left-3.5 top-3.5 text-slate-400"></i>
                            <input 
                                type="password" 
                                required 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition outline-none" 
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <AnimatePresence initial={false}>
                        {!isLogin && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="pt-4">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Repeat Password</label>
                                    <div className="relative">
                                        <i className="ph-bold ph-check-circle absolute left-3.5 top-3.5 text-slate-400"></i>
                                        <input 
                                            type="password" 
                                            required={!isLogin}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition outline-none" 
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full py-3.5 bg-slate-900 hover:bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 hover:shadow-brand-600/30 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                {isLogin ? 'Sign In' : 'Create Account'} 
                                <i className="ph-bold ph-arrow-right"></i>
                            </>
                        )}
                    </button>
                </form>

                <div className="my-6 flex items-center gap-4">
                    <div className="h-px bg-slate-200 flex-1"></div>
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Or continue with</span>
                    <div className="h-px bg-slate-200 flex-1"></div>
                </div>

                <button 
                    onClick={handleGoogleLogin}
                    type="button"
                    disabled={isLoading}
                    className="w-full py-3 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-3 group"
                >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 opacity-80 group-hover:opacity-100 transition" />
                    Sign in with Google
                </button>

                <div className="mt-6 text-center">
                    <p className="text-slate-500 text-sm">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <button 
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError(null);
                            }}
                            className="ml-2 font-bold text-brand-600 hover:text-brand-700 transition"
                        >
                            {isLogin ? 'Sign Up' : 'Sign In'}
                        </button>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default LoginPage;