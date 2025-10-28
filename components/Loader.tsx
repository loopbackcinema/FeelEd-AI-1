import React, { useState, useEffect } from 'react';

const loadingSteps = [
  "Crafting a captivating storyline...",
  "Weaving in the emotional core...",
  "Simplifying the core concepts...",
  "Generating a natural voice narration...",
  "Bringing your lesson to life...",
];

export const Loader: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prevStep) => (prevStep + 1) % loadingSteps.length);
    }, 2500); // Change text every 2.5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-16">
      <div className="w-16 h-16 border-4 border-t-4 border-t-purple-600 border-gray-200 rounded-full animate-spin"></div>
      <div className="text-center">
        <p className="text-xl font-semibold text-gray-800 animate-pulse">FeelEd AI is thinking...</p>
        <div className="h-6 mt-2 relative w-80">
          <p 
            key={currentStep} 
            className="text-base text-gray-600 absolute inset-0 animate-fade-in-up"
          >
            {loadingSteps[currentStep]}
          </p>
        </div>
      </div>
    </div>
  );
};