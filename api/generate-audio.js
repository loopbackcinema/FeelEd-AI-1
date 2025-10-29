
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
            throw new Error('API_KEY environment variable is not set on Vercel.');
        }
        ai = new GoogleGenAI({ apiKey });
    } catch (e) {
        console.error("CRITICAL: Failed to initialize GoogleGenAI.", e.message);
        return res.status(500).json({ error: 'AI service not configured on the server.' });
    }

    try {
        const { storyMarkdown, voice } = req.body;

        if (!storyMarkdown || !voice) {
            return res.status(400).json({ error: 'Missing storyMarkdown or voice for audio generation.' });
        }

        const emotionMatch = storyMarkdown.match(/Emotion Tone: "([^"]+)"/);
        const emotion = emotionMatch ? emotionMatch[1] : 'neutral';
        
        const ttsPrompt = `Read the following story in a ${emotion} tone.`;
        // We remove the markdown headings for a smoother narration
        const fullTextForTTS = `${ttsPrompt}\n\n${storyMarkdown.replace(/^#\s+.*$/gm, '')}`;

        const audioResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: fullTextForTTS }] }],
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