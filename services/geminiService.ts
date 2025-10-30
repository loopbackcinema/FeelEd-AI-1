import type { Story } from '../types';
import { AppError, APIError, NetworkError, StoryGenerationError, TTSError } from '../types';

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


export async function generateStory(
  topic: string,
  grade: string,
  language: string,
  emotion: string,
  userRole: string
): Promise<{ story: Story; storyMarkdown: string }> {
  if (!navigator.onLine) {
    throw new NetworkError();
  }

  try {
    const response = await fetch(`/api/generate-story`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, grade, language, emotion, userRole }),
    });

    if (!response.ok) {
        // We attempt to get a JSON error message, but fallback gracefully.
        const errorText = await response.text();
        let errorMsg = `The AI service failed with status: ${response.status}.`;
        try {
            const errorJson = JSON.parse(errorText);
            errorMsg = errorJson.error || errorMsg;
        } catch (e) {
            // The error response wasn't JSON, which can happen with server errors (e.g., HTML error pages).
            // We'll use the status text as a fallback.
            errorMsg = response.statusText || errorMsg;
        }
        throw new APIError(errorMsg);
    }
    
    // Handle the streaming response
    if (!response.body) {
        throw new StoryGenerationError("The AI service returned an empty response.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let storyMarkdown = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        storyMarkdown += decoder.decode(value, { stream: true });
    }

    // Handle cases where the backend streams an error message (e.g., safety block)
    if (storyMarkdown.includes('Story generation was blocked')) {
        throw new StoryGenerationError(storyMarkdown);
    }

    if (!storyMarkdown) {
        throw new StoryGenerationError("The AI didn't generate a story. Please try adjusting your topic.");
    }

    const story: Story = parseStoryFromMarkdown(storyMarkdown) as Story;
    story.emotion_tone = emotion;
    
    const requiredKeys: (keyof Story)[] = ['title', 'introduction', 'concept_explanation', 'resolution', 'moral_message'];
    const missingKeys = requiredKeys.filter(key => !story[key] || !story[key]?.trim());

    if (missingKeys.length > 0) {
      throw new StoryGenerationError(`The AI didn't generate a complete story. It missed the following sections: ${missingKeys.join(', ')}. Please try again.`);
    }

    return { story, storyMarkdown };
  } catch (error: any) {
    console.error("Error communicating with API for story generation:", error);
    if (error instanceof AppError) {
      throw error;
    }
    // "Failed to fetch" is a common network-level error.
    throw new APIError(`An unexpected issue occurred. Please check your connection and try again. Details: ${error.message}`);
  }
}

/**
 * Sends story markdown to the API to generate audio narration.
 */
export async function generateAudio(storyMarkdown: string, voice: string): Promise<string | null> {
    if (!navigator.onLine) {
        console.warn("Offline, skipping audio generation.");
        return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

    try {
        const response = await fetch(`/api/generate-audio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storyMarkdown, voice }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Audio generation service failed.' }));
            throw new TTSError(errorData.error || `Audio generation failed with status: ${response.status}`);
        }

        const { audioBase64 } = await response.json();
        
        if (audioBase64) {
            const pcmData = decode(audioBase64);
            const wavBlob = pcmToWav(pcmData);
            return URL.createObjectURL(wavBlob);
        }
        return null;

    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.warn("Audio generation timed out.");
        } else {
            console.warn("Could not generate narration:", error.message);
        }
        // We don't throw a user-facing error here, as audio is non-critical.
        return null;
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