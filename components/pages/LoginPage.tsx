
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';

const MotionDiv = motion.div as any;
const MotionButton = motion.button as any;

const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        if (!agreed) {
            setError("You must agree to the Terms and Conditions.");
            return;
        }

        if (pin.length !== 4) {
            setError("PIN must be exactly 4 digits.");
            return;
        }

        setIsLoggingIn(true);
        const result = await login(username, pin);
        setIsLoggingIn(false);

        if (!result.success) {
            setError(result.message);
        } else {
            setSuccessMessage(result.message);
            // The AuthContext will handle the state change and redirect
        }
    };

    const isSubmitDisabled = isLoggingIn || !agreed || !username.trim() || pin.length !== 4;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-black">
            <MotionDiv 
                className="w-full max-w-sm bg-[#18181b] p-8 rounded-2xl shadow-2xl border border-[#27272a] text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            >
                <h1 className="text-2xl font-bold mb-2">Welcome to Aikon</h1>
                <p className="text-gray-400 mb-6 text-sm">Enter your credentials to continue.</p>
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        className="form-input"
                        aria-label="Username"
                        required
                    />
                    <input
                        type="password"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="4-Digit PIN"
                        className="form-input text-center tracking-[1em]"
                        aria-label="4-Digit PIN"
                        maxLength={4}
                        pattern="\d{4}"
                        required
                    />
                    
                    <div className="pt-2">
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
                    </div>

                    <MotionButton
                        type="submit"
                        disabled={isSubmitDisabled}
                        className="w-full flex items-center justify-center py-3 px-4 text-black font-bold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cta-button-animated"
                        whileHover={{ scale: !isSubmitDisabled ? 1.05 : 1 }}
                        whileTap={{ scale: !isSubmitDisabled ? 0.95 : 1 }}
                    >
                        {isLoggingIn ? (
                            <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            'Login / Register'
                        )}
                    </MotionButton>
                </form>
                
                {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
                {successMessage && <p className="text-green-400 mt-4 text-sm">{successMessage}</p>}
            </MotionDiv>
        </div>
    );
};

export default LoginPage;