
const { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } = require('@google/genai');

// This function handles CORS. Vercel runs this on a different subdomain in dev.
// In production, it's same-origin, but this is good practice.
async function allowCors(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true; // Signal that the CORS preflight is handled
    }
    return false; // Signal to continue to the main handler
}

// A helper function to provide more specific error messages
function handleGoogleAIError(error, res, context) {
    console.error(`Error during ${context}:`, JSON.stringify(error, null, 2));

    let userMessage = `A critical error occurred on the server during ${context}.`;
    let statusCode = 500;

    // Check for common Google Cloud permission/API errors
    if (error.message && (error.message.includes('permission denied') || error.message.includes('API is not enabled'))) {
        userMessage = 'The AI service permission is denied. Please ensure the Vertex AI API is enabled and the service account has the "Vertex AI User" role.';
        statusCode = 403; // Forbidden
    } else if (error.message && error.message.includes('API_KEY_INVALID')) {
        userMessage = 'The API key provided is invalid. Please check the configuration.';
        statusCode = 401; // Unauthorized
    } else if (error.message && error.message.includes('billing account')) {
        userMessage = 'The project is not linked to a billing account, which is required for the AI service. Please enable billing in the Google Cloud Console.';
        statusCode = 402; // Payment Required
    }

    return res.status(statusCode).json({ error: userMessage });
}


// Main handler for the serverless function
module.exports = async (req, res) => {
    if (await allowCors(req, res)) return;

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    let ai;
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            throw new Error('API_KEY environment variable is not set on Vercel.');
        }
        ai = new GoogleGenAI({ apiKey });
    } catch (e) {
        console.error("CRITICAL: Failed to initialize GoogleGenAI.", e.message);
        return res.status(500).json({ error: 'AI service not configured on the server.' });
    }

    try {
        const { topic, grade, language, emotion, userRole, voice } = req.body;

        if (!topic || !grade || !language || !emotion || !userRole || !voice) {
            return res.status(400).json({ error: 'Missing required fields in the request.' });
        }
        
        const safetySettings = [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
        ];

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
            config: { safetySettings },
        });

        if (!storyResponse.candidates || storyResponse.candidates.length === 0) {
            const blockReason = storyResponse.promptFeedback?.blockReason;
            const errorMessage = blockReason
                ? `Story generation was blocked for safety reasons: ${blockReason}. Please try a different topic.`
                : 'The AI failed to generate story content. It might be a temporary issue.';
            return res.status(500).json({ error: errorMessage });
        }
        const storyMarkdown = storyResponse.text;
        
        const ttsPromise = (async () => {
            const ttsPrompt = `Read the following story in a ${emotion} tone.`;
            const fullTextForTTS = `${ttsPrompt}\n\n${storyMarkdown.replace(/^#\s/gm, '')}`;
            const audioResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: fullTextForTTS }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
                },
            });
            if (!audioResponse.candidates || audioResponse.candidates.length === 0) {
                console.warn("TTS generation was blocked or returned no candidates.", JSON.stringify(audioResponse, null, 2));
                return null;
            }
            return audioResponse.candidates[0].content?.parts?.find(p => p.inlineData)?.inlineData?.data || null;
        })();

        const imagePromise = (async () => {
            const titleMatch = storyMarkdown.match(/# Title: (.*)/);
            const introductionMatch = storyMarkdown.match(/# Introduction:([\\s\\S]*?)# Emotional Trigger:/);
            const title = titleMatch ? titleMatch[1] : topic;
            const introduction = introductionMatch ? introductionMatch[1].trim() : '';
            const imagePrompt = `Generate a vibrant, child-friendly, storybook illustration. Style: Whimsical, colorful, digital painting, soft lighting. Scene: ${title}. ${introduction}. Do not include any text or words.`;
            
            const imageResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: imagePrompt }] },
                config: { responseModalities: [Modality.IMAGE], safetySettings },
            });
            if (!imageResponse.candidates || imageResponse.candidates.length === 0) {
                console.warn("Image generation was blocked or returned no candidates.", JSON.stringify(imageResponse, null, 2));
                return null;
            }
            return imageResponse.candidates[0].content?.parts?.find(p => p.inlineData)?.inlineData?.data || null;
        })();

        const [audioBase64, imageBase64] = await Promise.all([ttsPromise, imagePromise]);

        if (!audioBase64) {
            return res.status(500).json({ error: 'Failed to generate audio narration. The AI may have had an issue with the voice model or the story content.' });
        }
        
        return res.status(200).json({ storyMarkdown, audioBase64, imageBase64 });

    } catch (error) {
        return handleGoogleAIError(error, res, 'story generation');
    }
};
