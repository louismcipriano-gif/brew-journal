export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = req.headers['x-api-key'] || process.env.ANTHROPIC_API_KEY || '';
  const anthropicVersion = req.headers['anthropic-version'] || '2023-06-01';
  const isStream = req.body?.stream === true;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': anthropicVersion,
        'content-type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    if (isStream && upstream.ok && upstream.body) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        res.end();
      }
    } else {
      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    }
  } catch (err) {
    return res.status(502).json({ error: { message: err.message } });
  }
}
