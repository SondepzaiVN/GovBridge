# Repo Context

## 1. Tổng quan repo
Dự án **GovBridge** là một hệ thống phục vụ dịch vụ công, kết nối công dân và cán bộ. Repo chứa cả Frontend (React/Vite) và Backend (Express/Node.js) chạy chung trong một workspace theo dạng monorepo đơn giản với 2 thư mục `frontend` và `backend`.

## 2. Stack công nghệ
- **Package Manager**: npm. Có root `package.json` để quản lý các script chạy song song.
- **Frontend**:
  - React 19, TypeScript, Vite.
  - UI & Styling: TailwindCSS 4, Lucide React (icon).
  - Routing: React Router v7 (`HashRouter`).
- **Backend**:
  - Node.js (>=20), TypeScript (dùng `tsx` cho môi trường dev, `tsc` để build).
  - Framework: Express.
  - Utilities/Middleware: CORS, Helmet, Rate Limit, Multer (upload), Zod (validation).
  - Testing: Vitest.

## 3. Cách chạy project
Chạy từ thư mục gốc của repo (root):
- **Cài đặt dependencies**: `npm run install:all` (cài chung root, front, back).
- **Chạy dev (cả frontend và backend)**: `npm run dev`
- **Build**: `npm run build`
- **Kiểm tra/Test**: `npm test` (chạy test backend), `npm run lint` (chạy lint frontend).

## 4. Cấu trúc thư mục
- `/frontend/src`:
  - `api/`: Cấu hình API client (bọc fetch native).
  - `assets/`: Tài nguyên hình ảnh, CSS chung (`index.css` chứa các biến màu, config global).
  - `components/`: Các UI component tái sử dụng (VD: ChatbotWidget, Header...).
  - `components/pages/`: Các trang chính của hệ thống.
  - `contexts/`: React Context để chia sẻ state (Auth, Form, Chatbot).
  - `data/`: Mock data hoặc hằng số.
  - `services/`: Logic nghiệp vụ (VD: `authService`).
  - `types/`: Khai báo type TypeScript.
  - `utils/`: Các hàm tiện ích.
- `/backend/src`:
  - `common/`: Middleware (errorHandler, rateLimit), Custom errors.
  - `config/`: Cấu hình biến môi trường.
  - `integrations/`: Tích hợp dịch vụ bên ngoài (OpenAI, VNPT OCR, VNPT TTS...).
  - `modules/`: Tính năng chính chia theo domain (applications, assistant, identity, procedures, speech). Mỗi module sẽ có Service, Repository, Provider.
  - `routes/`: Định nghĩa API Router (`/api/v1/...`).
  - `storage/`: Xử lý lưu trữ file.

## 5. Routing và navigation
- **Frontend**: Route được khai báo tập trung trong `frontend/src/App.tsx` bằng `<Routes>` của `react-router-dom` (dùng `HashRouter`).
- Các component trang (`pages`) được Lazy Load (`React.lazy`) để tối ưu hiệu năng.
- Có component `<RequireRole>` dùng như một Auth Guard bảo vệ các trang yêu cầu quyền (`/nguoi-dan`, `/can-bo`).

## 6. Authentication và phân quyền
- **Frontend**:
  - Quản lý trạng thái thông qua `AuthContext.tsx` và `authService.ts`.
  - Luồng đăng nhập hiện tại đang được **mock (hardcode)** (tài khoản mẫu: `citizen`/`123456`, `officer`/`123456`), lưu trực tiếp thông tin người dùng vào `localStorage` (key: `govbridge-auth-user`) chứ chưa gọi qua API Backend thực tế.
- **Backend**:
  - API hiện chưa có cơ chế verify JWT/Session phức tạp chặn tại middleware, phần lớn xử lý dựa vào request gửi lên.

## 7. UI conventions
- Sử dụng **TailwindCSS v4** cho toàn bộ ứng dụng, kết hợp với các CSS Variable định nghĩa tại `index.css`. Không sử dụng thư viện Component cồng kềnh (MUI, AntD).
- Các page có overlay/highlight hỗ trợ (ChatbotWidget, UIHighlighter).
- Component được tái sử dụng nhiều, chia nhỏ theo logic. Khi làm UI cần cố gắng giữ đúng cấu trúc class của Tailwind và tuân thủ màu sắc/typography có sẵn.

## 8. API và data flow
- **Frontend**: Sử dụng `apiClient` (`fetch` native bọc trong `frontend/src/api/client.ts`), handle sẵn các lỗi trả về thành `ApiClientError`.
- Response theo chuẩn: `{ success: boolean, data?: any, error?: any, requestId: string }`.
- **Backend**: Theo pattern Router -> (Validation bằng Zod) -> Service -> Repository.
- Dữ liệu ở Backend có vẻ lưu trữ dưới dạng File Storage cục bộ (`dataDirectory`) thay vì dùng hệ quản trị cơ sở dữ liệu thật (như MySQL/PostgreSQL).

## 9. Các file quan trọng
- Root: `package.json` (chứa script chạy song song).
- Frontend: `frontend/src/App.tsx` (Entry & Routing), `frontend/src/api/client.ts` (Base API), `frontend/src/index.css` (Base CSS).
- Backend: `backend/src/app.ts` (Cấu hình Express, Provider, Middleware), `backend/src/server.ts` (Khởi động Server).

## 10. Quy tắc khi implement feature mới
- UI: Sử dụng class Tailwind, không tự viết CSS Inline trừ trường hợp cực kỳ đặc biệt.
- Khai báo Type/Interface rõ ràng trong thư mục `types`.
- Backend yêu cầu validate input qua Zod trước khi đưa vào logic Service.
- Định dạng API Response chuẩn chỉ, không trả về raw error.

## 11. Rủi ro cần tránh
- Không làm vỡ Lazy Loading và cấu trúc Context Provider lồng nhau trong `App.tsx`.
- Cẩn thận khi thao tác với Repository ở Backend vì dùng Local Data Directory, dễ dẫn đến Race Condition nếu có nhiều I/O cùng lúc.
- Hệ thống Auth đang là Mock, nếu task yêu cầu tích hợp API thực thì phải refactor `authService.ts` hết sức cẩn thận, tránh ảnh hưởng đến các màn hình đã build sẵn.

## 12. Checklist trước khi code
- [ ] Nắm rõ tính năng yêu cầu (Front, Back hay cả hai).
- [ ] Tuân thủ cấu trúc thư mục hiện hành, không tự ý tạo thêm các thư mục nằm ngoài convention.
- [ ] Viết API cần validate Zod và xử lý lỗi.
- [ ] Lưu commit đúng chuẩn Conventional Commit.
