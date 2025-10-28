
import React from 'react';

export const Header: React.FC = () => (
    <header className="py-8 text-center">
        <div className="inline-flex items-center gap-4">
            <div className="w-20 h-20 bg-black rounded-full p-1 shadow-lg">
               <img src="https://storage.googleapis.com/aai-web-samples/app-icons/feel-ed-ai.png" alt="FeelEd AI Logo" className="w-full h-full rounded-full" />
            </div>
            <div>
                <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 tracking-tight">FeelEd AI</h1>
                <p className="text-lg text-gray-500 mt-1">Feel the story. Learn naturally.</p>
            </div>
        </div>
    </header>
);
