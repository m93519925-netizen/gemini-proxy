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
  'cookie': `__Secure-1PSID=${PSID}; __Secure-1PSIDTS=${PSIDTS}; SIDCC=${SIDCC}`,
  'user-agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
  'origin': 'https://gemini.google.com',
  'referer': 'https://gemini.google.com/',
  'x-same-domain': '1',
  'accept-encoding': 'identity',
});

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  // Cache token 5 phút
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  console.log('🔄 Lấy access token mới...');
  const res = await fetch('https://gemini.google.com/', {
    headers: getHeaders()
  });

  console.log('Page status:', res.status);
  const html = await res.text();

  // Tìm SNlM0e token
  let match = html.match(/"SNlM0e":"([^"]+)"/);
  if (!match) match = html.match(/SNlM0e["\s]*:["\s]*"([^"]+)"/);

  if (match) {
    cachedToken = match[1];
    tokenExpiry = Date.now() + 5 * 60 * 1000; // cache 5 phút
    console.log('✅ Token:', cachedToken.slice(0, 20) + '...');
    return cachedToken;
  }

  // Nếu không tìm được SNlM0e, thử lấy từ f.sid
  const sidMatch = html.match(/"FdrFJe":"([^"]+)"/);
  if (sidMatch) {
    console.log('⚠️ Dùng FdrFJe thay SNlM0e');
    cachedToken = sidMatch[1];
    tokenExpiry = Date.now() + 5 * 60 * 1000;
    return cachedToken;
  }

  console.log('❌ Không tìm được token');
  console.log('HTML preview:', html.slice(0, 300));
  return null;
}

function extractText(responseText) {
  try {
    // Tìm text trong nested array format của Gemini
    const matches = responseText.match(/"([^"\\]{20,})"(?:,null)*\]\]\]/g);
    if (matches && matches.length > 0) {
      for (const m of matches.reverse()) {
        const text = m.match(/"([^"\\]{20,})"/);
        if (text && !text[1].startsWith('http') && !text[1].startsWith('//')) {
          return text[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
      }
    }

    // Fallback: tìm response text trực tiếp
    const lines = responseText.split('\n');
    for (const line of lines) {
      if (line.includes('wrb.fr')) {
        try {
          const parsed = JSON.parse(line);
          if (parsed[0] && parsed[0][0] === 'wrb.fr' && parsed[0][2]) {
            const inner = JSON.parse(parsed[0][2]);
            if (inner[4] && inner[4][0] && inner[4][0][1]) {
              return inner[4][0][1][0];
            }
          }
        } catch {}
      }
    }
  } catch (e) {
    console.error('Extract error:', e.message);
  }
  return null;
}

app.get('/', (req, res) => {
  res.json({ status: 'Gemini Proxy running 🚀' });
});

app.post('/proxy', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Thiếu prompt' });

  try {
    const token = await getAccessToken();

    const fReq = JSON.stringify([
      null,
      `[["${prompt.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",0,null,null,null,null,0],["vi"],["","","",null,null,null,null,null,null,""],null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,[1],null,null,null,null,null,null,null,null,null,null,null,0]`
    ]);

    const params = new URLSearchParams({
      'bl': 'boq_assistant-bard-web-server_20260713.17_p0',
      'hl': 'vi',
      'rt': 'c'
    });

    const body = new URLSearchParams({
      'f.req': fReq,
      'at': token ? `${token}:${Date.now()}` : `AD1_:${Date.now()}`
    });

    const response = await fetch(
      `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?${params}`,
      {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: body.toString()
      }
    );

    console.log('Stream status:', response.status);
    const text = await response.text();
    console.log('Raw (300):', text.slice(0, 300));

    if (response.status === 400) {
      // Reset token cache và thử lại
      cachedToken = null;
      tokenExpiry = 0;
      return res.status(400).json({ error: 'Token hết hạn, thử lại lần nữa' });
    }

    const extracted = extractText(text);
    if (extracted) {
      console.log('✅ Response:', extracted.slice(0, 100));
      res.json({ response: extracted });
    } else {
      console.log('⚠️ Không parse được, trả raw');
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
