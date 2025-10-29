import type { Story } from '../types';
import { AppError, APIError, NetworkError, StoryGenerationError, TTSError } from '../types';

// This is a placeholder for your BFF's base URL.
// In a real deployment, this would be the URL of your Google Cloud Function or other backend service.
const BFF_BASE_URL = 'https://us-central1-your-project-id.cloudfunctions.net/api';


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
  const sections = markdown.trim().split(/^\s*#\s+/m);

  for (const section of sections) {
    if (!section.trim()) continue;
    const firstNewlineIndex = section.indexOf('\n');
    let heading: string;
    let content: string;

    if (firstNewlineIndex === -1) {
      heading = section.trim();
      content = '';
    } else {
      heading = section.substring(0, firstNewlineIndex).trim();
      content = section.substring(firstNewlineIndex + 1).trim();
    }

    const normalizedHeading = heading.toLowerCase().replace(/:$/, '').trim();
    const storyKey = headingMap[normalizedHeading];
    
    if (storyKey) {
      story[storyKey] = content;
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
): Promise<{ story: Story; audioUrl: string }> {
  if (!navigator.onLine) {
    throw new NetworkError();
  }

  try {
    // 1. Call your own BFF, not Google's API
    const response = await fetch(`${BFF_BASE_URL}/generate-story`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, grade, language, emotion, userRole, voice }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'The AI service failed with an unknown error.' }));
      // Distinguish between different kinds of BFF errors if the BFF provides them
      if (response.status === 429) { // Example: rate limit
          throw new APIError("You are making requests too quickly. Please wait a moment.");
      }
      throw new APIError(errorData.error || `The AI service failed with status: ${response.status}.`);
    }

    const { storyMarkdown, audioBase64 } = await response.json();

    if (!storyMarkdown) {
        throw new StoryGenerationError("The AI didn't generate a story. Please try adjusting your topic.");
    }
    if (!audioBase64) {
        throw new TTSError("The story was created, but audio narration failed. Please try again.");
    }

    const story: Story = parseStoryFromMarkdown(storyMarkdown) as Story;
    story.emotion_tone = emotion;
    
    if (Object.keys(story).length < 6) { // title + 5 parts
      throw new StoryGenerationError("The AI didn't generate a complete story structure. Please try again or adjust your topic.");
    }

    const pcmData = decode(audioBase64);
    const wavBlob = pcmToWav(pcmData);
    const audioUrl = URL.createObjectURL(wavBlob);

    return { story, audioUrl };
  } catch (error: any) {
    console.error("Error communicating with BFF for story generation:", error);
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

        const response = await fetch(`${BFF_BASE_URL}/transcribe-audio`, {
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
        console.error("Error communicating with BFF for transcription:", error);
        if (error instanceof AppError) {
            throw error;
        }
        throw new APIError(`Transcription failed. Details: ${error.message}`);
    }
}