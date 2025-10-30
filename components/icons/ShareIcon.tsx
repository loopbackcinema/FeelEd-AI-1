import React from 'react';

export const ShareIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm0 0v2.25m0-2.25h1.5M16.5 18.75a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm0 0v2.25m0-2.25h-1.5m-6.354-7.5-3.268 3.268a2.25 2.25 0 0 0 0 3.182m5.656-5.656 3.268-3.268a2.25 2.25 0 0 0-3.182-3.182m-3.268 3.268 3.268 3.268" />
    </svg>
);
