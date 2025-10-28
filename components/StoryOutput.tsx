import React from 'react';
import type { Story } from '../types';

interface StoryOutputProps {
  story: Partial<Story>;
  audioUrl: string | null;
  onReset: () => void;
  isStreaming?: boolean;
}

const StorySection: React.FC<{ title: string; content?: string }> = ({ title, content }) => (
  <div className="bg-white/50 p-6 rounded-2xl backdrop-blur-sm border border-white/30 min-h-[120px]">
    <h3 className="text-xl font-bold text-purple-800 mb-3">{title}</h3>
    {content ? (
        <p className="text-gray-700 leading-relaxed text-base whitespace-pre-wrap">{content}</p>
    ) : (
        <div className="space-y-3 pt-1">
            <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
        </div>
    )}
  </div>
);


export const StoryOutput: React.FC<StoryOutputProps> = ({ story, audioUrl, onReset, isStreaming = false }) => {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-gray-800 tracking-tight">{story.title || 'Generating Title...'}</h2>
        {story.emotion_tone && <p className="mt-2 text-lg text-indigo-600 font-medium">{story.emotion_tone} Story</p>}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 sticky top-4 z-10">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 text-center">Listen to the Story</h3>
        {audioUrl ? (
            <audio controls src={audioUrl} className="w-full">
            Your browser does not support the audio element.
            </audio>
        ) : (
            <div className="flex items-center justify-center space-x-3 py-2">
                 <div className="w-4 h-4 bg-gray-300 rounded-full animate-pulse"></div>
                 <div className="w-4 h-4 bg-gray-300 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                 <div className="w-4 h-4 bg-gray-300 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                 <p className="text-gray-500">Generating narration...</p>
            </div>
        )}
      </div>

      <div className="space-y-6">
        <StorySection title="Introduction" content={story.introduction} />
        <StorySection title="Emotional Trigger" content={story.emotional_trigger} />
        <StorySection title="Concept Explanation" content={story.concept_explanation} />
        <StorySection title="Resolution" content={story.resolution} />
        <StorySection title="Moral of the Story" content={story.moral_message} />
      </div>

      <div className="pt-4 text-center">
        <button
          onClick={onReset}
          disabled={isStreaming}
          className="px-8 py-3 text-lg font-semibold text-indigo-600 bg-white border-2 border-indigo-600 rounded-xl hover:bg-indigo-50 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStreaming ? 'Generating...' : 'Create Another Story'}
        </button>
      </div>
    </div>
  );
};