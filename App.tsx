import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StoryInputForm } from './components/StoryInputForm';
import { StoryOutput } from './components/StoryOutput';
import { Loader } from './components/Loader';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LoginModal } from './components/LoginModal';
import { StudentApiKeyMessage } from './components/StudentApiKeyMessage';
import { ApiKeyModal } from './components/ApiKeyModal';
import { generateStoryAndAudio } from './services/geminiService';
import type { Story, User } from './types';
import { AppError, APIError, NetworkError, StoryGenerationError, TTSError, InvalidApiKeyError } from './types';
import { GRADES, LANGUAGES, EMOTIONS, USER_ROLES } from './constants';

interface GoogleJwtPayload {
  email: string;
  name: string;
  picture: string;
}

// Fix: Resolved TypeScript global type conflict by defining and using a consistent 'AIStudio' interface.
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
    interface Window {
        google: any;
        aistudio?: AIStudio;
    }
}

const App: React.FC = () => {
  const [topic, setTopic] = useState<string>('');
  const [grade, setGrade] = useState<string>(GRADES[4]); // Default to Grade 5
  const [language, setLanguage] = useState<string>(LANGUAGES[0]); // Default to English
  const [emotion, setEmotion] = useState<string>(EMOTIONS[0]); // Default to Curious
  const [userRole, setUserRole] = useState<string>(USER_ROLES[0]); // Default to Teacher

  const [story, setStory] = useState<Story | null>(null);
  const [streamingStory, setStreamingStory] = useState<Partial<Story> | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [guestStoryCount, setGuestStoryCount] = useState<number>(
    () => Number(localStorage.getItem('guestStoryCount') || 0)
  );
  
  // The API key state now leverages sessionStorage for persistence within a session.
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState<boolean>(true);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [envError, setEnvError] = useState<string | null>(null);
  const wasLoginTriggeredBySubmit = useRef<boolean>(false);
  const wasKeyJustSelected = useRef<boolean>(false);


  useEffect(() => {
    // Check for persisted user session
    try {
      const storedUser = localStorage.getItem('feelEdUser');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        // If there's no user, we don't need to check for a key.
        setIsCheckingApiKey(false);
      }
    } catch (e) {
      console.error("Failed to parse user session, clearing storage.", e);
      localStorage.removeItem('feelEdUser');
      setIsCheckingApiKey(false);
    }
  }, []);

  const checkApiKey = useCallback(async () => {
      // Trust sessionStorage first to avoid unnecessary checks and race conditions.
      if (sessionStorage.getItem('apiKeySelected') === 'true') {
          setHasApiKey(true);
          setIsCheckingApiKey(false);
          return;
      }

      if (!window.aistudio) {
          console.warn("`window.aistudio` not available for API key check.");
          setHasApiKey(false);
          setIsCheckingApiKey(false);
          return;
      }
      try {
          const keySelected = await window.aistudio.hasSelectedApiKey();
          if (keySelected) {
              sessionStorage.setItem('apiKeySelected', 'true');
          }
          setHasApiKey(keySelected);
      } catch (e) {
          console.error("Error checking API key status:", e);
          setHasApiKey(false);
      } finally {
          setIsCheckingApiKey(false);
      }
  }, []);

  useEffect(() => {
    // This effect verifies the API key status, with a timeout to prevent an infinite loading loop.
    if (user) {
        setIsCheckingApiKey(true);
        setEnvError(null);
        let intervalId: number | undefined;
        let timeoutId: number | undefined;

        const cleanup = () => {
            if (intervalId) clearInterval(intervalId);
            if (timeoutId) clearTimeout(timeoutId);
        };

        if (window.aistudio) {
            checkApiKey();
        } else {
            intervalId = window.setInterval(() => {
                if (window.aistudio) {
                    cleanup();
                    checkApiKey();
                }
            }, 100);

            timeoutId = window.setTimeout(() => {
                cleanup();
                console.error("window.aistudio failed to initialize within 5 seconds.");
                setEnvError("Could not connect to the AI Studio environment. Please try refreshing the page.");
                setHasApiKey(false);
                setIsCheckingApiKey(false);
            }, 5000); // 5-second timeout
        }

        return cleanup;
    }
  }, [user, checkApiKey]);


  if (error) {
    // This will be caught by the nearest Error Boundary
    throw error;
  }

  const startStoryGeneration = useCallback(async () => {
    setApiKeyError(null);
    setEnvError(null);

    if (!topic.trim() || !grade || !language || !emotion || !userRole) {
        const formError = new Error("Please fill out all fields before generating a story.");
        formError.name = "Incomplete Form";
        setError(formError);
        return;
    }
    
    setIsLoading(true);
    setStory(null);
    setAudioUrl(null);
    setStreamingStory({});

    try {
      const handleStoryUpdate = (partialStory: Partial<Story>) => {
        setStreamingStory(prev => ({ ...prev, ...partialStory }));
      };

      const result = await generateStoryAndAudio(topic, grade, language, emotion, userRole, handleStoryUpdate);
      setStory(result.story);
      setAudioUrl(result.audioUrl);
      
      if (!user) {
          const newCount = guestStoryCount + 1;
          setGuestStoryCount(newCount);
          localStorage.setItem('guestStoryCount', String(newCount));
      }

    } catch (err: any) {
        console.error(err);

        if (err instanceof InvalidApiKeyError) {
            sessionStorage.removeItem('apiKeySelected'); // Clear session state on invalid key
            setHasApiKey(false); // Force the user to re-select a key.
            setApiKeyError(err.message);
        } else {
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
        }
        
    } finally {
      setIsLoading(false);
      setStreamingStory(null);
    }
  }, [topic, grade, language, emotion, userRole, user, guestStoryCount]);
  
  useEffect(() => {
    if (user && wasLoginTriggeredBySubmit.current) {
        wasLoginTriggeredBySubmit.current = false;
        // Ensure key is checked before auto-starting generation
        if (hasApiKey || userRole === 'Student') {
            startStoryGeneration();
        }
    }
  }, [user, startStoryGeneration, hasApiKey, userRole]);

  useEffect(() => {
    // This effect triggers story generation after a user successfully selects an API key
    // from the modal, ensuring a seamless continuation of their intended action.
    if (wasKeyJustSelected.current && hasApiKey && topic.trim() && !isLoading) {
      wasKeyJustSelected.current = false; // Reset the flag to prevent re-triggering
      startStoryGeneration();
    }
  }, [hasApiKey, topic, startStoryGeneration, isLoading]);

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
    sessionStorage.removeItem('apiKeySelected'); // Clear API key session state
    setUser(null);
    setGuestStoryCount(0);
    setHasApiKey(false);
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      setApiKeyError(null);
      setEnvError(null);
      try {
        // This promise resolves when the user closes the selection dialog.
        await window.aistudio.openSelectKey();
        
        // Optimistically assume success to avoid race conditions.
        // The API call will fail later if no key was actually selected,
        // which is handled by the InvalidApiKeyError catch block.
        setHasApiKey(true);
        sessionStorage.setItem('apiKeySelected', 'true');

        // If the user already has a topic, flag for immediate generation.
        if (topic.trim()) {
          wasKeyJustSelected.current = true;
        }
      } catch (e) {
        console.error("Error with select key dialog:", e);
        setHasApiKey(false); // Ensure we reflect the failed state
        const keyError = new Error("Could not open the API key selection dialog. Please try again.");
        keyError.name = "UI Error";
        setError(keyError);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user && guestStoryCount >= 1) {
      wasLoginTriggeredBySubmit.current = true;
      setShowLoginModal(true);
      return;
    }
    
    if (user && userRole !== 'Student' && !hasApiKey) {
      // The modal is already showing, so clicking the disabled generate button does nothing.
      // This check is a safeguard.
      return;
    }

    startStoryGeneration();
  };

  const handleReset = () => {
    setStory(null);
    setStreamingStory(null);
    setAudioUrl(null);
    setTopic('');
  };

  const renderContent = () => {
    if (isCheckingApiKey && user) {
      return <Loader />;
    }

    if (user && !hasApiKey && userRole === 'Student') {
      return <StudentApiKeyMessage />;
    }

    if (isLoading) {
      if (streamingStory && Object.keys(streamingStory).length > 0) {
        return <StoryOutput story={streamingStory} audioUrl={null} onReset={handleReset} isStreaming={true} />;
      }
      return <Loader />;
    }

    if (story && audioUrl) {
      return <StoryOutput story={story} audioUrl={audioUrl} onReset={handleReset} />;
    }

    const isFormDisabled = isLoading || (!!user && !hasApiKey && userRole !== 'Student');

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
        onSubmit={handleSubmit}
        isLoading={isFormDisabled}
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

      {user && !hasApiKey && userRole !== 'Student' && !isCheckingApiKey && (
        <ApiKeyModal 
            handleSelectKey={handleSelectKey} 
            apiKeyError={apiKeyError}
            envError={envError}
        />
      )}
    </div>
  );
};

export default App;