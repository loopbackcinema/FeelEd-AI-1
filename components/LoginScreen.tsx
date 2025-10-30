import React, { useEffect, useRef } from 'react';
import { GOOGLE_CLIENT_ID } from '../constants';
import { GoogleIcon } from './icons/GoogleIcon';

interface LoginScreenProps {
  onLoginSuccess: (credential: string) => void;
  onGuestContinue: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onGuestContinue }) => {
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
                    { theme: 'outline', size: 'large', type: 'standard', text: 'continue_with', width: '300' }
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
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center p-8 sm:p-12 bg-white/70 backdrop-blur-xl rounded-3xl shadow-lg border border-gray-200/50 animate-fade-in-up">
                <div className="flex justify-center items-center gap-4 mb-4">
                    <img src="https://storage.googleapis.com/aai-web-samples/app-icons/feel-ed-ai.png" alt="FeelEd AI Logo" className="w-16 h-16 rounded-full shadow-md" />
                    <div>
                         <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Welcome to FeelEd AI</h1>
                         <p className="text-md text-gray-500 mt-1">Feel the story. Learn naturally.</p>
                    </div>
                </div>

                <p className="mt-6 text-base text-gray-600">
                    Sign in to create unlimited emotional learning stories, or continue as a guest for a one-time trial.
                </p>

                <div className="mt-8 min-h-[55px] flex justify-center">
                    <div ref={googleButtonContainerRef}></div>
                </div>

                <div className="mt-6 flex items-center justify-center">
                    <div className="flex-grow border-t border-gray-300"></div>
                    <span className="flex-shrink mx-4 text-sm text-gray-500">OR</span>
                    <div className="flex-grow border-t border-gray-300"></div>
                </div>
                
                <button
                    onClick={onGuestContinue}
                    className="mt-6 w-full max-w-[300px] mx-auto px-6 py-3 text-base font-semibold text-indigo-700 bg-indigo-100 rounded-lg hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                    Continue as Guest
                </button>
            </div>
        </div>
    );
};
