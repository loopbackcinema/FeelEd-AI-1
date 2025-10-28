
import React, { useState } from 'react';
import { StoryInputForm } from './components/StoryInputForm';
import { StoryOutput } from './components/StoryOutput';
import { Loader } from './components/Loader';
import { Header } from './components/Header';
import { generateStoryAndAudio } from './services/geminiService';
import type { Story } from './types';
import { GRADES, LANGUAGES, EMOTIONS } from './constants';

const App: React.FC = () => {
  const [topic, setTopic] = useState<string>('');
  const [grade, setGrade] = useState<string>(GRADES[4]); // Default to Grade 5
  const [language, setLanguage] = useState<string>(LANGUAGES[0]); // Default to English
  const [emotion, setEmotion] = useState<string>(EMOTIONS[0]); // Default to Curious

  const [story, setStory] = useState<Story | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !grade || !language || !emotion) {
      setError('Please fill out all fields.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setStory(null);
    setAudioUrl(null);

    try {
      const result = await generateStoryAndAudio(topic, grade, language, emotion);
      setStory(result.story);
      setAudioUrl(result.audioUrl);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStory(null);
    setAudioUrl(null);
    setError(null);
    setTopic('');
  };

  const renderContent = () => {
    if (isLoading) {
      return <Loader />;
    }
    if (error) {
      return (
        <div className="text-center p-8 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-700 font-semibold">Oops! Something went wrong.</p>
          <p className="text-red-600 mt-2">{error}</p>
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
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 text-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Header />
        <main className="mt-8 bg-white/70 backdrop-blur-xl p-6 sm:p-10 rounded-3xl shadow-lg border border-gray-200/50">
          {renderContent()}
        </main>
        <footer className="text-center mt-12 pb-8">
            <p className="text-gray-500">Powered by Gemini AI</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
