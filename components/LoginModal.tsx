import React, { useEffect, useRef } from 'react';
import { GOOGLE_CLIENT_ID } from '../constants';

interface LoginModalProps {
  onLoginSuccess: (credential: string) => void;
  onClose: () => void;
}

declare global {
    interface Window {
        google: any;
    }
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess, onClose }) => {
    const googleButtonRef = useRef<HTMLDivElement>(null);
    const modalContentRef = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);

    useEffect(() => {
        // Close modal on outside click
        const handleClickOutside = (event: MouseEvent) => {
            if (modalContentRef.current && !modalContentRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        // Close modal on Escape key press
        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener('keydown', handleEscKey);
        
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [onClose]);

    useEffect(() => {
        const initializeGoogleSignIn = () => {
            if (initialized.current || typeof window.google?.accounts?.id === 'undefined' || !googleButtonRef.current) {
                return;
            }

            initialized.current = true;

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
                initialized.current = false;
            }
        };

        if (typeof window.google?.accounts?.id !== 'undefined') {
            initializeGoogleSignIn();
        } else {
            const interval = setInterval(() => {
                if (typeof window.google?.accounts?.id !== 'undefined') {
                    clearInterval(interval);
                    initializeGoogleSignIn();
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, []);

    const handleCredentialResponse = (response: any) => {
        onLoginSuccess(response.credential);
    };

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
    >
      <div ref={modalContentRef} className="bg-white rounded-2xl shadow-xl p-8 sm:p-10 max-w-md w-full relative transform transition-all animate-fade-in-up">
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close login modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex flex-col items-center justify-center text-center">
            <img 
                src="https://storage.googleapis.com/aai-web-samples/app-icons/feel-ed-ai.png" 
                alt="FeelEd AI Logo" 
                className="w-20 h-20 rounded-full shadow-lg mb-5" 
            />
            <h1 id="login-modal-title" className="text-3xl font-bold text-gray-800 tracking-tight">Sign In to Continue</h1>
            <p className="mt-2 text-base text-gray-600 max-w-sm">
                Please sign in with Google to generate your personalized story-based lesson.
            </p>
            <div className="mt-8 min-h-[50px] flex justify-center">
                <div ref={googleButtonRef}></div>
            </div>
        </div>
      </div>
    </div>
  );
};