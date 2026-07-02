# Liên thông khai sinh - Submit hồ sơ sang dashboard cán bộ

## Kết luận
Đã hoàn tất việc liên kết dữ liệu giữa form nộp hồ sơ **Liên thông khai sinh** và trang **Dashboard Cán bộ**. Các thay đổi diễn ra hoàn toàn ở frontend mà không tác động đến backend, sử dụng `localStorage` để lưu và merge hồ sơ nộp vào danh sách hiển thị trên dashboard.

## Trang Liên thông khai sinh
- Khi submit ở cuối Bước 5, hệ thống sẽ:
  - Tự động bổ sung `message` và `caseNote` ngầm vào payload JSON với giá trị là `"Điền thiếu"` (2 trường này chỉ phục vụ xử lý backend/JSON chứ không hiển thị UI cho người dùng nhập liệu).
  - Tự động map payload sang định dạng mà Dashboard cán bộ yêu cầu (tạo ID hồ sơ ngẫu nhiên `GOV-YYYY-XXXXXX`, map danh sách tài liệu từ `uploadedFiles`, ...).
  - Lưu hồ sơ vừa nộp vào `localStorage` với key `"officerApplications"`.

## Trang dashboard cán bộ
- Trước đó dùng dữ liệu cứng (`INITIAL_APPLICATIONS`).
- Đã được cập nhật để khi khởi tạo component sẽ tiến hành đọc dữ liệu từ `localStorage` key `"officerApplications"`.
- Merge hồ sơ lấy được với danh sách dữ liệu cứng để đảm bảo hiển thị cả hồ sơ mới nộp (đưa lên đầu) và hồ sơ mẫu có sẵn.
(Lưu ý: `message` và `caseNote` được lưu ngầm trong object dữ liệu nhưng không render ra giao diện của dashboard).

## Cấu trúc dữ liệu dashboard cán bộ đang dùng
Các trường thông tin bắt buộc phải có cho một `Application` trên dashboard:
- `id` (Mã hồ sơ, ví dụ: GOV-2026-000184)
- `procedure` (Thủ tục)
- `applicant` (Người nộp)
- `citizenId` (Số định danh)
- `phone` (Số điện thoại)
- `email` (Email)
- `submittedAt` (Ngày giờ nộp)
- `dueDate` (Hạn xử lý)
- `channel` (Kênh nộp)
- `status` (Trạng thái, bắt đầu là 'Chờ tiếp nhận')
- `documents` (Mảng tài liệu đính kèm)
- **Mới thêm**: `message` (Lời nhắn)
- **Mới thêm**: `caseNote` (Ghi chú hồ sơ)

## 2 trường mới đã thêm vào JSON submit
- `message`: Nằm trong `payload.message`, được gán cứng `"Điền thiếu"` lúc submit.
- `caseNote`: Nằm trong `payload.caseNote`, được gán cứng `"Điền thiếu"` lúc submit.

## Cách lưu hồ sơ sau khi nộp
Lưu vào Storage của trình duyệt thông qua lệnh:
```ts
const STORAGE_KEY = 'officerApplications';
window.localStorage.setItem(STORAGE_KEY, JSON.stringify([newApplication, ...currentApplications]));
```

## Cách dashboard cán bộ đọc hồ sơ mới
Khi component `OfficerDashboardPage` mount, state `applications` được khởi tạo thông qua lazy initial state:
```ts
const stored = window.localStorage.getItem('officerApplications');
if (stored) {
    const parsed = JSON.parse(stored) as Application[];
    return [...parsed, ...INITIAL_APPLICATIONS]; // Merge hồ sơ mới và cũ
}
```

## Cách xử lý field thiếu bằng "Điền thiếu"
Quá trình mapping data (`newApplication`) trong `LienThongKhaiSinhPage.tsx` có cấu trúc:
```ts
applicant: payload.ltks_hoTenNguoiYeuCau || 'Điền thiếu',
citizenId: payload.ltks_soDinhDanhNguoiYeuCau || 'Điền thiếu',
phone: payload.ltks_sdtNguoiYeuCau || 'Điền thiếu',
email: payload.ltks_emailNguoiYeuCau || 'Điền thiếu',
message: 'Điền thiếu',
caseNote: 'Điền thiếu',
```
Bất kỳ trường thông tin nào mà form Liên thông khai sinh chưa thu thập hoặc user không nhập đều được tự động fallback về `"Điền thiếu"` để chống vỡ layout trên Dashboard.

## File đã sửa/thêm
- Sửa: `frontend/src/components/pages/LienThongKhaiSinhPage.tsx`
- Sửa: `frontend/src/components/pages/OfficerDashboardPage.tsx`
- Thêm: `LIEN_THONG_KHAI_SINH_TO_DASHBOARD.md`

## Cách test lại
1. Truy cập trang Liên thông khai sinh (`/#/lien-thong-khai-sinh`).
2. Nhập một số thông tin (hoặc dùng AI tự điền/bỏ trống tùy ý), chuyển đến **Bước 4**, chọn tệp tin.
3. Qua **Bước 5**, bấm **Hoàn thành**. (Không còn ô nhập liệu Lời nhắn và Cần lưu ý).
4. Mở trình duyệt F12 -> Console để xem `SUBMIT PAYLOAD`. Bạn sẽ thấy object chứa `message` và `caseNote`.
5. Mở Dashboard Cán bộ (truy cập qua route dashboard cán bộ, `/dashboard` hoặc `/officer` trong ứng dụng).
6. Ở bảng danh sách, hồ sơ bạn vừa nộp sẽ nằm ở dòng đầu tiên với trạng thái "Chờ tiếp nhận".
7. Click vào hồ sơ đó để xem, phần panel Chi tiết hồ sơ bên phải sẽ hiển thị đầy đủ thông tin (nếu thiếu sẽ báo "Điền thiếu"). Hai trường `message` và `caseNote` sẽ tồn tại trong memory/storage nhưng không hiện trên giao diện.

## Giới hạn hiện tại nếu không sửa backend
- Toàn bộ hồ sơ nộp sẽ chỉ lưu ở LocalStorage của trình duyệt. Không thể chia sẻ cho người khác, mở tab ẩn danh hay thiết bị khác sẽ không thấy.
- Code sinh ID là random (`GOV-YYYY-xxxxxx`), có rủi ro trùng lặp cực nhỏ.
- Khi Refresh trang dashboard, dữ liệu vẫn còn do lưu LocalStorage, nhưng nếu xóa cache trình duyệt thì hồ sơ bị mất.
