
import React from 'react';
import type { Story } from '../types';

interface StoryOutputProps {
  story: Story;
  audioUrl: string;
  onReset: () => void;
}

const StorySection: React.FC<{ title: string; content: string }> = ({ title, content }) => (
  <div className="bg-white/50 p-6 rounded-2xl backdrop-blur-sm border border-white/30">
    <h3 className="text-xl font-bold text-purple-800 mb-3">{title}</h3>
    <p className="text-gray-700 leading-relaxed text-base">{content}</p>
  </div>
);

export const StoryOutput: React.FC<StoryOutputProps> = ({ story, audioUrl, onReset }) => {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-gray-800 tracking-tight">{story.title}</h2>
        <p className="mt-2 text-lg text-indigo-600 font-medium">{story.emotion_tone} Story</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 sticky top-4 z-10">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 text-center">Listen to the Story</h3>
        <audio controls src={audioUrl} className="w-full">
          Your browser does not support the audio element.
        </audio>
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
          className="px-8 py-3 text-lg font-semibold text-indigo-600 bg-white border-2 border-indigo-600 rounded-xl hover:bg-indigo-50 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-all duration-300 transform hover:scale-105"
        >
          Create Another Story
        </button>
      </div>
    </div>
  );
};
