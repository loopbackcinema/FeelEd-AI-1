import React, { useEffect, useRef } from 'react';
import { GOOGLE_CLIENT_ID } from '../constants';

interface LoginScreenProps {
  onLoginSuccess: (credential: string) => void;
}

declare global {
    interface Window {
        google: any;
    }
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
    const googleButtonRef = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);

    useEffect(() => {
        const initializeGoogleSignIn = () => {
            // Prevent re-initialization or running before the script is loaded/ref is ready
            if (initialized.current || typeof window.google?.accounts?.id === 'undefined' || !googleButtonRef.current) {
                return;
            }

            initialized.current = true; // Mark as initialized to prevent running again

            try {
                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: handleCredentialResponse,
                    use_fedcm_for_prompt: false,
                });
                window.google.accounts.id.renderButton(
                    googleButtonRef.current!,
                    { theme: 'outline', size: 'large', type: 'standard', text: 'signin_with' }
                );
                window.google.accounts.id.prompt();
            } catch (error) {
                console.error("Error initializing Google Sign-In:", error);
                initialized.current = false; // Reset on error to allow a future attempt
            }
        };

        // Check if the script is already loaded
        if (typeof window.google?.accounts?.id !== 'undefined') {
            initializeGoogleSignIn();
        } else {
            // If not loaded, poll for it
            const interval = setInterval(() => {
                if (typeof window.google?.accounts?.id !== 'undefined') {
                    clearInterval(interval);
                    initializeGoogleSignIn();
                }
            }, 100);
            return () => clearInterval(interval); // Cleanup on unmount
        }
    }, []); // Empty dependency array ensures this runs only once on mount

    const handleCredentialResponse = (response: any) => {
        onLoginSuccess(response.credential);
    };

  return (
    <div className="flex flex-col items-center justify-center text-center animate-fade-in-up py-12">
      <img 
        src="https://storage.googleapis.com/aai-web-samples/app-icons/feel-ed-ai.png" 
        alt="FeelEd AI Logo" 
        className="w-24 h-24 rounded-full shadow-lg mb-6" 
      />
      <h1 className="text-4xl font-bold text-gray-800 tracking-tight">Welcome to FeelEd AI</h1>
      <p className="mt-2 text-lg text-gray-600 max-w-md">
        Sign in with your Google account to begin your personalized story-based learning journey.
      </p>
      <div className="mt-10 min-h-[50px]">
        <div ref={googleButtonRef}></div>
      </div>
    </div>
  );
};
