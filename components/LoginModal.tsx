import React, { useEffect, useRef } from 'react';
import { GOOGLE_CLIENT_ID } from '../constants';

interface LoginModalProps {
  onLoginSuccess: (credential: string) => void;
  onDismiss: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess, onDismiss }) => {
    const googleButtonContainerRef = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);

    useEffect(() => {
        const initializeGoogleSignIn = () => {
            if (initialized.current || typeof window.google?.accounts?.id === 'undefined' || !googleButtonContainerRef.current) {
                return;
            }
            initialized.current = true;

            try {
                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: (response: any) => onLoginSuccess(response.credential),
                });
                window.google.accounts.id.renderButton(
                    googleButtonContainerRef.current,
                    { theme: 'outline', size: 'large', type: 'standard', text: 'continue_with' }
                );
            } catch (error) {
                console.error("Error initializing Google Sign-In:", error);
                initialized.current = false; // Allow retry
            }
        };

        const scriptLoadCheck = setInterval(() => {
            if (window.google?.accounts?.id) {
                clearInterval(scriptLoadCheck);
                initializeGoogleSignIn();
            }
        }, 100);
        
        return () => clearInterval(scriptLoadCheck);
    }, [onLoginSuccess]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full m-4 text-center transform transition-all animate-fade-in-up relative">
                <button 
                    onClick={onDismiss} 
                    aria-label="Close"
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="flex justify-center items-center gap-3 mb-4">
                   <img src="https://storage.googleapis.com/aai-web-samples/app-icons/feel-ed-ai.png" alt="FeelEd AI Logo" className="w-12 h-12 rounded-full shadow-md" />
                   <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Create Unlimited Stories</h2>
                </div>
                
                <p className="mt-2 text-base text-gray-600">
                    Did you enjoy your first story? Sign in to continue your learning adventure with FeelEd AI.
                </p>

                <div className="mt-8 min-h-[55px] flex justify-center">
                    <div ref={googleButtonContainerRef}></div>
                </div>

                <p className="mt-6 text-xs text-gray-400">By signing in, you can save your progress and access more features.</p>
            </div>
        </div>
    );
};