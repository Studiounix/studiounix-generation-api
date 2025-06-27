const { GoogleAuth } = require('google-auth-library');
const jwt = require('jsonwebtoken');

// Fungsi utama yang akan dijalankan oleh Vercel
module.exports = async (req, res) => {
    // --- Penanganan CORS Manual ---
    // Mengizinkan website utama Anda untuk mengakses API ini
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', 'https://studiounix.com');
    // Jika Anda juga menggunakan www, uncomment baris di bawah ini
    // res.setHeader('Access-Control-Allow-Origin', 'https://www.studiounix.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type'
    );

    // Menangani request pre-flight (OPTIONS) dari browser
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
        // Verifikasi token untuk memastikan pengguna sudah login
        jwt.verify(userToken, process.env.JWT_SECRET);

        // 2. Ambil prompt DAN aspectRatio dari request
        const { prompt, aspectRatio } = req.body;
        if (!prompt) {
            return res.status(400).json({ message: "A prompt is required." });
        }

        // 3. Otentikasi ke Google Cloud menggunakan Service Account Anda
        const auth = new GoogleAuth({
            credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
            scopes: 'https://www.googleapis.com/auth/cloud-platform',
        });
        const authToken = await auth.getAccessToken();

        // 4. Mempersiapkan dan Memanggil Google AI API
        const projectId = process.env.VERTEX_PROJECT_ID;
        const location = process.env.VERTEX_LOCATION;
        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-4.0-generate-preview-06-06:predict`;
        
        const requestBody = {
            instances: [{ "prompt": prompt }],
            parameters: { 
                "sampleCount": 1,
                // ** INI ADALAH FITUR BARU **
                // Menggunakan aspect ratio dari frontend, atau default ke "1:1" jika tidak ada
                "aspectRatio": aspectRatio || "16:9" 
            },
        };

        const googleResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}` // Menggunakan token OAuth2 yang baru dibuat
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

        // 5. Kirim Respon Sukses
        res.status(200).json({ image: imageBase64 });

    } catch (error) {
        console.error("Vercel Backend Error:", error);
        res.status(500).json({ message: error.message || "An internal server error occurred." });
    }
};
