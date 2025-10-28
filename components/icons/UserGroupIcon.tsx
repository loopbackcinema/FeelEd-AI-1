import React from 'react';

export const UserGroupIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-4.663M15 19.128a9.37 9.37 0 01-1.362-.083M15 15.372a3 3 0 11-6 0 3 3 0 016 0zm-3-3a3 3 0 00-3 3v.166a12.32 12.32 0 01-3.422-.586c-1.343-.44-2.286-1.547-2.286-2.94v-.166a3 3 0 013-3h.004a3 3 0 013 3z" />
    </svg>
);
