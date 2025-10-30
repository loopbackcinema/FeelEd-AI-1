const { GoogleGenAI, Modality } = require('@google/genai');

// A hard limit on characters for the TTS service to prevent Vercel function timeouts.
// 1500 chars is roughly 250 words, which should generate audio well within the 10s limit.
const MAX_TTS_CHARACTERS = 1500;

async function allowCors(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }
    return false;
}

function handleGoogleAIError(error, res, context) {
    console.error(`Error during ${context}:`, JSON.stringify(error, null, 2));
    let userMessage = `A critical error occurred on the server during ${context}.`;
    let statusCode = 500;
    if (error.message && error.message.includes('API_KEY_INVALID')) {
        userMessage = 'The API key provided is invalid. Please check the configuration.';
        statusCode = 401;
    }
    return res.status(statusCode).json({ error: userMessage });
}

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
            // This is a server configuration error, not a client error.
            throw new Error('API_KEY environment variable is not set on the server.');
        }
        ai = new GoogleGenAI({ apiKey });
    } catch (e) {
        console.error("CRITICAL: Failed to initialize GoogleGenAI for TTS.", e.message);
        return res.status(500).json({ error: 'AI audio service not configured on the server.' });
    }

    try {
        const { storyText, voice } = req.body;

        if (!storyText || !voice) {
            return res.status(400).json({ error: 'Missing storyText or voice for audio generation.' });
        }
        
        // The text now comes pre-cleaned from the frontend. We just do a safety trim.
        let textToNarrate = storyText;
        if (textToNarrate.length > MAX_TTS_CHARACTERS) {
            console.warn(`TTS input truncated from ${textToNarrate.length} to ${MAX_TTS_CHARACTERS} characters.`);
            textToNarrate = textToNarrate.substring(0, MAX_TTS_CHARACTERS);
        }
        
        if (!textToNarrate.trim()) {
            return res.status(400).json({ error: 'Cannot generate audio from empty text.' });
        }

        // Log the exact text being sent to TTS for debugging
        console.log(`Sending ${textToNarrate.length} characters to TTS service. Text: "${textToNarrate.substring(0, 100)}..."`);
        
        const audioResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: textToNarrate }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
        });
        
        const audioBase64 = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (!audioBase64) {
            console.error('TTS API call succeeded but returned no audio data. Response:', JSON.stringify(audioResponse, null, 2));
            return res.status(500).json({ error: 'Failed to generate audio narration for the story.' });
        }
        
        return res.status(200).json({ audioBase64 });

    } catch (error) {
        return handleGoogleAIError(error, res, 'audio generation');
    }
};