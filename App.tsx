
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StoryInputForm } from './components/StoryInputForm';
import { StoryOutput } from './components/StoryOutput';
import { Loader } from './components/Loader';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LoginModal } from './components/LoginModal';
import { generateStory, generateAudio, generateImage } from './services/geminiService';
import type { Story, User } from './types';
import { AppError, APIError, NetworkError, StoryGenerationError, TTSError } from './types';
import { GRADES, LANGUAGES, EMOTIONS, USER_ROLES, TTS_VOICES } from './constants';

interface GoogleJwtPayload {
  email: string;
  name: string;
  picture: string;
}

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
    if (!topic.trim()) {
        const formError = new Error("Please enter a topic to generate a story.");
        formError.name = "Incomplete Form";
        setError(formError);
        return;
    }
    
    setIsLoading(true);
    setStory(null);
    setAudioUrl(null);
    setImageUrl(null);

    try {
      // Step 1: Generate the critical story text first.
      const { story: generatedStory, storyMarkdown } = await generateStory(topic, grade, language, emotion, userRole);
      
      // We have the core content! Stop the main loader and display the story.
      setIsLoading(false);
      setStory(generatedStory);
      
      if (!user) {
          const newCount = guestStoryCount + 1;
          setGuestStoryCount(newCount);
          localStorage.setItem('guestStoryCount', String(newCount));
      }
      
      // Step 2 & 3: Generate audio and image in the background.
      // These are non-blocking and will update the UI when they are ready.
      generateAudio(storyMarkdown, voice).then(audioUrlResult => {
          setAudioUrl(audioUrlResult);
      }).catch(audioError => {
          console.warn("Failed to generate audio, but story is available:", audioError);
          setAudioUrl(null);
      });
      
      generateImage(generatedStory.title, generatedStory.introduction).then(imageUrlResult => {
          setImageUrl(imageUrlResult);
      }).catch(imageError => {
          console.warn("Failed to generate image, but story is available:", imageError);
          setImageUrl(null);
      });

    } catch (err: any) {
        console.error(err);
        let title = "An Unexpected Error Occurred";
        let message = "Something went wrong. Please try again.";

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
        setIsLoading(false); // Ensure loader stops on critical error.
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
    // Show loader only during the initial, critical text fetch.
    if (isLoading) {
      return <Loader />;
    }

    // Once story is available, show it. Audio/image will load in when ready.
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