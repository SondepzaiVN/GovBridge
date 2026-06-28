import https from 'https';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Lấy target path từ query string hoặc custom header (nếu cần).
  // Vì ta gọi trực tiếp /api/vnpt/ekyc, ta sẽ truyền path thông qua header `x-vnpt-path`
  const targetPath = req.headers['x-vnpt-path'] || '/ai/v1/ocr/id/front';

  const options = {
    hostname: 'api.idg.vnpt.vn',
    path: targetPath,
    method: req.method,
    headers: { ...req.headers }
  };

  // Strip headers that cause "Domain is invalid"
  delete options.headers['host'];
  delete options.headers['origin'];
  delete options.headers['referer'];
  delete options.headers['x-vnpt-path']; // Remove custom header
  
  // Also strip Vercel specific headers just in case
  Object.keys(options.headers).forEach(key => {
    if (key.toLowerCase().startsWith('x-vercel') || key.toLowerCase().startsWith('x-forwarded')) {
      delete options.headers[key];
    }
  });

  const proxyReq = https.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    
    // Pass headers back to client
    Object.keys(proxyRes.headers).forEach(key => {
      res.setHeader(key, proxyRes.headers[key]);
    });

    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    console.error('Proxy error:', e);
    res.status(500).json({ error: e.message });
  });

  // Pipe the incoming request (which might be JSON or multipart/form-data) directly to VNPT
  req.pipe(proxyReq);
}
