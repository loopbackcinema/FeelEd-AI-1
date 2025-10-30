
const { GoogleGenAI, HarmCategory, HarmBlockThreshold } = require('@google/genai');

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
    } else if (error.message && error.message.includes('billing account')) {
        userMessage = 'The project is not linked to a billing account, which is required for the AI service.';
        statusCode = 402;
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
        const { topic, grade, language, emotion, userRole } = req.body;

        if (!topic || !grade || !language || !emotion || !userRole) {
            return res.status(400).json({ error: 'Missing required fields in the request.' });
        }
        
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
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

IMPORTANT: The total length of the story (from Introduction to Moral) must be concise and ideally under 300 words to ensure it can be narrated quickly.

Generate the story now.`;
        
        // Use streaming to avoid Vercel's 10-second timeout
        const stream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: storyPrompt,
            config: { safetySettings },
        });

        // Set headers for streaming
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        
        for await (const chunk of stream) {
            // Check for safety blocks in the stream
            if (!chunk.candidates || chunk.candidates.length === 0) {
                 const blockReason = chunk.promptFeedback?.blockReason;
                 const errorMessage = blockReason
                    ? `Story generation was blocked for safety reasons: ${blockReason}. Please try a different topic.`
                    : 'The AI failed to generate story content.';
                // Can't set status code here as headers are already sent.
                // We'll write an error message to the stream. Client needs to handle this.
                // A better approach is to not stream and risk timeout for safety feedback.
                // But for now, we prioritize avoiding the timeout.
                console.warn(errorMessage);
                // We will just stop streaming. Client will get an incomplete story and throw an error.
                break;
            }
            res.write(chunk.text);
        }
        
        res.end();

    } catch (error) {
        // This catch block will likely only be hit for pre-request errors (e.g., auth)
        // because streaming errors happen inside the loop.
        return handleGoogleAIError(error, res, 'story text generation');
    }
};
