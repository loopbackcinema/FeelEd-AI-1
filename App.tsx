

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StoryInputForm } from './components/StoryInputForm';
import { StoryOutput } from './components/StoryOutput';
import { Loader } from './components/Loader';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LoginModal } from './components/LoginModal';
import { generateStoryAndAudio } from './services/geminiService';
import type { Story, User } from './types';
import { AppError, APIError, NetworkError, StoryGenerationError, TTSError } from './types';
import { GRADES, LANGUAGES, EMOTIONS, USER_ROLES, TTS_VOICES } from './constants';

interface GoogleJwtPayload {
  email: string;
  name: string;
  picture: string;
}

// The window.aistudio and API key logic are no longer needed.
declare global {
    interface Window {
        google: any;
    }
}

const App: React.FC = () => {
  const [topic, setTopic] = useState<string>('');
  const [grade, setGrade] = useState<string>(GRADES[4]); // Default to Grade 5
  const [language, setLanguage] = useState<string>(LANGUAGES[0]); // Default to English
  const [emotion, setEmotion] = useState<string>(EMOTIONS[0]); // Default to Curious
  const [userRole, setUserRole] = useState<string>(USER_ROLES[0]); // Default to Teacher
  const [voice, setVoice] = useState<string>(TTS_VOICES[0].id); // Default to first voice

  const [story, setStory] = useState<Story | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [guestStoryCount, setGuestStoryCount] = useState<number>(
    () => Number(localStorage.getItem('guestStoryCount') || 0)
  );
  
  const wasLoginTriggeredBySubmit = useRef<boolean>(false);

  useEffect(() => {
    // Check for persisted user session
    try {
      const storedUser = localStorage.getItem('feelEdUser');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error("Failed to parse user session, clearing storage.", e);
      localStorage.removeItem('feelEdUser');
    }
  }, []);

  if (error) {
    // This will be caught by the nearest Error Boundary
    throw error;
  }

  const startStoryGeneration = useCallback(async () => {
    if (!topic.trim() || !grade || !language || !emotion || !userRole) {
        const formError = new Error("Please fill out all fields before generating a story.");
        formError.name = "Incomplete Form";
        setError(formError);
        return;
    }
    
    setIsLoading(true);
    setStory(null);
    setAudioUrl(null);
    setImageUrl(null);

    try {
      // The streaming callback is no longer needed with the BFF architecture.
      const result = await generateStoryAndAudio(topic, grade, language, emotion, userRole, voice);
      setStory(result.story);
      setAudioUrl(result.audioUrl);
      setImageUrl(result.imageUrl);
      
      if (!user) {
          const newCount = guestStoryCount + 1;
          setGuestStoryCount(newCount);
          localStorage.setItem('guestStoryCount', String(newCount));
      }

    } catch (err: any) {
        console.error(err);

        let title = "An Unexpected Error Occurred";
        let message = "Something went wrong. Please try again. If the problem persists, contact support.";

        if (err instanceof AppError) {
            message = err.message;
            if (err instanceof NetworkError) title = "Network Connection Error";
            else if (err instanceof APIError) title = "AI Service Error";
            else if (err instanceof StoryGenerationError) title = "Story Generation Failed";
            else if (err instanceof TTSError) title = "Audio Narration Failed";
        } else if (err.message) {
            message = err.message;
        }

        const appError = new Error(message);
        appError.name = title;
        setError(appError);
        
    } finally {
      setIsLoading(false);
    }
  }, [topic, grade, language, emotion, userRole, voice, user, guestStoryCount]);
  
  useEffect(() => {
    if (user && wasLoginTriggeredBySubmit.current) {
        wasLoginTriggeredBySubmit.current = false;
        startStoryGeneration();
    }
  }, [user, startStoryGeneration]);

  const handleLoginSuccess = (credential: string) => {
    try {
      const payload: GoogleJwtPayload = JSON.parse(atob(credential.split('.')[1]));
      const newUser: User = {
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
      };
      localStorage.setItem('feelEdUser', JSON.stringify(newUser));
      setUser(newUser);
      setShowLoginModal(false);
      setGuestStoryCount(0);
      localStorage.removeItem('guestStoryCount');
    } catch (e) {
      console.error("Failed to parse credential or save user session", e);
      setError(new Error("There was a problem signing you in. Please try again."));
    }
  };


  const handleLogout = () => {
    if (window.google) {
        window.google.accounts.id.disableAutoSelect();
    }
    localStorage.removeItem('feelEdUser');
    localStorage.removeItem('guestStoryCount');
    setUser(null);
    setGuestStoryCount(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user && guestStoryCount >= 1) {
      wasLoginTriggeredBySubmit.current = true;
      setShowLoginModal(true);
      return;
    }
    
    startStoryGeneration();
  };

  const handleReset = () => {
    setStory(null);
    setAudioUrl(null);
    setImageUrl(null);
    setTopic('');
  };

  const renderContent = () => {
    if (isLoading) {
      return <Loader />;
    }

    if (story) {
      return <StoryOutput story={story} audioUrl={audioUrl} imageUrl={imageUrl} onReset={handleReset} />;
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
        <Header user={user} onLogout={handleLogout} />
        <main className="mt-4 bg-white/70 backdrop-blur-xl p-6 sm:p-10 rounded-3xl shadow-lg border border-gray-200/50">
          {renderContent()}
        </main>
        <Footer />
      </div>
      
      {showLoginModal && (
        <LoginModal 
            onLoginSuccess={handleLoginSuccess}
            onDismiss={() => setShowLoginModal(false)}
        />
      )}
    </div>
  );
};

export default App;