# Gov Bridge Backend

Backend Express + TypeScript cho bản mô phỏng Cổng dịch vụ công. Hệ thống chạy được ngay với file JSON tĩnh, không cần database và không cần khóa API bên ngoài.

Đường dẫn API chuẩn là /api/v1. Alias /api được giữ để tương thích với cấu hình frontend hiện tại: VITE_API_URL=http://localhost:3000/api.

## Chạy dự án

Yêu cầu Node.js 20 trở lên.

~~~bash
cd backend
npm install
npm run dev
~~~

Server mặc định chạy tại http://localhost:3000. Kiểm tra nhanh bằng GET http://localhost:3000/api/v1/health.

Các lệnh chính:

- npm run dev: chạy development và tự khởi động lại khi sửa code.
- npm run typecheck: kiểm tra kiểu dữ liệu TypeScript.
- npm test: chạy integration test cho API.
- npm run build: biên dịch vào thư mục dist.
- npm start: chạy bản đã build.

Sao chép .env.example thành .env nếu cần đổi port, CORS hoặc bật VNPT. Không đặt biến VITE_ cho khóa bí mật vì biến VITE_ có thể bị đóng gói xuống trình duyệt.

## Kiến trúc

~~~text
HTTP Request
    │
    ▼
Route ── xác định endpoint, middleware, schema request
    │
    ▼
Controller ── nhận request và trả response chuẩn
    │
    ▼
Service ── nghiệp vụ, validation, phối hợp luồng
    │
    ├── Repository ── đọc/ghi JSON tĩnh
    │
    └── Provider ── mock hoặc dịch vụ VNPT bên ngoài
~~~

~~~text
src/
├── app.ts                         # Ghép middleware, dependency và router
├── server.ts                      # Khởi động/dừng HTTP server
├── config/env.ts                  # Đọc và kiểm tra biến môi trường
├── common/                        # Lỗi, response, middleware dùng chung
├── routes/index.ts                # Router tổng /api và /api/v1
├── modules/
│   ├── health/                    # Trạng thái hệ thống
│   ├── procedures/                # Danh mục và schema thủ tục
│   ├── applications/              # Kiểm tra và nhận hồ sơ cuối
│   ├── assistant/                 # Chat session và các tool độc lập
│   ├── identity/                  # OCR CCCD
│   └── speech/                    # Text-to-Speech
├── integrations/vnpt/             # Adapter gọi VNPT, không chứa HTTP route
└── storage/
    ├── json-file-store.ts          # Ghi nối tiếp và thay file an toàn
    └── data/                       # Dữ liệu tĩnh tạm thời
~~~

Các thư mục api/, services/, config/ ở ngay gốc backend là prototype cũ và không nằm trong phạm vi biên dịch. Mã nguồn chạy thật nằm hoàn toàn trong src/.

## Chuẩn response

Thành công:

~~~json
{
  "success": true,
  "data": {},
  "requestId": "uuid"
}
~~~

Thất bại:

~~~json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Hồ sơ chưa hợp lệ.",
    "details": [
      { "field": "ltks_cccdCha", "code": "CCCD", "message": "CCCD phải có 9 hoặc 12 chữ số." }
    ]
  },
  "requestId": "uuid"
}
~~~

Header x-request-id được nhận từ client nếu hợp lệ hoặc tự sinh ở backend, giúp dò một request xuyên suốt mà không log dữ liệu cá nhân.

## Danh sách API

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | /api/v1/health | Kiểm tra server, storage và provider đang dùng |
| GET | /api/v1/procedures | Lấy danh sách tóm tắt thủ tục |
| GET | /api/v1/procedures?includeFields=true | Lấy danh sách kèm toàn bộ field |
| GET | /api/v1/procedures/:id | Lấy chi tiết một thủ tục, gồm field và step |
| POST | /api/v1/applications | Nộp toàn bộ hồ sơ đúng một lần ở bước cuối |
| GET | /api/v1/applications/:id | Lấy hồ sơ theo mã, dùng cho demo |
| POST | /api/v1/assistant/messages | Gửi tin nhắn chatbot và nhận action cho frontend |
| DELETE | /api/v1/assistant/sessions/:sessionId | Xóa lịch sử một phiên chat |
| POST | /api/v1/identity/cccd/ocr | OCR mặt trước CCCD, multipart field file |
| POST | /api/v1/speech/tts | Chuyển văn bản thành giọng nói |

GET /procedures hỗ trợ query search, category và includeFields=true|false.

### Nộp hồ sơ

Frontend giữ dữ liệu bước 1, 2, 3 trong FormContext/sessionStorage. Chỉ nút Nộp hồ sơ ở bước cuối gọi endpoint này.

~~~http
POST /api/v1/applications
Content-Type: application/json
~~~

~~~json
{
  "serviceId": "lien-thong-khai-sinh",
  "submittedAt": "2026-06-29T08:00:00.000Z",
  "data": {
    "ltks_tenTre": "Nguyễn Văn An",
    "ltks_ngaySinhTre": "2024-01-01",
    "ltks_noiSinhTre": "Bệnh viện A",
    "ltks_cccdCha": "012345678901",
    "ltks_hoTenCha": "Nguyễn Văn Bình",
    "ltks_cccdMe": "012345678902",
    "ltks_hoTenMe": "Trần Thị Hoa",
    "ltks_diaChiThuongTru": "Hà Nội",
    "ltks_nhanBHYT": "UBND phường",
    "ltks_ghiChu": ""
  }
}
~~~

Backend không nhận dữ liệu theo từng bước trong luồng hiện tại. Khi nộp, backend kiểm tra lại thủ tục tồn tại, field lạ, field bắt buộc, option, pattern, số điện thoại, CCCD và ngày sinh rồi mới ghi một bản ghi duy nhất.

### Chatbot

~~~json
{
  "sessionId": "có thể bỏ ở tin đầu",
  "message": "bước tiếp theo",
  "currentRoute": "/lien-thong-khai-sinh/buoc-2",
  "currentSection": "thong-tin-cha-me",
  "formValues": { "ltks_cccdCha": "012345678901" },
  "recentOcrFacts": { "id": "012345678901" }
}
~~~

Kết quả data gồm:

- sessionId: frontend lưu lại và gửi ở các tin sau.
- response: tương thích với AIResponse hiện tại, gồm intent, message, data, suggestions.
- actions: danh sách lệnh có cấu trúc như NAVIGATE, REQUEST_CONFIRM_FILL, FILL_FORM hoặc NEXT_STEP để frontend phát qua agentEventBus.

Frontend nên chọn một đường xử lý hiển thị duy nhất để tránh lặp tin nhắn: dùng response cho tin nhắn, và chỉ phát các action có thao tác UI; không phát lại action CHAT nếu đã hiển thị response.

Backend dựng context theo schema thủ tục: bước hiện tại, field đã có, field bắt buộc còn thiếu, thay đổi gần nhất, candidate case và field OCR gần nhất. Giá trị thật của form/OCR chỉ được backend dùng để kiểm tra; VNPT chỉ nhận ID/trạng thái field cùng câu chat mà người dùng chủ động gửi. Frontend không gọi trực tiếp VNPT; mọi tra cứu chuyên sâu đi qua `/assistant/messages`, được OpenAI orchestrator quyết định rồi backend mới gọi VNPT livechat/Conversation API nội bộ.

Khi `KNOWLEDGE_PROVIDER=vnpt`, cấu hình bearer token bằng `VNPT_ASSISTANT_TOKEN`. Bot, sender và referer mặc định theo `.env.example`.

VNPT phải trả JSON có cấu trúc gồm facts, confidence, caseSuggestion, followUpQuestion và fieldExplanation. Backend không tin trực tiếp kết quả này: field lạ, field hệ thống, giá trị sai option/pattern và fact suy diễn đều bị loại. Fact hợp lệ được chuyển thành REQUEST_CONFIRM_FILL; frontend chỉ điền sau khi người dùng xác nhận.

Chế độ mock hỗ trợ tư vấn giấy tờ/thời gian/quy trình, điều hướng, NEXT_STEP và đề xuất điền form theo cú pháp rõ ràng. NEXT_STEP chỉ được phát khi formValues cho thấy các field bắt buộc của bước hiện tại đã đủ, ví dụ:

~~~text
ltks_hoTenCha: Nguyễn Văn Bình; ltks_cccdCha: 012345678901
~~~

### OCR CCCD

Request dùng multipart/form-data với field tên file. Chấp nhận JPEG, PNG, WebP; dung lượng mặc định tối đa 8 MB. Backend kiểm tra cả MIME và chữ ký đầu file. Khi OCR_PROVIDER=mock, API trả dữ liệu mẫu có nhãn MOCK. Khi OCR_PROVIDER=vnpt, backend gọi đúng hai endpoint upload/OCR cố định và không cho client truyền target URL.

Khi gọi từ frontend bằng FormData, không tự đặt Content-Type; trình duyệt cần tự thêm multipart boundary.

### Text-to-Speech

~~~json
{
  "text": "Xin chào bạn",
  "speed": 1,
  "voice": "female_south",
  "domain": "general"
}
~~~

Ở chế độ mock, audioUrl là null và useBrowserFallback=true để frontend dùng Web Speech API. Ở chế độ VNPT, audioUrl là đường dẫn âm thanh do VNPT trả về. Thu âm microphone và Web Speech STT vẫn thuộc frontend; backend hiện không giả vờ cung cấp một STT API chưa có provider ổn định.

## Dữ liệu tĩnh

- src/storage/data/procedures.json: nguồn danh mục thủ tục hiện tại, được đồng bộ từ frontend khi khởi tạo kiến trúc.
- src/storage/data/applications.json: các hồ sơ đã nhận.
- src/storage/data/assistant-sessions.json: lịch sử chat theo session; tự giữ tối đa 500 phiên còn hoạt động trong 24 giờ.

JsonFileStore xếp hàng các lần ghi trong một tiến trình và ghi qua file tạm trước khi đổi tên, tránh hai request đồng thời ghi đè nhau. Đây vẫn chỉ là storage cho demo: không chạy nhiều instance server, không phù hợp dữ liệu thật, không có transaction liên tiến trình, mã hóa hoặc phân quyền.

Khi có database, chỉ thay ProcedureRepository, ApplicationRepository và AssistantSessionRepository bằng Prisma/SQL hoặc Redis. Route, controller, service và hợp đồng frontend được giữ nguyên.

## Làm việc nhóm và thêm tool

Mỗi tool chatbot nằm trong src/modules/assistant/tools và triển khai hai hàm canHandle, execute. Để thêm tool:

1. Tạo một file ten-tool.tool.ts, không gọi Express và không ghi JSON trực tiếp.
2. Trả về response cho hội thoại và actions cho thao tác giao diện.
3. Đăng ký tool trong tools/index.ts theo thứ tự ưu tiên, luôn để fallback cuối cùng.
4. Thêm test cho input kích hoạt tool và action đầu ra.

Module nghiệp vụ khác cũng giữ ranh giới tương tự: thành viên làm OCR chỉ sửa identity/integrations, thành viên làm hồ sơ chỉ sửa applications, thành viên làm chatbot chỉ sửa assistant. Các nhóm thống nhất schema request/response trước khi làm song song.

## Bảo mật và giới hạn hiện tại

Backend đã bật Helmet, CORS allowlist, giới hạn JSON/upload, rate limit, request validation, timeout dịch vụ ngoài và không trả token VNPT cho frontend. Endpoint GET application hiện trả dữ liệu cá nhân và chưa có đăng nhập vì phục vụ demo; phải thêm authentication/authorization trước khi dùng thật. Không commit file .env hoặc dữ liệu hồ sơ thật lên Git.
