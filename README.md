# GovBridge — Trợ lý AI Cổng Dịch Vụ Công Quốc Gia

Dự án này là giải pháp toàn diện bao gồm **Frontend (React/Vite)** và **Backend (Node.js/Express)**, được tích hợp với các công nghệ AI tiên tiến của VNPT (SmartBot, SmartVoice, eKYC) nhằm tự động hóa quy trình hỗ trợ người dân trên Cổng Dịch Vụ Công.

## 📋 Yêu cầu hệ thống
- **Docker Desktop** (Khuyên dùng)
- **Node.js**: Phiên bản >= 20.0.0 (Nếu không dùng Docker)
- **Trình duyệt**: Khuyến nghị dùng Google Chrome hoặc Microsoft Edge (hỗ trợ tốt nhất cho Web Speech API).

---

## ⚙️ Cấu hình môi trường (.env)

Dù bạn chạy bằng Docker hay thủ công, trước khi khởi động, bạn cần cấu hình các Token bảo mật của VNPT để AI có thể hoạt động.

1. Vào thư mục `backend/`, copy file `.env.example` và đổi tên thành `.env` (nếu chưa có, hãy tạo file `.env` mới).
2. Mở file `.env` và điền các giá trị Token do VNPT cung cấp vào các mục tương ứng:
   - **SmartVoice (TTS/STT)**
   - **SmartBot (LLM Agent)**
   - **eKYC (OCR nhận diện CCCD)**

*(Lưu ý: Nếu bạn set các biến `ASSISTANT_PROVIDER=mock`, `OCR_PROVIDER=mock` thì hệ thống có thể chạy giả lập mà không cần Token VNPT).*

---

## 🏃 Hướng dẫn chạy dự án (Run the app)

### 🐳 Cách 1: Khởi chạy bằng Docker (Khuyên dùng - Recommended)

Chúng tôi **đặc biệt khuyến khích** sử dụng Docker để khởi chạy dự án. Phương pháp này giúp bạn thiết lập toàn bộ hệ thống (Frontend & Backend) chỉ với 1 lệnh duy nhất, tiết kiệm thời gian và đảm bảo không gặp lỗi do xung đột phiên bản môi trường.

1. Đảm bảo bạn đã cài đặt và bật phần mềm **Docker Desktop**.
2. Mở Terminal tại thư mục gốc của dự án (nơi chứa file `docker-compose.yml`).
3. Chạy lệnh sau để build và khởi động hệ thống:
```bash
docker compose up -d --build
```

### 🚀 Cách 2: Cài đặt và chạy thủ công (Manual Installation)

Để hệ thống hoạt động hoàn chỉnh, bạn cần **chạy song song 2 Terminal** cho Backend và Frontend.

#### Terminal 1: Khởi động Backend
```bash
cd backend
npm install
npm run dev
```
👉 *Backend sẽ lắng nghe tại:* `http://localhost:3000`

#### Terminal 2: Khởi động Frontend
```bash
cd frontend
npm install
npm run dev
```
👉 *Frontend sẽ chạy tại:* `http://localhost:5173`

---

## 🌐 Trải nghiệm

Sau khi hệ thống khởi chạy thành công (bằng Docker hoặc 2 Terminal), bạn hãy mở trình duyệt và truy cập vào:
**[http://localhost:5173](http://localhost:5173)**

Hệ thống Frontend sẽ tự động kết nối với API Backend (qua cổng 3000) và bạn đã có thể bắt đầu trò chuyện với Trợ lý AI!
