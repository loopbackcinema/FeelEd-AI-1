// Fix: Removed unused and non-existent type 'LiveSession'.
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Story } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const storyGenerationModel = 'gemini-2.5-pro';
const ttsModel = 'gemini-2.5-flash-preview-tts';
const transcriptionModel = 'gemini-2.5-flash-native-audio-preview-09-2025';

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


const storySchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    emotion_tone: { type: Type.STRING },
    introduction: { type: Type.STRING },
    emotional_trigger: { type: Type.STRING },
    concept_explanation: { type: Type.STRING },
    resolution: { type: Type.STRING },
    moral_message: { type: Type.STRING },
  },
  required: ['title', 'emotion_tone', 'introduction', 'emotional_trigger', 'concept_explanation', 'resolution', 'moral_message'],
};

export async function generateStoryAndAudio(
  topic: string,
  grade: string,
  language: string,
  emotion: string
): Promise<{ story: Story; audioUrl: string }> {
  try {
    // 1. Generate Story
    const systemInstruction = `You are an expert educational storyteller. Your task is to convert a given academic topic into a short, emotionally engaging story.
    The story must follow a 5-part structure: Introduction, Emotional Trigger, Concept Explanation, Resolution, Moral Message.
    Make it suitable for the given grade level and emotion tone, in the specified language.
    Output strictly in JSON format only. Do not include any extra commentary outside JSON.`;
    
    const storyPrompt = `Topic: ${topic}\nGrade: ${grade}\nLanguage: ${language}\nEmotion Tone: ${emotion}`;
    
    const storyResponse = await ai.models.generateContent({
      model: storyGenerationModel,
      contents: storyPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: storySchema,
        temperature: 0.7,
      },
    });

    const storyJsonText = storyResponse.text.trim();
    const story: Story = JSON.parse(storyJsonText);

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
      throw new Error("TTS generation failed, no audio data received.");
    }
    
    const pcmData = decode(base64Audio);
    const wavBlob = pcmToWav(pcmData);
    const audioUrl = URL.createObjectURL(wavBlob);


    return { story, audioUrl };
  } catch (error) {
    console.error("Error in generateStoryAndAudio:", error);
    throw new Error("Failed to generate story and audio. Please check the console for details.");
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
}