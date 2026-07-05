# GovBridge

GovBridge là bản MVP mô phỏng cổng dịch vụ công có trợ lý AI cho người dân và màn hình xử lý hồ sơ cho cán bộ. Repo gồm frontend React/Vite và backend Node.js/Express, tập trung vào các luồng cư trú, liên thông khai sinh, liên thông khai tử, OCR CCCD, kiểm tra hồ sơ đính kèm, sinh tờ khai tự động và đồng bộ hồ sơ sang dashboard cán bộ.

## Tính năng chính

- Trợ lý hội thoại hỗ trợ điền biểu mẫu, điều hướng, hỏi đáp thủ tục và đọc phản hồi bằng giọng nói.
- OCR CCCD qua nút camera/tải ảnh, hỗ trợ chọn ảnh từ máy hoặc chụp trực tiếp.
- Kiểm tra hồ sơ đính kèm bằng rule theo từng loại giấy tờ trong `backend/src/storage/rules`.
- Sinh tờ khai tự động từ dữ liệu biểu mẫu và cho phép xem trước/tải về.
- Dashboard người dân và dashboard cán bộ dùng dữ liệu đồng bộ từ backend.
- Chế độ mock để chạy demo không cần token bên thứ ba; có thể bật OpenAI/VNPT bằng biến môi trường.

## Chạy nhanh bằng Docker

Yêu cầu: Docker Desktop hoặc Docker Engine có Docker Compose.

```bash
docker compose up -d --build
```

Sau khi chạy:

- Frontend: `https://localhost:5173`
- Backend: `http://localhost:3000`
- Health check: `http://localhost:3000/api/v1/health`

Vite đang bật HTTPS bằng chứng chỉ self-signed để các tính năng microphone/camera hoạt động tốt hơn trên thiết bị di động. Trình duyệt có thể yêu cầu xác nhận chứng chỉ lần đầu.

Để dừng hệ thống:

```bash
docker compose down
```

## Cài đặt và chạy local

Yêu cầu: Node.js >= 20.

Cài toàn bộ dependencies:

```bash
npm run install:all
```

Chạy frontend và backend bằng một lệnh:

```bash
npm run dev
```

Hoặc chạy riêng:

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev -- --host
```

Các lệnh hữu ích:

| Lệnh | Mục đích |
| --- | --- |
| `npm run dev` | Chạy backend và frontend song song |
| `npm run build` | Build backend và frontend |
| `npm test` | Chạy test backend |
| `npm run lint` | Chạy lint frontend |
| `npm run start` | Chạy backend build và frontend preview |

## Cấu hình môi trường

Backend đọc biến môi trường từ `backend/.env`. Sao chép mẫu trước khi chạy local:

```bash
copy backend\.env.example backend\.env
```

Trên macOS/Linux:

```bash
cp backend/.env.example backend/.env
```

Mặc định backend có thể chạy bằng mock provider. Khi cần gọi dịch vụ thật, cập nhật các nhóm biến sau trong `backend/.env` hoặc truyền qua Docker Compose:

| Nhóm biến | Ý nghĩa |
| --- | --- |
| `ASSISTANT_PROVIDER`, `ORCHESTRATOR_PROVIDER`, `KNOWLEDGE_PROVIDER` | Chọn mock, OpenAI hoặc VNPT cho trợ lý hội thoại |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` | Cấu hình OpenAI cho điều phối hội thoại và kiểm tra hợp lệ hồ sơ |
| `OCR_PROVIDER`, `VNPT_EKYC_*` | OCR CCCD qua VNPT eKYC |
| `STT_PROVIDER`, `VNPT_STT_*` | Chuyển giọng nói thành văn bản qua VNPT SmartVoice STT |
| `TTS_PROVIDER`, `VNPT_TTS_*` | Chuyển văn bản thành giọng nói qua VNPT SmartVoice TTS |
| `VNPT_ASSISTANT_*`, `VNPT_AGENTIC_*` | Tra cứu tri thức/thủ tục qua VNPT SmartBot/Agentic |
| `VNPT_SMARTREADER_*` | Đọc nội dung ảnh/PDF hồ sơ đính kèm |
| `DOCUMENT_RULES_DIR` | Thư mục rule kiểm tra hồ sơ, mặc định `src/storage/rules` |
| `DATA_DIR` | Thư mục lưu dữ liệu demo, mặc định `backend/src/storage/data` |

Frontend mặc định gọi API qua Vite proxy `/api`. Nếu deploy tách frontend/backend, có thể đặt `VITE_API_BASE_URL`, ví dụ:

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

## Cấu trúc thư mục

```text
GovBridge/
├── backend/
│   ├── src/
│   │   ├── app.ts                         # Khởi tạo Express, middleware, provider và router
│   │   ├── server.ts                      # Điểm chạy backend
│   │   ├── config/                        # Đọc và validate biến môi trường
│   │   ├── common/                        # Middleware, error handling, response envelope
│   │   ├── integrations/
│   │   │   ├── openai/                    # OpenAI orchestrator và document reviewer
│   │   │   └── vnpt/                      # VNPT SmartBot/eKYC/SmartReader/STT/TTS
│   │   ├── modules/
│   │   │   ├── applications/              # Nộp và tra cứu hồ sơ
│   │   │   ├── assistant/                 # Trợ lý hội thoại và tool planning
│   │   │   ├── dashboard/                 # Hồ sơ cho dashboard cán bộ/người dân
│   │   │   ├── document-review/           # Kiểm tra file đính kèm theo rule
│   │   │   ├── health/                    # Health check
│   │   │   ├── identity/                  # OCR CCCD
│   │   │   ├── procedures/                # Danh mục thủ tục và schema biểu mẫu
│   │   │   └── speech/                    # STT/TTS
│   │   ├── routes/                        # Gắn router vào /api và /api/v1
│   │   └── storage/
│   │       ├── data/                      # JSON store demo
│   │       └── rules/                     # Rule markdown cho từng giấy tờ
│   ├── tests/                             # Test backend
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/                           # API client, assistant/OCR/speech services
│   │   ├── components/
│   │   │   ├── chatbot/                   # Khung chat, voice, message UI
│   │   │   ├── common/                    # Component dùng chung
│   │   │   └── pages/                     # Trang thủ tục, dashboard, liên thông
│   │   ├── contexts/                      # Form context dùng chung
│   │   ├── data/                          # Metadata service frontend
│   │   ├── hooks/                         # Hook đơn vị hành chính
│   │   ├── types/                         # TypeScript types
│   │   └── utils/                         # Đồng bộ dashboard, lưu file, validate
│   ├── public/                            # Asset tĩnh, PDF mẫu
│   └── Dockerfile
├── docker-compose.yml
├── package.json                           # Script root chạy cả frontend/backend
└── README.md
```

## API backend

Tất cả API nghiệp vụ có prefix chuẩn `/api/v1`. Alias `/api` vẫn được giữ để frontend dev proxy dùng thuận tiện.

### API nội bộ GovBridge

| Method | Endpoint | Request chính | Vai trò |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | Không có | Kiểm tra backend, storage và provider đang bật |
| `GET` | `/api/v1/procedures` | Query `includeFields=true` nếu cần schema field | Lấy danh sách thủ tục |
| `GET` | `/api/v1/procedures/:id` | Path `id` | Lấy chi tiết một thủ tục |
| `POST` | `/api/v1/applications` | JSON hồ sơ | Nộp hồ sơ từ các trang thủ tục generic |
| `GET` | `/api/v1/applications/:id` | Path `id` | Tra cứu hồ sơ đã nộp |
| `POST` | `/api/v1/dashboard/applications` | JSON hồ sơ dashboard | Đồng bộ hồ sơ sang dashboard cán bộ/người dân |
| `GET` | `/api/v1/dashboard/applications` | Không có | Lấy danh sách hồ sơ dashboard |
| `PATCH` | `/api/v1/dashboard/applications/:id` | JSON trạng thái/thông tin cập nhật | Cán bộ cập nhật trạng thái hồ sơ |
| `POST` | `/api/v1/dashboard/applications/upload` | Multipart field `file` | Lưu file đính kèm dashboard, trả về `storageKey` |
| `GET` | `/api/v1/dashboard/applications/attachments/:storageKey` | Path `storageKey` | Tải/xem file đính kèm đã lưu |
| `DELETE` | `/api/v1/assistant/sessions/:sessionId` | Path `sessionId` | Xóa lịch sử một phiên chat |

### API AI/provider do backend điều phối

| API của GovBridge | Dịch vụ/provider | Vai trò trong hệ thống |
| --- | --- | --- |
| `POST /api/v1/assistant/messages` | OpenAI orchestrator + VNPT SmartBot/Agentic hoặc mock | Nhận tin nhắn người dùng, hiểu ý định, điền form, điều hướng, hỏi đáp điều kiện/giấy tờ/quy trình/lệ phí/thời hạn. Backend không để frontend gọi trực tiếp provider bên thứ ba. |
| `POST /api/v1/identity/cccd/ocr` | VNPT eKYC hoặc mock | Nhận ảnh CCCD qua multipart field `file`, trích xuất số định danh, họ tên, ngày sinh, giới tính, quê quán, thường trú, ngày cấp và nơi cấp. |
| `POST /api/v1/document-review/ct01` | VNPT SmartReader + OpenAI document reviewer hoặc rule/mock | Nhận ảnh/PDF giấy tờ, đọc nội dung, lấy rule đúng theo `documentType` trong `backend/src/storage/rules`, trả về nhận xét và flag hợp lệ/không hợp lệ. |
| `POST /api/v1/speech/stt` | VNPT SmartVoice STT hoặc mock | Nhận multipart field `audioFile`, chuyển giọng nói người dùng thành văn bản để đưa vào hội thoại. |
| `POST /api/v1/speech/tts` | VNPT SmartVoice TTS hoặc mock/Web Speech fallback | Nhận JSON `{ "text": "..." }`, chuyển phản hồi trợ lý thành audio URL hoặc báo frontend dùng Web Speech API fallback. |

## Luồng xử lý chính

1. Người dùng chọn thủ tục và nhập biểu mẫu bằng tay, giọng nói hoặc OCR CCCD.
2. Frontend gửi hội thoại đến `/assistant/messages`; backend điều phối OpenAI/VNPT/mock để trả về action phù hợp.
3. Khi upload CCCD, frontend gửi file đến `/identity/cccd/ocr`; kết quả OCR chỉ điền vào nhóm thông tin của cá nhân tương ứng.
4. Khi upload hồ sơ đính kèm, frontend gửi file đến `/document-review/ct01`; backend chọn rule theo loại giấy tờ và không gửi context form người dùng vào OpenAI để kiểm tra tính hợp lệ.
5. Ở các luồng liên thông, frontend sinh tờ khai tự động từ dữ liệu biểu mẫu để người dùng xem trước và tải về.
6. Khi nộp hồ sơ, dữ liệu được lưu vào JSON store demo và đồng bộ sang dashboard cán bộ.

## Kiểm thử và build

```bash
npm test
npm run build
```

Backend test dùng Vitest. Frontend build chạy TypeScript project build và Vite production build.

## Lưu ý MVP

Đây là sản phẩm MVP phục vụ trình diễn. Dữ liệu đang lưu bằng JSON/file local trong `backend/src/storage/data` hoặc `backend/data/uploads` tùy luồng. Khi triển khai thật nên thay bằng database, object storage, quản lý secret chuẩn, HTTPS hợp lệ và tích hợp trực tiếp các dịch vụ nhà nước theo yêu cầu bảo mật.
