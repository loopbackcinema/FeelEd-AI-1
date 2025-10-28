import React, { useState, useRef, useEffect } from 'react';
import type { User } from '../types';
import { GoogleIcon } from './icons/GoogleIcon';

interface HeaderProps {
  user: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
}

// Simple JWT decoder
function jwtDecode<T>(token: string): T {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

// A generic, gray SVG avatar for guest users, encoded as a data URI.
const GUEST_AVATAR_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0EwQTBCMyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MxLjY2IDAgMyAxLjM0IDMgM3MtMS4zNCAzLTMgMy0zLTEuMzQtMy0zIDEuMzQtMyAzIDN6bTAgMTRjLTIuMDMgMC0zLjg0LS44MS01LjE1LTIuMTFDOC4yOCAxNS40NSAxMC4xMyAxNSAxMiAxNXMzLjcyLjQ1IDUuMTUgMS44OUMxNS44NCAxOC4xOSAxNC4wMyAxOSAxMiAxOXoiLz48L3N2Zz4=';


export const Header: React.FC<HeaderProps> = ({ user, onLogin, onLogout }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const googleButtonRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    // Google Sign-In initialization
    useEffect(() => {
        if (!user && (window as any).google) {
            const google = (window as any).google;
            google.accounts.id.initialize({
                // IMPORTANT: Replace this with your actual Google Client ID.
                // DO NOT use a Client Secret here. It is a major security risk.
                client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
                callback: (response: any) => {
                    const decoded: { name: string, email: string, picture: string } = jwtDecode(response.credential);
                    onLogin({
                        name: decoded.name,
                        email: decoded.email,
                        picture: decoded.picture
                    });
                }
            });

            if (googleButtonRef.current) {
                google.accounts.id.renderButton(
                    googleButtonRef.current,
                    { theme: "outline", size: "large", type: "standard", shape: "pill" }
                );
            }
        }
    }, [user, onLogin]);

    const handleLogoutClick = () => {
        // Clear Google's session state to allow re-login
        if ((window as any).google) {
            (window as any).google.accounts.id.disableAutoSelect();
        }
        onLogout();
    }
    
    const handleGuestLogin = () => {
        onLogin({
            name: 'Guest User',
            email: 'guest@feeled.ai',
            picture: GUEST_AVATAR_URL,
        });
    };


  return (
    <header className="py-6 flex justify-between items-center">
        <div className="flex-1">
            <div className="inline-flex items-center gap-4">
                <div className="w-16 h-16 bg-black rounded-full p-1 shadow-lg">
                   <img src="https://storage.googleapis.com/aai-web-samples/app-icons/feel-ed-ai.png" alt="FeelEd AI Logo" className="w-full h-full rounded-full" />
                </div>
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 tracking-tight">FeelEd AI</h1>
                    <p className="text-md text-gray-500 mt-1">Feel the story. Learn naturally.</p>
                </div>
            </div>
        </div>
        
        <div className="flex-none">
            {user ? (
                 <div className="relative" ref={dropdownRef}>
                    <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-3 p-2 rounded-full hover:bg-gray-200/50 transition-colors">
                        <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full border-2 border-white shadow-md"/>
                        <span className="font-semibold text-gray-700 hidden sm:inline">{user.name}</span>
                        <svg className={`w-5 h-5 text-gray-500 transition-transform hidden sm:inline ${isDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                    </button>
                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border z-20 animate-fade-in-up origin-top-right">
                            <div className="py-1">
                                <div className="px-4 py-2 border-b">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{user.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                </div>
                                <button onClick={handleLogoutClick} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                    Logout
                                </button>
                            </div>
                        </div>
                    )}
                 </div>
            ) : (
                <div className="flex flex-col items-center">
                    <div ref={googleButtonRef}></div>
                    <div className="relative flex items-center w-full max-w-[190px] my-2">
                        <div className="flex-grow border-t border-gray-300"></div>
                        <span className="flex-shrink mx-2 text-xs text-gray-500">OR</span>
                        <div className="flex-grow border-t border-gray-300"></div>
                    </div>
                    <button
                        onClick={handleGuestLogin}
                        className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        Continue as Guest
                    </button>
                </div>
            )}
        </div>
    </header>
  );
};