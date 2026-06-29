# GovBridge — Trợ lý AI Cổng Dịch Vụ Công Quốc Gia

Dự án này là giải pháp toàn diện bao gồm **Frontend (React/Vite)** và **Backend (Node.js/Express)**, được tích hợp với các công nghệ AI tiên tiến của VNPT (SmartBot, SmartVoice, eKYC) nhằm tự động hóa quy trình hỗ trợ người dân trên Cổng Dịch Vụ Công.

## 📋 Yêu cầu hệ thống
- **Node.js**: Phiên bản >= 20.0.0
- **Trình duyệt**: Khuyến nghị dùng Google Chrome hoặc Microsoft Edge (hỗ trợ tốt nhất cho Web Speech API).

---

## 🚀 Hướng dẫn cài đặt (Installation)

Bạn cần mở Terminal (Command Prompt/PowerShell) tại thư mục gốc của dự án (`Chatbot_HackAIThon_Ver2`) và thực hiện cài đặt cho cả 2 phần Frontend và Backend:

### 1. Cài đặt Backend
```bash
cd backend
npm install
```

### 2. Cài đặt Frontend
Mở một Terminal khác (hoặc cd ngược ra):
```bash
cd frontend
npm install
```

---

## ⚙️ Cấu hình môi trường (.env)

Trước khi khởi động, bạn cần cấu hình các Token bảo mật của VNPT để AI có thể hoạt động.

1. Vào thư mục `backend/`, copy file `.env.example` và đổi tên thành `.env`.
2. Mở file `.env` và điền các giá trị Token do VNPT cung cấp vào các mục tương ứng:
   - **SmartVoice (TTS/STT)**
   - **SmartBot (LLM Agent)**
   - **eKYC (OCR nhận diện CCCD)**

*(Lưu ý: Nếu bạn set các biến `ASSISTANT_PROVIDER=mock`, `OCR_PROVIDER=mock` thì hệ thống có thể chạy giả lập mà không cần Token VNPT).*

---

## 🏃 Hướng dẫn chạy dự án (Run the app)

Để hệ thống hoạt động hoàn chỉnh, bạn cần **chạy song song 2 Terminal** cho Backend và Frontend.

### Terminal 1: Khởi động Backend
```bash
cd backend
npm run dev
```
👉 *Backend sẽ lắng nghe tại:* `http://localhost:3000`

### Terminal 2: Khởi động Frontend
```bash
cd frontend
npm run dev
```
👉 *Frontend sẽ chạy tại:* `http://localhost:5173`

---

## 🌐 Trải nghiệm
Sau khi cả 2 Terminal đều báo chạy thành công, bạn hãy mở trình duyệt và truy cập vào:
**[http://localhost:5173](http://localhost:5173)**

Hệ thống Frontend sẽ tự động kết nối với API Backend (qua cổng 3000) và bạn đã có thể bắt đầu trò chuyện với Trợ lý AI!
