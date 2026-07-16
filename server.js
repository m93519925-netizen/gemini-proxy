require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PSID = process.env.PSID;
const PSIDTS = process.env.PSIDTS;
const SIDCC = process.env.SIDCC;

if (!PSID) {
  console.error('❌ Thiếu PSID trong file .env');
  process.exit(1);
}

const getHeaders = () => ({
  'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
  'cookie': `__Secure-1PSID=${PSID}; __Secure-1PSIDTS=${PSIDTS}; SIDCC=${SIDCC}`,
  'origin': 'https://gemini.google.com',
  'referer': 'https://gemini.google.com/',
  'user-agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
  'x-same-domain': '1',
  'accept-encoding': 'identity',
});

function extractText(responseText) {
  try {
    const chunks = responseText.match(/\[\[null,\[null,0,"([^"]+)"\]\]\]/g);
    if (chunks && chunks.length > 0) {
      const last = chunks[chunks.length - 1];
      const match = last.match(/"([^"]+)"\]\]\]\]/);
      if (match) return match[1].replace(/\\n/g, '\n');
    }
    // Fallback: tìm text trong nested array
    const lines = responseText.split('\n');
    for (const line of lines) {
      if (line.includes('wrb.fr')) {
        const m = line.match(/"([A-Za-z][^"]{10,}[.!?])"/);
        if (m) return m[1];
      }
    }
  } catch (e) {}
  return null;
}

app.get('/', (req, res) => {
  res.json({ status: 'Gemini Proxy running 🚀' });
});

app.post('/proxy', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Thiếu prompt' });

  try {
    const fReq = JSON.stringify([
      null,
      `[["${prompt.replace(/"/g, '\\"')}",0,null,null,null,null,0],["vi"],["","","",null,null,null,null,null,null,""],null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,[1],null,null,null,null,null,null,null,null,null,null,null,0]`
    ]);

    const params = new URLSearchParams({
      'bl': 'boq_assistant-bard-web-server_20260713.17_p0',
      'hl': 'vi',
      'rt': 'c'
    });

    const body = new URLSearchParams({
      'f.req': fReq,
      'at': `AD1_LW6ysoR1KiawHoyjOdU3PK2E:${Date.now()}`
    });

    const response = await fetch(
      `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?${params}`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: body.toString()
      }
    );

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Raw (300):', text.slice(0, 300));

    const extracted = extractText(text);
    if (extracted) {
      console.log('Extracted:', extracted.slice(0, 100));
      res.json({ response: extracted });
    } else {
      console.log('Could not extract, returning raw');
      res.json({ response: text.slice(0, 1000), raw: true });
    }

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Gemini Proxy chạy tại http://localhost:${PORT}`);
});
