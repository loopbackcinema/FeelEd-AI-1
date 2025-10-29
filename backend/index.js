const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Modality } = require('@google/genai');

const app = express();

// IMPORTANT: In a real production environment, you would restrict this
// to your frontend's domain.
app.use(cors()); 
app.use(express.json({ limit: '10mb' }));

const getAIClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable not set.");
    }
    return new GoogleGenAI({ apiKey });
};

// Endpoint to generate both the story and the audio
app.post('/generate-story', async (req, res) => {
    try {
        const { topic, grade, language, emotion, userRole, voice } = req.body;

        if (!topic || !grade || !language || !emotion || !userRole || !voice) {
            return res.status(400).json({ error: 'Missing required fields in the request.' });
        }

        const ai = getAIClient();

        // Step 1: Generate the story content
        const storyPrompt = `
You are an expert curriculum developer and a masterful storyteller for children. 
Your task is to create an emotional and educational story based on the user's request.
The story must be structured in a specific Markdown format with the following sections EXACTLY:
# Title: [A captivating title]
# Introduction: [Set the scene and introduce characters]
# Emotional Trigger: [A challenge, problem, or emotionally resonant event]
# Concept Explanation: [Clearly explain the educational concept through the story's events or dialogue]
# Resolution: [How the challenge was overcome and the concept was understood]
# Moral Message: [A concluding moral or takeaway]

---
USER REQUEST:
- Topic: "${topic}"
- Grade Level: "${grade}"
- Language: "${language}"
- Emotion Tone: "${emotion}"
- My Role: "${userRole}"
---

Generate the story now.
`;
        
        const storyResponse = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: storyPrompt,
        });

        const storyMarkdown = storyResponse.text;

        if (!storyMarkdown) {
            return res.status(500).json({ error: 'Failed to generate story content.' });
        }
        
        // Step 2: Generate the TTS audio from the generated story
        const ttsPrompt = `Read the following story in a ${emotion} tone.`;
        
        const fullTextForTTS = `${ttsPrompt}\n\n${storyMarkdown.replace(/^#\s/gm, '')}`;

        const audioResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: fullTextForTTS }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice },
                    },
                },
            },
        });
        
        const audioBase64 = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (!audioBase64) {
            return res.status(500).json({ error: 'Failed to generate audio narration.' });
        }
        
        // Step 3: Send both back to the client
        res.json({
            storyMarkdown,
            audioBase64
        });

    } catch (error) {
        console.error('Error in /generate-story:', error);
        res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
});

// Endpoint to transcribe audio
app.post('/transcribe-audio', async (req, res) => {
    try {
        const { audioData, mimeType } = req.body; // audioData is a base64 string

        if (!audioData || !mimeType) {
            return res.status(400).json({ error: 'Missing audioData or mimeType.' });
        }

        const ai = getAIClient();
        
        const audioPart = {
            inlineData: {
                data: audioData,
                mimeType: mimeType,
            },
        };
        const textPart = {
            text: "Transcribe this audio.",
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [audioPart, textPart] },
        });

        const transcription = response.text;

        if (transcription === undefined) {
            return res.status(500).json({ error: 'Could not get transcription from AI.' });
        }
        
        res.json({ transcription });

    } catch (error) {
        console.error('Error in /transcribe-audio:', error);
        res.status(500).json({ error: error.message || 'An internal server error occurred during transcription.' });
    }
});


// This is the entry point for the Google Cloud Function
// By exporting `api`, you are telling Cloud Functions to serve the Express app.
exports.api = app;
