
const { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } = require('@google/genai');

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
        const { topic, introduction } = req.body;

        if (!topic || !introduction) {
            return res.status(400).json({ error: 'Missing topic or introduction for image generation.' });
        }
        
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];

        const imagePrompt = `Generate a vibrant, child-friendly, storybook illustration. Style: Whimsical, colorful, digital painting, soft lighting. Scene: ${topic}. ${introduction}. Do not include any text or words.`;
        
        const imageResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: imagePrompt }] },
            config: { responseModalities: [Modality.IMAGE], safetySettings },
        });

        const imageBase64 = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data || null;
        
        return res.status(200).json({ imageBase64 });

    } catch (error) {
        return handleGoogleAIError(error, res, 'image generation');
    }
};
