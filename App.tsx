import React from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginScreen } from './components/LoginScreen';
import { MainScreen } from './components/MainScreen';
import { Loader } from './components/Loader';

const App: React.FC = () => {
  const { user, isGuest, isAuthReady, handleLoginSuccess, handleGuestContinue, handleLogout } = useAuth();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!user && !isGuest) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} onGuestContinue={handleGuestContinue} />;
  }

  return <MainScreen user={user} onLogout={handleLogout} />;
};

export default App;
