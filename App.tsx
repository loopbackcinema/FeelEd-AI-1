import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StoryInputForm } from './components/StoryInputForm';
import { StoryOutput } from './components/StoryOutput';
import { Loader } from './components/Loader';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LoginModal } from './components/LoginModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { StudentApiKeyMessage } from './components/StudentApiKeyMessage';
import { generateStory, generateAudio } from './services/geminiService';
// FIX: The AIStudio global type is now declared in types.ts to prevent conflicts.
import type { Story, User } from './types';
import { AppError, APIError, NetworkError, StoryGenerationError, TTSError } from './types';
import { GRADES, LANGUAGES, EMOTIONS, USER_ROLES, TTS_VOICES } from './constants';

interface GoogleJwtPayload {
  email: string;
  name: string;
  picture: string;
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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [view, setView] = useState<'form' | 'output'>('form');
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');

  const [user, setUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [guestStoryCount, setGuestStoryCount] = useState<number>(
    () => Number(localStorage.getItem('guestStoryCount') || 0)
  );
  
  const wasLoginTriggeredBySubmit = useRef<boolean>(false);
  
  // --- New state for API Key Management ---
  const [isApiKeyReady, setIsApiKeyReady] = useState<boolean>(false);
  const [isKeyCheckInProgress, setIsKeyCheckInProgress] = useState<boolean>(true);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const wasStoryGenPendingApiKey = useRef<boolean>(false);

  useEffect(() => {
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
  
  useEffect(() => {
    const checkApiKey = async () => {
        setIsKeyCheckInProgress(true);
        setApiKeyError(null);

        if (typeof window.aistudio === 'undefined') {
            // If the AI Studio environment is not detected, we assume the API key is
            // configured on the backend (e.g., via Vercel environment variables).
            // We bypass the interactive client-side check.
            setIsApiKeyReady(true);
            setIsKeyCheckInProgress(false);
            return;
        }

        // If in the AI Studio environment, perform the standard check.
        try {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setIsApiKeyReady(hasKey);
        } catch (e) {
            console.error("Error checking for API key:", e);
            setApiKeyError("An error occurred while checking your API key status.");
        } finally {
            setIsKeyCheckInProgress(false);
        }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  if (error) {
    throw error;
  }

  const startStoryGeneration = useCallback(async () => {
    setView('output');
    setIsLoading(true);
    setStory(null);
    setAudioUrl(null);
    setApiKeyError(null); // Clear previous key errors on a new attempt
    setAudioState('loading');

    try {
      // Step 1: Generate the critical story text first.
      const { story: generatedStory, storyMarkdown } = await generateStory(topic, grade, language, emotion, userRole);
      setStory(generatedStory);
      
      if (!user) {
          const newCount = guestStoryCount + 1;
          setGuestStoryCount(newCount);
          localStorage.setItem('guestStoryCount', String(newCount));
      }
      
      // Step 2: Generate audio.
      const audioPromise = generateAudio(storyMarkdown, voice).then(url => {
          setAudioUrl(url);
          setAudioState(url ? 'success' : 'failed');
      });
      
      // Wait for non-critical assets to finish before setting isLoading to false.
      await audioPromise;

    } catch (err: any) {
        console.error(err);
        let title = "An Unexpected Error Occurred";
        let message = "Something went wrong. Please try again.";

        setAudioState('failed');

        if (err instanceof AppError) {
            message = err.message;
            if (err instanceof APIError && (message.includes('not configured') || message.toLowerCase().includes('api key'))) {
                setIsApiKeyReady(false);
                setApiKeyError(message);
                setView('form'); // Go back to form to show API key modal
                setIsLoading(false);
                return;
            }
            if (err instanceof NetworkError) title = "Network Connection Error";
            else if (err instanceof APIError) title = "AI Service Error";
            else if (err instanceof StoryGenerationError) title = "Story Generation Failed";
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
        // Re-trigger the submit logic after successful login
        handleSubmit(new Event('submit', { cancelable: true }) as unknown as React.FormEvent);
    }
  }, [user, startStoryGeneration]);

  const handleSelectKey = async () => {
      if (window.aistudio) {
          setApiKeyError(null);
          try {
              await window.aistudio.openSelectKey();
              setIsApiKeyReady(true);
              if (wasStoryGenPendingApiKey.current) {
                  wasStoryGenPendingApiKey.current = false;
                  handleSubmit(new Event('submit') as unknown as React.FormEvent<HTMLFormElement>);
              }
          } catch (e) {
              console.error("Error or dismissal during API key selection:", e);
          }
      } else {
        console.error("handleSelectKey called without aistudio environment.");
        setApiKeyError("Cannot open API key selector: AI Studio environment not found.");
      }
  };

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
    if (!topic.trim()) {
        const formError = new Error("Please enter a topic to generate a story.");
        formError.name = "Incomplete Form";
        setError(formError);
        return;
    }
    if (!user && guestStoryCount >= 1) {
      wasLoginTriggeredBySubmit.current = true;
      setShowLoginModal(true);
      return;
    }
    if (!isApiKeyReady) {
        wasStoryGenPendingApiKey.current = true;
        handleSelectKey();
        return;
    }
    startStoryGeneration();
  };

  const handleReset = () => {
    setStory(null);
    setAudioUrl(null);
    setTopic('');
    setAudioState('idle');
    setView('form');
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
      
      {!isApiKeyReady && !isKeyCheckInProgress && userRole !== 'Student' && (
        <ApiKeyModal 
          handleSelectKey={handleSelectKey}
          apiKeyError={apiKeyError}
        />
      )}
    </div>
  );
};

export default App;