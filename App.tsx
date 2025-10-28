
import React, { useState } from 'react';
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

interface ErrorState {
  title: string;
  message: string;
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
  const [error, setError] = useState<ErrorState | null>(null);

  const [user, setUser] = useState<User | null>(null);

  const handleLogin = () => {
    // This is a mock login. In a real app, this would involve an OAuth flow.
    setUser({
      name: 'Alex Doe',
      email: 'alex.doe@example.com',
      picture: 'https://i.pravatar.cc/150?u=alexdoe' // Using a placeholder image service
    });
  };

  const handleLogout = () => {
    setUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !grade || !language || !emotion || !userRole) {
      setError({ title: "Incomplete Form", message: "Please fill out all fields before generating a story." });
      return;
    }
    
    setIsLoading(true);
    setError(null);
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
      let title = "An Unexpected Error Occurred";
      let message = "Something went wrong. Please try again. If the problem persists, contact support.";

      if (err instanceof AppError) {
        message = err.message;
        if (err instanceof NetworkError) title = "Network Connection Error";
        else if (err instanceof APIError) title = "AI Service Error";
        else if (err instanceof StoryGenerationError) title = "Story Generation Failed";
        else if (err instanceof TTSError) title = "Audio Narration Failed";
      }
      
      setError({ title, message });

    } finally {
      setIsLoading(false);
      setStreamingStory(null);
    }
  };

  const handleReset = () => {
    setStory(null);
    setStreamingStory(null);
    setAudioUrl(null);
    setError(null);
    setTopic('');
  };

  const renderContent = () => {
    if (isLoading) {
      if (streamingStory && Object.keys(streamingStory).length > 0) {
        return <StoryOutput story={streamingStory} audioUrl={null} onReset={handleReset} isStreaming={true} />;
      }
      return <Loader />;
    }
    if (error) {
      return (
        <div className="text-center p-8 bg-red-50 border border-red-200 rounded-xl animate-fade-in-up">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="mt-4 text-xl font-semibold text-red-800">{error.title}</h3>
          <p className="text-red-600 mt-2 max-w-md mx-auto">{error.message}</p>
          <button
            onClick={handleReset}
            className="mt-6 px-6 py-2 text-base font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Try Again
          </button>
        </div>
      );
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
