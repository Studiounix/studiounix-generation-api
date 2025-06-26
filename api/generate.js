const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { VertexAI } = require('@google-cloud/aiplatform');

const app = express();
const corsOptions = { origin: ['https://studiounix.com', 'https://www.studiounix.com'] };
app.use(cors(corsOptions));
app.use(express.json());

const protectRoute = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

app.post('/api/generate', protectRoute, async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ message: "A prompt is required." });
    try {
        const vertex_ai = new VertexAI(); // Automatically uses the service account from environment variables
        const generativeModel = vertex_ai.getGenerativeModel({ model: 'imagegeneration@005' });
        const aiResponse = await generativeModel.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
        const imageBase64 = aiResponse.response.candidates[0].content.parts[0].fileData.data;
        if (!imageBase64) throw new Error("AI did not return valid image data.");
        res.status(200).json({ image: imageBase64 });
    } catch (error) {
        console.error("Vercel Backend Error:", error);
        res.status(500).json({ message: error.message || "An internal server error occurred." });
    }
});

module.exports = app;
