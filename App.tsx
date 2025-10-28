import React, { useState, useEffect } from 'react';
import { StoryInputForm } from './components/StoryInputForm';
import { StoryOutput } from './components/StoryOutput';
import { Loader } from './components/Loader';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { generateStoryAndAudio } from './services/geminiService';
import type { Story } from './types';
import { AppError, APIError, NetworkError, StoryGenerationError, TTSError } from './types';
import { GRADES, LANGUAGES, EMOTIONS, USER_ROLES } from './constants';

// Mock User Type
interface User {
  name: string;
  email: string;
  picture: string;
}

const App: React.FC = () => {
  const [topic, setTopic] = useState<string>('');
  const [grade, setGrade] = useState<string>(GRADES[4]); // Default to Grade 5
  const [language, setLanguage] = useState<string>(LANGUAGES[0]); // Default to English
  const [emotion, setEmotion] = useState<string>(EMOTIONS[0]); // Default to Curious
  const [userRole, setUserRole] = useState<string>(USER_ROLES[1]); // Default to Student

  const [story, setStory] = useState<Story | null>(null);
  const [streamingStory, setStreamingStory] = useState<Partial<Story> | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    // Check for persisted user session
    try {
      const storedUser = localStorage.getItem('feelEdUser');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
      localStorage.removeItem('feelEdUser');
    }

    // Check for API key
    const aistudio = (window as any).aistudio;
    if (aistudio && typeof aistudio.hasSelectedApiKey === 'function') {
      aistudio.hasSelectedApiKey().then((selected: boolean) => {
        setHasApiKey(selected);
      });
    } else {
      // If the aistudio object isn't available, we assume the key is directly injected.
      // If API calls fail later, our error handling will catch it.
      setHasApiKey(true);
    }
  }, []);

  if (error) {
    // This will be caught by the nearest Error Boundary
    throw error;
  }

  const handleSelectKey = async () => {
    try {
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.openSelectKey === 'function') {
        await aistudio.openSelectKey();
        // Assume success and update UI immediately for responsiveness.
        setHasApiKey(true);
      } else {
        throw new Error("API key selection mechanism is not available.");
      }
    } catch (e) {
      console.error("Could not open API key selection:", e);
      const newError = new Error("The API key selection feature is not available. Please ensure you are running in a supported environment.");
      newError.name = "Configuration Error";
      setError(newError);
    }
  };


  const handleLogin = () => {
    // This is a mock login. In a real app, this would involve an OAuth flow.
    const mockUser = {
      name: 'Alex Doe',
      email: 'alex.doe@example.com',
      picture: 'https://i.pravatar.cc/150?u=alexdoe' // Using a placeholder image service
    };
    setUser(mockUser);
    localStorage.setItem('feelEdUser', JSON.stringify(mockUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('feelEdUser');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        
        // Handle API key errors by showing the selection prompt, not by crashing.
        if (typeof err.message === 'string' &&
            (err.message.includes("API Key must be set") || err.message.includes("Requested entity was not found"))) {
            setHasApiKey(false); // Reset key state to re-prompt user
        } else {
            // For all other errors, create a new Error object and set it in state.
            // The next render will throw this, triggering the Error Boundary.
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
    if (hasApiKey === null) {
      return (
        <div className="flex justify-center items-center p-10">
          <div className="w-8 h-8 border-2 border-t-2 border-t-purple-600 border-gray-200 rounded-full animate-spin"></div>
          <p className="ml-4 text-gray-600">Initializing...</p>
        </div>
      );
    }
    
    if (hasApiKey === false) {
      return (
        <div className="text-center p-8 bg-indigo-50 border border-indigo-200 rounded-xl animate-fade-in-up">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-6 w-6 text-indigo-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
            </svg>
          </div>
          <h3 className="mt-4 text-xl font-semibold text-indigo-800">API Key Required</h3>
          <p className="text-indigo-700 mt-2 max-w-md mx-auto">
            To use FeelEd AI, please select your Gemini API key. Your key is stored securely and only used while you're on this page. For more information on API keys and billing, see the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-indigo-900">official documentation</a>.
          </p>
          <button
            onClick={handleSelectKey}
            className="mt-6 px-6 py-2 text-base font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
        <Header user={user} onLogin={handleLogin} onLogout={handleLogout} />
        <main className="mt-4 bg-white/70 backdrop-blur-xl p-6 sm:p-10 rounded-3xl shadow-lg border border-gray-200/50">
          {renderContent()}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default App;