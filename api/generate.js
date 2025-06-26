const jwt = require('jsonwebtoken');
const { VertexAI } = require('@google-cloud/aiplatform');

// Fungsi utama yang akan dijalankan oleh Vercel
module.exports = async (req, res) => {
    // --- Penanganan CORS Manual ---
    // Mengizinkan website utama Anda untuk mengakses API ini
    res.setHeader('Access-Control-Allow-Origin', 'https://studiounix.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
    );

    // Menangani request pre-flight (OPTIONS) dari browser
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // --- Logika Aplikasi Anda ---
    try {
        // 1. Otentikasi token pengguna
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token == null) {
            return res.status(401).json({ message: 'Authentication token is missing.' });
        }
        
        jwt.verify(token, process.env.JWT_SECRET, (err) => {
            if (err) {
                return res.status(403).json({ message: 'Invalid or expired token.' });
            }
        });
        
        // 2. Ambil prompt dari request
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ message: "A prompt is required." });
        }

        // 3. Inisialisasi Vertex AI menggunakan Service Account dari Vercel
        const vertex_ai = new VertexAI({
            project: process.env.VERTEX_PROJECT_ID,
            location: process.env.VERTEX_LOCATION
        });
        const generativeModel = vertex_ai.getGenerativeModel({ model: 'imagegeneration@005' });

        // 4. Panggil Google AI API
        const aiResponse = await generativeModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        
        const imageBase64 = aiResponse.response.candidates[0].content.parts[0].fileData.data;
        if (!imageBase64) {
            throw new Error("AI tidak memberikan data gambar yang valid.");
        }
        
        // 5. Kirim respon sukses
        res.status(200).json({ image: imageBase64 });

    } catch (error) {
        console.error("Vercel Backend Error:", error);
        res.status(500).json({ message: error.message || "Terjadi kesalahan internal pada server." });
    }
};
