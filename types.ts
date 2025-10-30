// FIX: To resolve a TypeScript type conflict, the AIStudio interface and the global
// window type declaration have been consolidated here. Defining AIStudio inside `declare global`
// ensures it's a single, global type, preventing declaration merging errors.
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

export interface Story {
  title: string;
  emotion_tone: string;
  introduction: string;
  emotional_trigger: string;
  concept_explanation: string;
  resolution: string;
  moral_message: string;
}

export interface User {
  name: string;
  email: string;
  picture: string;
}

// --- Custom Error Classes ---

/**
 * Base class for custom application errors.
 */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Thrown when there is a network connectivity issue.
 */
export class NetworkError extends AppError {
  constructor(message = "It seems you're offline. Please check your internet connection and try again.") {
    super(message);
  }
}

/**
 * Thrown for general API errors from the AI service.
 */
export class APIError extends AppError {
  constructor(message = "There was an issue communicating with the AI. Please try again later.") {
    super(message);
  }
}

/**
 * Thrown when the AI fails to generate a complete story.
 */
export class StoryGenerationError extends AppError {
  constructor(message = "The AI had trouble generating the story. Please try adjusting your topic or try again.") {
    super(message);
  }
}

/**
 * Thrown when the Text-to-Speech (TTS) service fails to generate audio.
 */
export class TTSError extends AppError {
  constructor(message = "The story was created, but the audio narration could not be generated. Please try again.") {
    super(message);
  }
}