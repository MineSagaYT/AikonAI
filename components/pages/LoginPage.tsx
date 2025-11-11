import React, { useState } from 'react';
import { signInWithGoogle } from '../../services/firebase';
import { motion } from 'framer-motion';

const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.804 9.81C34.553 5.952 29.548 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path>
        <path fill="#FF3D00" d="M6.306 14.691c-1.218 2.359-1.92 5.043-1.92 7.935s.702 5.576 1.92 7.935l-5.64 4.14C.247 30.65 0 27.42 0 24s.247-6.65 1.522-9.428l4.784 5.119z"></path>
        <path fill="#4CAF50" d="M24 48c5.548 0 10.553-1.952 14.804-5.19l-5.64-4.14c-2.359 1.218-5.043 1.92-7.935 1.92-5.748 0-10.635-3.576-12.373-8.524l-5.32 4.615C8.214 41.22 15.51 48 24 48z"></path>
        <path fill="#1976D2" d="M43.611 20.083H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.64 4.14c3.161-2.91 5.14-7.29 5.14-12.127c0-1.341-.138-2.65-.389-3.917z"></path>
    </svg>
);


interface LoginPageProps {
    onGuestLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onGuestLogin }) => {
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [agreed, setAgreed] = useState(false);

    const handleSignIn = async () => {
        setIsSigningIn(true);
        setError(null);
        const user = await signInWithGoogle();
        if (!user) {
            setError("Sign-in failed. Please try again.");
            setIsSigningIn(false);
        }
    };

    const AuthButton: React.FC<{ children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }> = ({ children, onClick, disabled, className }) => (
        <motion.button
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center justify-center py-3 px-4 bg-[#27272a] hover:bg-[#3f3f46] text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            whileHover={{ scale: !disabled ? 1.05 : 1 }}
            whileTap={{ scale: !disabled ? 0.95 : 1 }}
        >
            {children}
        </motion.button>
    );

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-black">
            <motion.div 
                className="w-full max-w-sm bg-[#18181b] p-8 rounded-2xl shadow-2xl border border-[#27272a] text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            >
                <h1 className="text-2xl font-bold mb-2">Welcome to Aikon</h1>
                <p className="text-gray-400 mb-8 text-sm">Sign in to personalize your experience.</p>
                
                 <div className="flex items-start my-4">
                    <input
                        id="terms"
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-amber-500 focus:ring-amber-600 cursor-pointer mt-1"
                    />
                    <label htmlFor="terms" className="ml-3 text-xs text-gray-400 text-left">
                        I confirm that I am 18 years of age or older and agree to the <a href="#" className="text-amber-400 hover:underline">Terms and Conditions</a> of Aikon Studios.
                    </label>
                </div>
                
                <div className="space-y-3">
                     <AuthButton onClick={handleSignIn} disabled={isSigningIn || !agreed}>
                        {isSigningIn ? (
                            <>
                               <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Signing In...
                            </>
                        ) : (
                            <>
                                <GoogleIcon />
                                Continue with Google
                            </>
                        )}
                    </AuthButton>
                </div>

                <div className="my-6 flex items-center">
                    <div className="flex-grow border-t border-gray-700"></div>
                    <span className="flex-shrink mx-4 text-gray-500 text-sm">OR</span>
                    <div className="flex-grow border-t border-gray-700"></div>
                </div>

                 <motion.button
                    onClick={onGuestLogin}
                    disabled={!agreed}
                    className="w-full text-center text-amber-400 hover:text-amber-300 transition-colors duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: !agreed ? 1 : 1.05 }}
                    whileTap={{ scale: !agreed ? 1 : 0.95 }}
                >
                    Continue as Guest
                </motion.button>
                
                {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
            </motion.div>
        </div>
    );
};

export default LoginPage;