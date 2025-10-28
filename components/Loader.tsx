
import React from 'react';

export const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-16">
      <div className="w-16 h-16 border-4 border-t-4 border-t-purple-600 border-gray-200 rounded-full animate-spin"></div>
      <p className="text-lg font-medium text-gray-700">FeelEd AI is thinking...</p>
      <p className="text-sm text-gray-500 text-center max-w-sm">
        Generating an emotional story, explaining the concept, and creating a natural voice narration. This may take a moment.
      </p>
    </div>
  );
};
