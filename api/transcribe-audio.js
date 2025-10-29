
const { GoogleGenAI } = require('@google/genai');

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
    return res.status(500).json({ error: userMessage });
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
        const { audioData, mimeType } = req.body;
        if (!audioData || !mimeType) {
            return res.status(400).json({ error: 'Missing audioData or mimeType.' });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [
                { inlineData: { data: audioData, mimeType: mimeType } },
                { text: "Transcribe this audio." }
            ] },
        });

        if (!response.candidates || response.candidates.length === 0) {
            return res.status(500).json({ error: 'The AI could not process the audio.' });
        }
        
        return res.status(200).json({ transcription: response.text });

    } catch (error) {
        return handleGoogleAIError(error, res, 'audio transcription');
    }
};
