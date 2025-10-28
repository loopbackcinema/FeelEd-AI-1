import React, { useState, useRef, useEffect } from 'react';
import type { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // This effect now correctly adds the event listener only when the dropdown is open.
    // This prevents a race condition where the click to open the menu might also be
    // caught by the "click outside" logic, preventing it from ever appearing.
    useEffect(() => {
        if (!isDropdownOpen) {
            return;
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isDropdownOpen]);

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
            {user && (
                 <div className="relative" ref={dropdownRef}>
                    <button onClick={() => setIsDropdownOpen(prev => !prev)} className="flex items-center gap-3 p-2 rounded-full hover:bg-gray-200/50 transition-colors">
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
                                <button onClick={onLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                    Logout
                                </button>
                            </div>
                        </div>
                    )}
                 </div>
            )}
        </div>
    </header>
  );
};