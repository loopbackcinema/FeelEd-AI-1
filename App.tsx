import React, { useState, useEffect, useCallback } from 'react';
import { StoryInputForm } from './components/StoryInputForm';
import { StoryOutput } from './components/StoryOutput';
import { Loader } from './components/Loader';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LoginModal } from './components/LoginModal';
import { StudentApiKeyMessage } from './components/StudentApiKeyMessage';
import { generateStoryAndAudio } from './services/geminiService';
import type { Story, User } from './types';
import { AppError, APIError, NetworkError, StoryGenerationError, TTSError } from './types';
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
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  const [user, setUser] = useState<User | null>(null);
  
  // State is now initialized optimistically from localStorage to provide a
  // smoother experience on page reloads. It is still verified with the
  // aistudio environment.
  const [hasApiKey, setHasApiKey] = useState<boolean>(() => {
    try {
      return localStorage.getItem('feelEdApiKeySelected') === 'true';
    } catch {
      return false;
    }
  });

  const [isCheckingApiKey, setIsCheckingApiKey] = useState<boolean>(true);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);


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
      if (!window.aistudio) {
          console.warn("`window.aistudio` not available for API key check.");
          setHasApiKey(false);
          try { localStorage.removeItem('feelEdApiKeySelected'); } catch {}
          setIsCheckingApiKey(false);
          return;
      }
      try {
          const keySelected = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(keySelected);
          // Sync localStorage with the source of truth.
          if (keySelected) {
              localStorage.setItem('feelEdApiKeySelected', 'true');
          } else {
              localStorage.removeItem('feelEdApiKeySelected');
          }
      } catch (e) {
          console.error("Error checking API key status:", e);
          setHasApiKey(false);
          localStorage.removeItem('feelEdApiKeySelected');
      } finally {
          setIsCheckingApiKey(false);
      }
  }, []);

  useEffect(() => {
    // This effect runs to verify the API key status against the official source.
    if (user) {
        setIsCheckingApiKey(true);
        // The host environment might take a moment to inject the aistudio object.
        // We poll for it to be available before checking.
        if (window.aistudio) {
            checkApiKey();
        } else {
            const intervalId = setInterval(() => {
                if (window.aistudio) {
                    clearInterval(intervalId);
                    checkApiKey();
                }
            }, 100);
            // Cleanup interval if component unmounts
            return () => clearInterval(intervalId);
        }
    }
  }, [user, checkApiKey]);


  if (error) {
    // This will be caught by the nearest Error Boundary
    throw error;
  }
  
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
    } catch (e) {
      console.error("Failed to parse credential or save user session", e);
      setError(new Error("There was a problem signing you in. Please try again."));
    }
  };


  const handleLogout = () => {
    if (window.google) {
        window.google.accounts.id.disableAutoSelect();
    }
    // Clear all session-related data from storage.
    localStorage.removeItem('feelEdUser');
    localStorage.removeItem('feelEdApiKeySelected');
    setUser(null);
    setHasApiKey(false); // Reset state
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      setApiKeyError(null);
      try {
        await window.aistudio.openSelectKey();
        
        // After the dialog closes, re-verify and persist the selection status.
        const isKeyNowSelected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(isKeyNowSelected);
        if (isKeyNowSelected) {
            localStorage.setItem('feelEdApiKeySelected', 'true');
        } else {
            localStorage.removeItem('feelEdApiKeySelected');
        }
      } catch (e) {
        console.error("Error with select key dialog:", e);
        setHasApiKey(false);
        const keyError = new Error("Could not open the API key selection dialog. Please try again.");
        keyError.name = "UI Error";
        setError(keyError);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
        setShowLoginModal(true);
        return;
    }
    
    setApiKeyError(null); // Clear previous API key errors on a new submission.

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
    } catch (err: any) {
        console.error(err);

        // Special handling for invalid API keys to avoid the error boundary and show an inline message.
        if (err.message && (err.message.includes("API key not valid") || err.message.includes("provide an API key"))) {
            setHasApiKey(false); // Force the user to re-select a key.
            try {
              localStorage.removeItem('feelEdApiKeySelected');
            } catch {}
            setApiKeyError("Your selected API key is invalid or has been revoked. Please select a new, valid key to continue.");
        } else {
            // Handle all other errors with the main error boundary.
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
  };

  const handleReset = () => {
    setStory(null);
    setStreamingStory(null);
    setAudioUrl(null);
    setTopic('');
  };

  const renderContent = () => {
    if (isCheckingApiKey) {
        return <Loader />;
    }
    
    if (user && !hasApiKey) {
        if (userRole === 'Student') {
            return <StudentApiKeyMessage />;
        }
        return (
            <div className="flex flex-col items-center justify-center text-center animate-fade-in-up py-12">
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight">API Key Required</h2>
                <p className="mt-2 text-lg text-gray-600 max-w-md">
                    To use FeelEd AI, you need to select a Gemini API key for your project.
                </p>
                {apiKeyError && (
                    <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg max-w-md text-left text-sm" role="alert">
                        <p className="font-bold">Invalid API Key</p>
                        <p>{apiKeyError}</p>
                    </div>
                )}
                <p className="mt-4 text-sm text-gray-500 max-w-md">
                    This enables the app to use Google's generative models. Standard API usage rates apply. 
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline ml-1">Learn more about billing</a>.
                </p>
                <button
                    onClick={handleSelectKey}
                    className="mt-6 flex items-center justify-center gap-3 px-6 py-3 text-lg font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                    Select API Key
                </button>
            </div>
        );
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
            onClose={() => setShowLoginModal(false)}
        />
      )}
    </div>
  );
};

export default App;