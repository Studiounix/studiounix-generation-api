// This is a Vercel Serverless Function located at /api/test.js
module.exports = (req, res) => {
    // Manually set CORS headers to allow your frontend to connect.
    res.setHeader('Access-Control-Allow-Origin', 'https://studiounix.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle the browser's pre-flight OPTIONS request sent before a real request.
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // If it's a GET request, send back the success message.
    if (req.method === 'GET') {
        res.status(200).json({ message: 'The Vercel test endpoint is working correctly!' });
    } else {
        // Handle any other method with an error.
        res.setHeader('Allow', ['GET', 'OPTIONS']);
        res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
};
