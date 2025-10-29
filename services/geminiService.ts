
import type { Story } from '../types';
import { AppError, APIError, NetworkError, StoryGenerationError, TTSError } from '../types';

// The BFF_BASE_URL is no longer needed as we are using Vercel Serverless Functions
// which are on the same origin.

// --- Helper functions for WAV conversion (remain on frontend) ---

/**
 * Decodes a base64 string into a Uint8Array.
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Writes a string to a DataView.
 */
function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

/**
 * Converts raw PCM audio data into a Blob with a WAV header.
 * The Gemini TTS model returns audio as 16-bit, 24kHz, single-channel PCM.
 */
function pcmToWav(pcmData: Uint8Array): Blob {
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // audio format (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data
    new Uint8Array(buffer, 44).set(pcmData);

    return new Blob([view], { type: 'audio/wav' });
}

/**
 * A robust parser for the AI's story markdown output.
 * It uses a regular expression to handle variations in formatting.
 */
function parseStoryFromMarkdown(markdown: string): Partial<Story> {
  const story: Partial<Story> = {};
  const headingMap: Record<string, keyof Story> = {
    'title': 'title',
    'introduction': 'introduction',
    'emotional trigger': 'emotional_trigger',
    'concept explanation': 'concept_explanation',
    'resolution': 'resolution',
    'moral message': 'moral_message',
  };

  // Regex to capture a heading and the content that follows until the next heading or end of string.
  // It handles optional colons and extra whitespace.
  const sectionRegex = /#\s+([^:\n]+):?\s*\n([\s\S]*?)(?=#\s+|$)/g;

  let match;
  while ((match = sectionRegex.exec(markdown)) !== null) {
    const heading = match[1].trim().toLowerCase();
    const content = match[2].trim();
    
    const storyKey = headingMap[heading];
    if (storyKey) {
      story[storyKey] = content;
    }
  }

  // A special case for the title, which might be on the same line
  // e.g., # Title: My Awesome Story
  if (!story.title) {
    const titleMatch = markdown.match(/#\s+Title:\s*(.*)/i);
    if (titleMatch && titleMatch[1]) {
        story.title = titleMatch[1].trim();
    }
  }

  return story;
}


export async function generateStoryAndAudio(
  topic: string,
  grade: string,
  language: string,
  emotion: string,
  userRole: string,
  voice: string
): Promise<{ story: Story; audioUrl: string; imageUrl: string | null }> {
  if (!navigator.onLine) {
    throw new NetworkError();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60-second timeout

  try {
    // 1. Call the Vercel serverless function
    const response = await fetch(`/api/generate-story`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, grade, language, emotion, userRole, voice }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'The AI service failed with an unknown error.' }));
      // Distinguish between different kinds of BFF errors if the BFF provides them
      if (response.status === 429) { // Example: rate limit
          throw new APIError("You are making requests too quickly. Please wait a moment.");
      }
      throw new APIError(errorData.error || `The AI service failed with status: ${response.status}.`);
    }

    const { storyMarkdown, audioBase64, imageBase64 } = await response.json();

    if (!storyMarkdown) {
        throw new StoryGenerationError("The AI didn't generate a story. Please try adjusting your topic.");
    }
    if (!audioBase64) {
        throw new TTSError("The story was created, but audio narration failed. Please try again.");
    }

    const story: Story = parseStoryFromMarkdown(storyMarkdown) as Story;
    story.emotion_tone = emotion;
    
    const requiredKeys: (keyof Story)[] = ['title', 'introduction', 'concept_explanation', 'resolution', 'moral_message'];
    const missingKeys = requiredKeys.filter(key => !story[key] || !story[key]?.trim());

    if (missingKeys.length > 0) {
      console.warn(`AI story generation was incomplete. Missing sections: ${missingKeys.join(', ')}`);
      throw new StoryGenerationError(`The AI didn't generate a complete story. It missed the following sections: ${missingKeys.join(', ')}. Please try again.`);
    }

    const pcmData = decode(audioBase64);
    const wavBlob = pcmToWav(pcmData);
    const audioUrl = URL.createObjectURL(wavBlob);

    let imageUrl: string | null = null;
    if (imageBase64) {
      imageUrl = `data:image/jpeg;base64,${imageBase64}`;
    }

    return { story, audioUrl, imageUrl };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
        throw new APIError("The request to generate the story timed out after 60 seconds. This can happen with complex topics. Please try again.");
    }
    console.error("Error communicating with API for story generation:", error);
    if (error instanceof AppError) {
      throw error;
    }
    // Catches network errors from fetch itself
    throw new APIError(`An unexpected issue occurred. Please check your connection and try again. Details: ${error.message}`);
  }
}

/**
 * Sends an audio blob to the BFF for transcription.
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
    if (!navigator.onLine) {
        throw new NetworkError();
    }

    try {
        const reader = new FileReader();
        const readPromise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
                // result is "data:audio/webm;base64,...."
                // We only want the base64 part
                const base64data = (reader.result as string).split(',')[1];
                resolve(base64data);
            };
            reader.onerror = reject;
        });
        reader.readAsDataURL(audioBlob);
        const base64Audio = await readPromise;

        const response = await fetch(`/api/transcribe-audio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioData: base64Audio, mimeType: audioBlob.type }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Transcription service failed.' }));
            throw new APIError(errorData.error || `Transcription failed with status: ${response.status}`);
        }

        const { transcription } = await response.json();
        return transcription;

    } catch (error: any) {
        console.error("Error communicating with API for transcription:", error);
        if (error instanceof AppError) {
            throw error;
        }
        throw new APIError(`Transcription failed. Details: ${error.message}`);
    }
}