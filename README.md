# Gemini Proxy

Proxy server chạy trên Termux, chuyển Gemini Web thành API.

## Cài đặt

### 1. Clone repo
\```bash
pkg install git nodejs
git clone https://github.com/m93519925-netizen/gemini-proxy.git
cd gemini-proxy
npm install
\```

### 2. Lấy cookies từ Chrome
1. Vào gemini.google.com
2. F12 → Application → Cookies
3. Copy các giá trị:
   - `__Secure-1PSID`
   - `__Secure-1PSIDTS`
   - `SIDCC`

### 3. Tạo file .env
\```bash
cp .env.example .env
nano .env
\```

### 4. Chạy server
\```bash
node server.js
\```

### 5. Expose bằng zrok
\```bash
zrok share public http://localhost:3000
\```

## Test
\```bash
curl -X POST "https://your-zrok-url/proxy" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Xin chào!"}'
\```
