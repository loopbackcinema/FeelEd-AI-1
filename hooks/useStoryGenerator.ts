import { useState, useCallback } from 'react';
import { generateStory, generateAudio } from '../services/geminiService';
import type { Story } from '../types';
import { AppError, APIError, NetworkError, StoryGenerationError } from '../types';

export const useStoryGenerator = (useStoryCredit: () => void) => {
  const [story, setStory] = useState<Story | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [view, setView] = useState<'form' | 'output'>('form');
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');

  const startStoryGeneration = useCallback(async (
    topic: string, 
    grade: string, 
    language: string, 
    emotion: string, 
    userRole: string, 
    voice: string
  ): Promise<{ success: boolean; requiresApiKey?: boolean }> => {
    setView('output');
    setIsLoading(true);
    setStory(null);
    setAudioUrl(null);
    setError(null);
    setAudioState('loading');

    try {
      const { story: generatedStory, storyMarkdown } = await generateStory(topic, grade, language, emotion, userRole);
      setStory(generatedStory);
      
      useStoryCredit(); // Consume a credit now that the story is successfully generated

      // Generate audio, but don't block the UI from showing the story
      generateAudio(storyMarkdown, voice).then(url => {
          setAudioUrl(url);
          setAudioState(url ? 'success' : 'failed');
      });

      setIsLoading(false);
      return { success: true };

    } catch (err: any) {
      console.error(err);
      let title = "An Unexpected Error Occurred";
      let message = "Something went wrong. Please try again.";

      setAudioState('failed');
      setIsLoading(false);
      setView('form'); // Go back to form on error

      if (err instanceof AppError) {
        message = err.message;
        if (err instanceof APIError && (message.includes('not configured') || message.toLowerCase().includes('api key'))) {
            // Signal that an API key is needed
            return { success: false, requiresApiKey: true };
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
      return { success: false };
    }
  }, [useStoryCredit]);

  const handleReset = useCallback(() => {
    setStory(null);
    setAudioUrl(null);
    setAudioState('idle');
    setView('form');
    setError(null);
  }, []);
  
  // Custom hook to re-throw error for ErrorBoundary
  if (error) {
    throw error;
  }

  return {
    story,
    audioUrl,
    isLoading,
    view,
    audioState,
    startStoryGeneration,
    handleReset,
  };
};
