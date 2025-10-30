import React, { useState, useEffect } from 'react';
import { StoryInputForm } from './StoryInputForm';
import { StoryOutput } from './StoryOutput';
import { Loader } from './Loader';
import { Header } from './Header';
import { Footer } from './Footer';
import { LoginModal } from './LoginModal';
import { ApiKeyModal } from './ApiKeyModal';
import { StudentApiKeyMessage } from './StudentApiKeyMessage';
import { useApiKey } from '../hooks/useApiKey';
import { useStoryGenerator } from '../hooks/useStoryGenerator';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../types';
import { GRADES, LANGUAGES, EMOTIONS, USER_ROLES, TTS_VOICES } from '../constants';

interface MainScreenProps {
  user: User | null;
  onLogout: () => void;
}

export const MainScreen: React.FC<MainScreenProps> = ({ user, onLogout }) => {
  const { hasStoryCredit, useStoryCredit } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Form State
  const [topic, setTopic] = useState<string>('');
  const [grade, setGrade] = useState<string>(GRADES[4]);
  const [language, setLanguage] = useState<string>(LANGUAGES[0]);
  const [emotion, setEmotion] = useState<string>(EMOTIONS[0]);
  const [userRole, setUserRole] = useState<string>(USER_ROLES[0]);
  const [voice, setVoice] = useState<string>(TTS_VOICES[0].id);

  const {
    isApiKeyReady,
    isKeyCheckInProgress,
    apiKeyError,
    showApiKeyModal,
    handleSelectKey,
    setApiKeyError,
  } = useApiKey(userRole);

  const {
    story,
    audioUrl,
    isLoading,
    view,
    audioState,
    startStoryGeneration,
    handleReset: resetStory,
  } = useStoryGenerator(useStoryCredit);
  
  const handleReset = () => {
    setTopic('');
    resetStory();
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    if (!hasStoryCredit()) {
        setShowLoginModal(true);
        return;
    }

    if (!isApiKeyReady) {
      const success = await handleSelectKey();
      if (success) {
         // Retry submission after key is selected
         await startStoryGeneration(topic, grade, language, emotion, userRole, voice);
      }
      return;
    }

    const result = await startStoryGeneration(topic, grade, language, emotion, userRole, voice);
    
    if (result.requiresApiKey) {
        setApiKeyError("An API Key is required to generate stories.");
        await handleSelectKey();
    }
  };

  const renderContent = () => {
    if (isKeyCheckInProgress) {
      return <Loader />;
    }
    if (!isApiKeyReady && userRole === 'Student') {
      return <StudentApiKeyMessage />;
    }
    if (view === 'output') {
      return <StoryOutput story={story} audioUrl={audioUrl} onReset={handleReset} isLoading={isLoading} audioState={audioState} />;
    }
    return (
      <StoryInputForm
        topic={topic}
        setTopic={setTopic}
        grade={grade}
        setGrade={setGrade}
        language={language}
        setLanguage={setLanguage}
        emotion={emotion}
        setEmotion={setEmotion}
        userRole={userRole}
        setUserRole={setUserRole}
        voice={voice}
        setVoice={setVoice}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 text-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Header user={user} onLogout={onLogout} />
        <main className="mt-4 bg-white/70 backdrop-blur-xl p-6 sm:p-10 rounded-3xl shadow-lg border border-gray-200/50">
          {renderContent()}
        </main>
        <Footer />
      </div>
      
      {showLoginModal && (
        <LoginModal 
            onLoginSuccess={() => { /* Handled by useAuth */ }}
            onDismiss={() => setShowLoginModal(false)}
        />
      )}
      
      {showApiKeyModal && (
        <ApiKeyModal 
          handleSelectKey={handleSelectKey}
          apiKeyError={apiKeyError}
        />
      )}
    </div>
  );
};
