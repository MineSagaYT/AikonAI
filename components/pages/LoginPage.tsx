
import React, { useState } from 'react';
import { signInWithGoogle } from '../../services/firebase';

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
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center justify-center py-3 px-4 bg-[#27272a] hover:bg-[#3f3f46] text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
            {children}
        </button>
    );

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-black">
            <div className="w-full max-w-sm bg-[#18181b] p-8 rounded-2xl shadow-2xl border border-[#27272a] text-center animate-fade-in-up">
                <h1 className="text-2xl font-bold mb-2">Log in or sign up</h1>
                <p className="text-gray-400 mb-8 text-sm">You'll get smarter responses and can upload files, images, and more.</p>
                
                <div className="space-y-3">
                     <AuthButton onClick={handleSignIn} disabled={isSigningIn}>
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
                    <AuthButton disabled>Continue with Microsoft</AuthButton>
                    <AuthButton disabled>Continue with Apple</AuthButton>
                </div>

                <div className="my-6 flex items-center">
                    <div className="flex-grow border-t border-gray-700"></div>
                    <span className="flex-shrink mx-4 text-gray-500 text-sm">OR</span>
                    <div className="flex-grow border-t border-gray-700"></div>
                </div>

                <input
                    type="email"
                    placeholder="Email address"
                    disabled
                    className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg py-3 px-4 mb-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                />
                 <button
                    disabled
                    className="w-full bg-amber-500 text-black font-bold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Continue
                </button>

                 <button
                    onClick={onGuestLogin}
                    className="text-amber-400 hover:text-amber-300 transition-colors duration-200 mt-8 text-sm"
                >
                    Continue as Guest
                </button>

                {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
            </div>
        </div>
    );
};

export default LoginPage;