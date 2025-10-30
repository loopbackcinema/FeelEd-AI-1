const { GoogleGenAI, Modality } = require('@google/genai');

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
        const { storyMarkdown, voice } = req.body;

        if (!storyMarkdown || !voice) {
            return res.status(400).json({ error: 'Missing storyMarkdown or voice for audio generation.' });
        }
        
        // Clean the markdown to get only the story content for narration.
        // This removes markdown headings, the user request block, and extra newlines,
        // which makes the TTS request faster and more reliable to avoid timeouts.
        let cleanStoryText = storyMarkdown;

        // 1. Remove the user request block if it exists
        const requestBlockIndex = cleanStoryText.indexOf('---');
        if (requestBlockIndex !== -1) {
            cleanStoryText = cleanStoryText.substring(0, requestBlockIndex);
        }

        // 2. Remove all markdown heading lines (e.g., # Title:)
        cleanStoryText = cleanStoryText.replace(/^#\s+[^:\n]+:?\s*\n/gm, '');

        // 3. Trim whitespace and collapse multiple newlines into a maximum of two
        cleanStoryText = cleanStoryText.trim().replace(/\n{3,}/g, '\n\n');

        const audioResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: cleanStoryText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
        });
        
        const audioBase64 = audioResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data || null;

        if (!audioBase64) {
            return res.status(500).json({ error: 'Failed to generate audio narration for the story.' });
        }
        
        return res.status(200).json({ audioBase64 });

    } catch (error) {
        return handleGoogleAIError(error, res, 'audio generation');
    }
};