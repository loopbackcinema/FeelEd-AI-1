const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Modality } = require('@google/genai');

const app = express();

// IMPORTANT: In a real production environment, you would restrict this
// to your frontend's domain. For now, this is open.
app.use(cors()); 
app.use(express.json({ limit: '10mb' }));

const getAIClient = () => {
    // The API key for the backend is expected to be in the `API_KEY` environment variable.
    // This aligns with the naming conventions typically used in the deployment environment.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        // This error will be thrown if the API_KEY is not configured in the Cloud Run service.
        throw new Error("API_KEY environment variable not set on the backend service.");
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
            model: 'gemini-2.5-flash',
            contents: storyPrompt,
        });

        const storyMarkdown = storyResponse.text;

        if (!storyMarkdown) {
            return res.status(500).json({ error: 'Failed to generate story content.' });
        }
        
        // --- Steps 2 & 3 in Parallel ---

        // Promise for TTS audio generation
        const ttsPromise = (async () => {
            try {
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
                return audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
            } catch (error) {
                console.error('Error generating TTS audio:', error);
                return null; // Return null on failure
            }
        })();

        // Promise for illustration generation
        const imagePromise = (async () => {
            try {
                const titleMatch = storyMarkdown.match(/# Title: (.*)/);
                const introductionMatch = storyMarkdown.match(/# Introduction:([\s\S]*?)# Emotional Trigger:/);
                const title = titleMatch ? titleMatch[1] : topic;
                const introduction = introductionMatch ? introductionMatch[1].trim() : '';
    
                const imagePrompt = `
Generate a vibrant, child-friendly, storybook illustration.
Style: Whimsical, colorful, digital painting, soft lighting, suitable for a children's educational story.
Scene: ${title}. ${introduction}
Do not include any text or words in the image.
`;
    
                const imageResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: {
                        parts: [{ text: imagePrompt }],
                    },
                    config: {
                        responseModalities: [Modality.IMAGE],
                    },
                });
    
                // Extract image data from the response
                for (const part of imageResponse.candidates[0].content.parts) {
                    if (part.inlineData) {
                        return part.inlineData.data; // This is the base64 string
                    }
                }
                return null; // No image found
            } catch (imageError) {
                console.error('Error generating illustration:', imageError);
                return null; // Non-fatal error: If image generation fails, proceed without it.
            }
        })();

        // Await both promises to complete
        const [audioBase64, imageBase64] = await Promise.all([ttsPromise, imagePromise]);

        // Audio is essential, so fail the request if it couldn't be generated.
        if (!audioBase64) {
            return res.status(500).json({ error: 'Failed to generate audio narration.' });
        }
        
        // Step 4: Send all assets back to the client
        res.json({
            storyMarkdown,
            audioBase64,
            imageBase64, // This will be null if image generation failed, which is handled by the frontend
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

// This is the required entry point for Google Cloud Run
// It starts a server and listens for requests on the port specified by the environment.
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});