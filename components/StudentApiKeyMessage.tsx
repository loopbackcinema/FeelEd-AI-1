import React from 'react';
import { UserGroupIcon } from './icons/UserGroupIcon';

export const StudentApiKeyMessage: React.FC = () => (
    <div className="flex flex-col items-center justify-center text-center animate-fade-in-up py-12">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-indigo-100">
            <UserGroupIcon className="h-8 w-8 text-indigo-600" />
        </div>
        <h2 className="mt-6 text-2xl font-bold text-gray-800 tracking-tight">Almost Ready!</h2>
        <p className="mt-2 text-lg text-gray-600 max-w-md">
            Please ask a teacher or parent to finish setting up FeelEd AI.
        </p>
        <p className="mt-2 text-sm text-gray-500 max-w-md">
            They just need to connect the app to the AI service to unlock your learning journey. We can't wait to see you start!
        </p>
    </div>
);
