import React from 'react';

interface ApiKeyModalProps {
  handleSelectKey: () => void;
  apiKeyError: string | null;
  envError: string | null;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ handleSelectKey, apiKeyError, envError }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full m-4 text-center transform transition-all animate-fade-in-up">
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Connect the AI Engine</h2>
        <p className="mt-2 text-base text-gray-600">
          To create magical learning stories, FeelEd AI needs permission to use Google's AI.
        </p>

        {apiKeyError && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-left text-sm" role="alert">
            <p className="font-bold">Invalid API Key</p>
            <p>{apiKeyError}</p>
          </div>
        )}
        
        {envError && (
          <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-lg text-left text-sm" role="alert">
            <p className="font-bold">Connection Issue</p>
            <p>{envError}</p>
          </div>
        )}

        <p className="mt-4 text-sm text-gray-500">
          Please select an API key to make the connection. Standard usage rates will apply to your project.
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline ml-1">Learn more</a>.
        </p>

        <button
          onClick={handleSelectKey}
          disabled={!!envError}
          className="mt-6 w-full flex items-center justify-center gap-3 px-6 py-3 text-lg font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Select API Key
        </button>
      </div>
    </div>
  );
};