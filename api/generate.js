const { GoogleAuth } = require('google-auth-library');
const jwt = require('jsonwebtoken');

// Fungsi utama yang akan dijalankan oleh Vercel
module.exports = async (req, res) => {
    // Penanganan CORS Manual
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', 'https://studiounix.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        // 1. Otentikasi Pengguna Anda (dari PHP Login)
        const authHeader = req.headers['authorization'];
        const userToken = authHeader && authHeader.split(' ')[1];
        if (!userToken) {
            return res.status(401).json({ message: 'Authentication token is missing.' });
        }
        jwt.verify(userToken, process.env.JWT_SECRET);

        // 2. Otentikasi ke Google Cloud (Menggunakan Service Account Anda)
        const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
            scopes: 'https://www.googleapis.com/auth/cloud-platform',
        });
        const authToken = await auth.getAccessToken();

        // 3. Mempersiapkan dan Memanggil Google AI API
        const { prompt, aspectRatio } = req.body; // <-- DITAMBAHKAN: aspectRatio
        if (!prompt) {
            return res.status(400).json({ message: "A prompt is required." });
        }

        const projectId = process.env.VERTEX_PROJECT_ID;
        const location = process.env.VERTEX_LOCATION;
        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-4.0-generate-preview-06-06:predict`;
        
        const requestBody = {
            instances: [{ prompt: prompt }],
            parameters: { 
                sampleCount: 1,
                aspectRatio: aspectRatio || "16:9" // <-- DITAMBAHKAN: aspectRatio
            },
        };

        const googleResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(requestBody)
        });

        const data = await googleResponse.json();

        if (!googleResponse.ok) {
            throw new Error(data.error?.message || 'Failed to generate image from Google AI.');
        }

        const imageBase64 = data.predictions[0]?.bytesBase64Encoded;
        if (!imageBase64) {
            throw new Error("AI response did not contain valid image data.");
        }

        // 4. Kirim Respon Sukses
        res.status(200).json({ image: imageBase64 });

    } catch (error) {
        console.error("Vercel Backend Error:", error);
        res.status(500).json({ message: error.message || "An internal server error occurred." });
    }
};
