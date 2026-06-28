import https from 'https';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, token-id, token-key');

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, speed, region, domain } = req.body;

    const requestBody = JSON.stringify({ text, speed, region, domain });

    const options = {
      hostname: 'api.idg.vnpt.vn',
      path: '/tts-service/v2/grpc',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const rawAccessToken = process.env.VNPT_VOICE_ACCESS_TOKEN || process.env.VITE_VNPT_VOICE_ACCESS_TOKEN || "";
    const cleanAccessToken = rawAccessToken.replace(/^bearer\s+/i, '');

    if (cleanAccessToken) options.headers["Authorization"] = `Bearer ${cleanAccessToken}`;
    
    const tokenId = process.env.VNPT_VOICE_TOKEN_ID || process.env.VITE_VNPT_VOICE_TOKEN_ID;
    if (tokenId) options.headers["token-id"] = tokenId;
    
    const tokenKey = process.env.VNPT_VOICE_TOKEN_KEY || process.env.VITE_VNPT_VOICE_TOKEN_KEY;
    if (tokenKey) options.headers["token-key"] = tokenKey;

    const proxyReq = https.request(options, (proxyRes) => {
      let body = '';
      proxyRes.on('data', chunk => body += chunk);
      proxyRes.on('end', () => {
        if (proxyRes.statusCode === 404) {
          return res.status(404).json({
            debug: true,
            receivedHeaders: req.headers,
            sentHeaders: options.headers,
            vnptResponse: body,
            message: "VNPT returned 404. Check your token setup."
          });
        }
        res.status(proxyRes.statusCode);
        Object.keys(proxyRes.headers).forEach(key => {
          res.setHeader(key, proxyRes.headers[key]);
        });
        res.send(body);
      });
    });

    proxyReq.on('error', (e) => {
      res.status(500).json({ error: e.message });
    });

    proxyReq.write(requestBody);
    proxyReq.end();

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
