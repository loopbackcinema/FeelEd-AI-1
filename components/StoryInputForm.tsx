import React from 'react';
import { GRADES, LANGUAGES, EMOTIONS, USER_ROLES } from '../constants';
import { SparklesIcon } from './icons/SparklesIcon';
import { AudioTranscriber } from './AudioTranscriber';

interface StoryInputFormProps {
  topic: string;
  setTopic: (topic: string) => void;
  grade: string;
  setGrade: (grade: string) => void;
  language: string;
  setLanguage: (language: string) => void;
  emotion: string;
  setEmotion: (emotion: string) => void;
  userRole: string;
  setUserRole: (role: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  hasApiKey: boolean | null;
}

export const StoryInputForm: React.FC<StoryInputFormProps> = ({
  topic, setTopic, grade, setGrade, language, setLanguage, emotion, setEmotion, userRole, setUserRole, onSubmit, isLoading, hasApiKey
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div>
        <label htmlFor="topic" className="block text-lg font-semibold text-gray-800 mb-2">
          What topic do you want to learn?
        </label>
        <div className="flex items-center w-full p-1 pl-4 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 transition-shadow bg-white gap-2">
          <input
            type="text"
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Type or use mic to enter topic..."
            className="flex-grow py-2 border-none focus:ring-0 bg-transparent focus:outline-none w-full"
            required
            disabled={isLoading}
          />
          <AudioTranscriber onTranscriptionUpdate={setTopic} disabled={isLoading} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label htmlFor="userRole" className="block text-lg font-semibold text-gray-800 mb-2">
            I am a...
          </label>
          <select
            id="userRole"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            disabled={isLoading}
          >
            {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="grade" className="block text-lg font-semibold text-gray-800 mb-2">
            Grade Level
          </label>
          <select
            id="grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            disabled={isLoading}
          >
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="language" className="block text-lg font-semibold text-gray-800 mb-2">
            Language
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            disabled={isLoading}
          >
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Emotion Tone</h3>
        <div className="flex flex-wrap gap-3">
          {EMOTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmotion(e)}
              disabled={isLoading}
              className={`px-6 py-2 rounded-full text-base font-medium transition-all duration-200 ${
                emotion === e
                  ? 'bg-indigo-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4">
         {hasApiKey === false && (
          <div className="p-4 mb-6 text-sm text-indigo-800 rounded-lg bg-indigo-50 border border-indigo-200" role="alert">
            <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 mr-3 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                </svg>
                <div>
                    <span className="font-medium">Action Required:</span> A Gemini API key is needed to generate stories. Clicking the button below will prompt you to select one.
                </div>
            </div>
          </div>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 text-xl font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg"
        >
          <SparklesIcon className="w-7 h-7" />
          {isLoading ? 'Crafting your lesson...' : 'Generate Story & Audio'}
        </button>
      </div>
    </form>
  );
};