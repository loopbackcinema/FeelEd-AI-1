import React, { useEffect, useRef } from 'react';
import { GOOGLE_CLIENT_ID } from '../constants';

interface LoginScreenProps {
  onLoginSuccess: (credential: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
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
                window.google.accounts.id.prompt(); 
            } catch (error) {
                console.error("Error initializing Google Sign-In:", error);
                initialized.current = false;
            }
        };

        // GIS script can be slow to load
        const scriptLoadCheck = setInterval(() => {
            if (window.google?.accounts?.id) {
                clearInterval(scriptLoadCheck);
                initializeGoogleSignIn();
            }
        }, 100);
        
        return () => clearInterval(scriptLoadCheck);
    }, [onLoginSuccess]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 flex flex-col justify-center items-center p-4">
            <main className="text-center bg-white/70 backdrop-blur-xl p-8 sm:p-12 rounded-3xl shadow-lg border border-gray-200/50 max-w-2xl w-full animate-fade-in-up">
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-4">
                   <img src="https://storage.googleapis.com/aai-web-samples/app-icons/feel-ed-ai.png" alt="FeelEd AI Logo" className="w-20 h-20 rounded-full shadow-lg" />
                   <div className="mt-4 sm:mt-0 sm:text-left">
                       <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 tracking-tight">Welcome to FeelEd AI</h1>
                       <p className="text-lg text-gray-500 mt-2">Feel the story. Learn naturally.</p>
                   </div>
                </div>
                
                <div className="mt-8 text-left text-base text-gray-700 space-y-3 max-w-lg mx-auto">
                    <p>FeelEd AI transforms any academic topic into an emotionally engaging story, making learning intuitive and memorable for <span className="font-semibold text-indigo-600">students</span>, <span className="font-semibold text-purple-600">teachers</span>, and <span className="font-semibold text-pink-600">parents</span>.</p>
                    <p>To begin your personalized learning journey, please sign in with your Google account.</p>
                </div>

                <div className="mt-10 min-h-[55px] flex justify-center">
                    <div ref={googleButtonContainerRef}></div>
                </div>

                <p className="mt-6 text-xs text-gray-400">By signing in, you agree to our terms of service.</p>
            </main>
        </div>
    );
};
