import { useState, useEffect, useCallback } from 'react';
import type { User } from '../types';

interface GoogleJwtPayload {
  email: string;
  name: string;
  picture: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [guestStoryCount, setGuestStoryCount] = useState<number>(0);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('feelEdUser');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      const storedGuestCount = localStorage.getItem('guestStoryCount');
      setGuestStoryCount(Number(storedGuestCount) || 0);

    } catch (e) {
      console.error("Failed to parse session, clearing storage.", e);
      localStorage.removeItem('feelEdUser');
      localStorage.removeItem('guestStoryCount');
    } finally {
      setIsAuthReady(true);
    }
  }, []);

  const handleLoginSuccess = useCallback((credential: string) => {
    try {
      const payload: GoogleJwtPayload = JSON.parse(atob(credential.split('.')[1]));
      const newUser: User = {
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
      };
      localStorage.setItem('feelEdUser', JSON.stringify(newUser));
      setUser(newUser);
      
      // Clear guest session data upon login
      setIsGuest(false);
      setGuestStoryCount(0);
      localStorage.removeItem('guestStoryCount');

    } catch (e) {
      console.error("Failed to parse credential or save user session", e);
      // We should probably show an error to the user here
    }
  }, []);

  const handleLogout = useCallback(() => {
    if (window.google) {
        window.google.accounts.id.disableAutoSelect();
    }
    localStorage.removeItem('feelEdUser');
    localStorage.removeItem('guestStoryCount');
    setUser(null);
    setIsGuest(false);
    setGuestStoryCount(0);
  }, []);
  
  const handleGuestContinue = useCallback(() => {
    setIsGuest(true);
  }, []);

  const hasStoryCredit = useCallback(() => {
    if (user) return true; // Logged-in users have unlimited credits
    return guestStoryCount < 1;
  }, [user, guestStoryCount]);

  const useStoryCredit = useCallback(() => {
      if (!user) {
          const newCount = guestStoryCount + 1;
          setGuestStoryCount(newCount);
          localStorage.setItem('guestStoryCount', String(newCount));
      }
  }, [user, guestStoryCount]);

  return { 
    user, 
    isGuest,
    isAuthReady,
    handleLoginSuccess, 
    handleGuestContinue,
    handleLogout,
    hasStoryCredit,
    useStoryCredit
  };
};
