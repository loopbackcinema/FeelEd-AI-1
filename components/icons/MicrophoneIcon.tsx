
import React from 'react';

export const MicrophoneIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5a6 6 0 00-12 0v1.5a6 6 0 006 6z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v.75a7.5 7.5 0 01-7.5 7.5h-.038A7.5 7.5 0 014.5 15v-.75" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75v-6" />
  </svg>
);
