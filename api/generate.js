const jwt = require('jsonwebtoken');

// Helper function to handle CORS
const allowCors = fn => async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all for simplicity, can be locked down
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

const handler = async (req, res) => {
    try {
        // 1. Authenticate the user token
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Authentication token is missing.' });
        jwt.verify(token, process.env.JWT_SECRET);
        
        // 2. Get prompt AND aspect ratio from request
        const { prompt, aspectRatio } = req.body;
        if (!prompt) {
            return res.status(400).json({ message: "A prompt is required." });
        }

        // 3. Authenticate to Google using the Service Account
        // Note: The google-auth-library is not needed as Vercel handles this automatically
        // when GOOGLE_APPLICATION_CREDENTIALS_JSON is set. We need to manually get a token.
        // For simplicity, we will stick to the API Key method for now as it's what's configured.
        
        const projectId = process.env.VERTEX_PROJECT_ID;
        const location = process.env.VERTEX_LOCATION;
        const apiKey = process.env.ADMIN_VERTEX_API_KEY; // Using a master admin key for this service
        
        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-4.0-generate-preview-06-06:predict?key=${apiKey}`;

        // 4. THIS IS THE FIX: Add the aspectRatio to the 'parameters' object
        const requestBody = {
            instances: [{ prompt: prompt }],
            parameters: { 
                sampleCount: 1,
                aspectRatio: aspectRatio || "1:1" // Use the provided ratio, or default to 1:1
            }
        };

        const googleResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await googleResponse.json();
        if (!googleResponse.ok) throw new Error(data.error?.message || 'Failed to generate image from Google AI.');
        
        const imageBase64 = data.predictions[0]?.bytesBase64Encoded;
        if (!imageBase64) throw new Error("AI response did not contain valid image data.");
        
        res.status(200).json({ image: imageBase64 });

    } catch (error) {
        console.error("Vercel Backend Error:", error);
        res.status(500).json({ message: error.message || "An internal server error occurred." });
    }
};

module.exports = allowCors(handler);
