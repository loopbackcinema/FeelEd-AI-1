// Fix: Removed unused and non-existent type 'LiveSession'.
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Story } from '../types';
import { AppError, APIError, NetworkError, StoryGenerationError, TTSError } from '../types';

const storyGenerationModel = 'gemini-2.5-pro';
const ttsModel = 'gemini-2.5-flash-preview-tts';
const transcriptionModel = 'gemini-2.5-flash-native-audio-preview-09-2025';

// --- Helper function to get the AI client ---
const getAIClient = () => {
  // The API key is sourced from process.env.API_KEY, which is automatically
  // managed by the execution environment. The explicit check has been removed
  // to align with the platform's key management strategy.
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};


// --- Helper functions for WAV conversion ---

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
  const sections = {
    title: /# Title\n([\s\S]*?)(?=\n# |$)/,
    introduction: /# Introduction\n([\s\S]*?)(?=\n# |$)/,
    emotional_trigger: /# Emotional Trigger\n([\s\S]*?)(?=\n# |$)/,
    concept_explanation: /# Concept Explanation\n([\s\S]*?)(?=\n# |$)/,
    resolution: /# Resolution\n([\s\S]*?)(?=\n# |$)/,
    moral_message: /# Moral Message\n([\s\S]*?)(?=\n# |$)/,
  };

  for (const [key, regex] of Object.entries(sections)) {
    const match = markdown.match(regex);
    if (match && match[1]) {
      story[key as keyof Story] = match[1].trim();
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
  onStoryUpdate: (story: Partial<Story>) => void
): Promise<{ story: Story; audioUrl: string }> {
  if (!navigator.onLine) {
    throw new NetworkError();
  }

  try {
    const ai = getAIClient(); // Lazily initialize the AI client
    
    // 1. Generate Story via streaming
    const systemInstruction = `You are an expert educational storyteller. Your task is to convert a given academic topic into a short, emotionally engaging story.
    The story must follow a 5-part structure.
    Make it suitable for the given grade level and emotion tone, in the specified language.
    Tailor the story for the user, who is a ${userRole}. For a teacher, you might include teaching cues or questions. For a parent, you might suggest conversational prompts. For a student, keep it direct and engaging.
    Output the story in markdown format, with each part under a specific heading: "# Title", "# Introduction", "# Emotional Trigger", "# Concept Explanation", "# Resolution", "# Moral Message".
    Do not include any other text, commentary, or markdown formatting like bolding or italics.`;
    
    const storyPrompt = `Topic: ${topic}\nGrade: ${grade}\nLanguage: ${language}\nEmotion Tone: ${emotion}\nUser Role: ${userRole}`;
    
    const storyStream = await ai.models.generateContentStream({
      model: storyGenerationModel,
      contents: storyPrompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    let fullStoryText = '';
    for await (const chunk of storyStream) {
        fullStoryText += chunk.text;
        const partialStory = parseStoryFromMarkdown(fullStoryText);
        partialStory.emotion_tone = emotion;
        onStoryUpdate(partialStory);
    }
    
    const story: Story = parseStoryFromMarkdown(fullStoryText) as Story;
    story.emotion_tone = emotion;
    
    if (Object.keys(story).length < 6) { // title + 5 parts
      throw new StoryGenerationError("The AI didn't generate a complete story structure. Please try again or adjust your topic.");
    }


    // 2. Generate Audio (TTS)
    const storyTextForTts = [
      story.title,
      story.introduction,
      story.emotional_trigger,
      story.concept_explanation,
      story.resolution,
      story.moral_message,
    ].join('\n\n');

    const ttsResponse = await ai.models.generateContent({
        model: ttsModel,
        contents: [{ parts: [{ text: storyTextForTts }] }],
        config: {
            responseModalities: [Modality.AUDIO],
        },
    });

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new TTSError("The AI failed to generate audio narration for the story.");
    }
    
    const pcmData = decode(base64Audio);
    const wavBlob = pcmToWav(pcmData);
    const audioUrl = URL.createObjectURL(wavBlob);


    return { story, audioUrl };
  } catch (error: any) {
    console.error("Error in generateStoryAndAudio:", error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new APIError(`An unexpected issue occurred with the AI service. Details: ${error.message}`);
  }
}

export function createTranscriptionSession(
    callbacks: {
        onMessage: (text: string) => void;
        onError: (error: Error) => void;
        onClose: () => void;
    }
// Fix: Removed 'Promise<LiveSession>' return type to allow for type inference,
// as 'LiveSession' is not an exported member of the SDK.
) {
    try {
        const ai = getAIClient(); // Lazily initialize the AI client
        return ai.live.connect({
            model: transcriptionModel,
            callbacks: {
                onopen: () => console.log('Transcription session opened.'),
                onmessage: (message) => {
                    if (message.serverContent?.inputTranscription) {
                        callbacks.onMessage(message.serverContent.inputTranscription.text);
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Transcription error:', e);
                    callbacks.onError(new Error(e.message));
                },
                onclose: (e: CloseEvent) => {
                    console.log('Transcription session closed.');
                    callbacks.onClose();
                },
            },
            config: {
                inputAudioTranscription: {},
            },
        });
    } catch(error) {
        console.error("Failed to create transcription session:", error);
        // Immediately call the onError callback if client creation fails
        if(error instanceof Error) {
            callbacks.onError(error);
        } else {
            callbacks.onError(new Error("An unknown error occurred while setting up transcription."));
        }
        // Return a dummy promise that rejects to fulfill the type signature
        return Promise.reject(error);
    }
}