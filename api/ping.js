const https = require('https');

const SUPABASE_URL = 'qoqrhfloiahdaohitirj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6izuBA_alZCBXspWazUzpA_VBsgRuYT';

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const statusCode = await new Promise((resolve, reject) => {
            const options = {
                hostname: SUPABASE_URL,
                port: 443,
                path: '/rest/v1/contracts?select=id&limit=1',
                method: 'HEAD', // HEAD method returns 0 bytes body, absolute minimum egress
                headers: {
                    'apikey': SUPABASE_KEY
                },
                timeout: 8000
            };

            const request = https.request(options, (response) => {
                resolve(response.statusCode);
            });

            request.on('error', (err) => {
                reject(err);
            });

            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Supabase request timeout'));
            });

            request.end();
        });

        if (req.method === 'HEAD') {
            res.status(statusCode || 200).end();
            return;
        }

        res.status(200).json({
            ok: true,
            message: 'Supabase pinged successfully (0-byte body egress)',
            supabaseStatus: statusCode,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Ping Supabase Error:', err);
        res.status(500).json({
            ok: false,
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
};
