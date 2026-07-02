# Officer dashboard left filter fix report

## Kết luận

Thanh filter bên trái đã lọc đúng danh sách hồ sơ theo trạng thái, giữ trạng thái filter khi xem chi tiết, cập nhật count theo dữ liệu hiện tại và có thể trở về toàn bộ hồ sơ. Thay đổi chỉ nằm ở frontend.

## 1. Dashboard cán bộ

### Route/page

- Route: `/#/can-bo`.
- Page: `frontend/src/components/pages/OfficerDashboardPage.tsx`.

### Component thanh filter bên trái

Thanh filter nằm trực tiếp trong `OfficerDashboardPage`, tại phần tử `aside.officer-sidebar`.

### Component danh sách hồ sơ

Danh sách nằm trong `section.officer-workspace`, sử dụng bảng `table.officer-application-table`.

### Nguồn data hồ sơ

- Mock data `RAW_INITIAL_APPLICATIONS` trong page.
- Dữ liệu hồ sơ mới và hồ sơ đã xử lý trong localStorage, key `officerApplications`.
- Hai nguồn được normalize rồi hợp nhất theo mã hồ sơ.

## 2. Lỗi filter đã phát hiện

### Filter trạng thái

- Dữ liệu dùng lẫn `Đang xử lý` và `Đang xử lí`, dễ làm lệch count/filter.
- Hồ sơ localStorage chỉ normalize một số field và chưa hỗ trợ status key tiếng Anh.
- Việc đồng bộ hồ sơ đang chọn qua effect làm state khó ổn định khi đổi filter.

### Filter loại thủ tục

Dashboard hiện không có control filter loại thủ tục, nên không thêm mới ngoài phạm vi task. Tên thủ tục vẫn được normalize an toàn để sẵn sàng cho logic hiện có.

### Filter ngày nộp nếu có

Dashboard hiện không có control filter ngày nộp, nên không thêm mới.

### Reset filter

`Tất cả hồ sơ` reset filter về toàn bộ danh sách. Empty state có thêm nút `Xóa bộ lọc`.

### Count số lượng nếu có

Count trước đây phụ thuộc trực tiếp vào dữ liệu chưa normalize. Count hiện tính từ danh sách đã normalize, gồm cả mock và localStorage, và cập nhật sau mỗi action đổi trạng thái.

## 3. Cách fix

### Normalize dữ liệu hồ sơ

Thêm `normalizeOfficerApplication` để chuẩn hóa mã hồ sơ, thủ tục, trạng thái, ngày nộp, cơ quan/địa bàn, thông tin người nộp, tài liệu và tệp đính kèm. Alias tiếng Việt và tiếng Anh được map về cùng status label.

### Logic apply filter

Thêm `filterOfficerApplications`. Hàm trả về mảng mới, chỉ lọc trên dữ liệu đã normalize và không mutate dữ liệu gốc. Dashboard không có search nên search UI/state/logic đã được loại bỏ.

### Logic reset filter

Chọn `Tất cả hồ sơ` hoặc `Xóa bộ lọc` đặt status filter về `Tất cả`, khôi phục danh sách đầy đủ và chọn hồ sơ đầu tiên phù hợp.

### Logic pagination nếu có

Dashboard hiện không có pagination, nên không phát sinh logic reset trang.

## 4. Các trạng thái hỗ trợ

- `Chờ tiếp nhận`
- `Đã tiếp nhận`
- `Đang xử lí`
- `Đã phê duyệt`
- `Đã từ chối`

Các key `pending_reception`, `received`, `processing`, `approved`, `rejected` và cách viết cũ `Đang xử lý` cũng được normalize.

## 5. Cách xử lý hồ sơ thiếu field

Field chuỗi thiếu dùng fallback `Điền thiếu`; `details` dùng object rỗng; `documents` và `attachments` dùng mảng rỗng. Status thiếu/không hợp lệ hiển thị `Điền thiếu` và không làm crash filter.

## 6. File đã sửa/thêm

- `frontend/src/components/pages/OfficerDashboardPage.tsx`
- `frontend/src/utils/officerApplicationFilters.ts`
- `frontend/src/index.css`
- `OFFICER_DASHBOARD_LEFT_FILTER_FIX_REPORT.md`

## 7. Cách test lại

1. Đăng nhập tài khoản cán bộ và mở `/#/can-bo`.
2. Lần lượt chọn năm trạng thái ở sidebar, kiểm tra bảng chỉ hiển thị hồ sơ cùng trạng thái.
3. Chọn trạng thái có count bằng 0, kiểm tra empty state và nút `Xóa bộ lọc`.
4. Chọn `Tất cả hồ sơ`, kiểm tra toàn bộ hồ sơ xuất hiện lại.
5. Đổi trạng thái hồ sơ bằng các action tiếp nhận, xử lí, phê duyệt hoặc từ chối; kiểm tra count cập nhật.
6. Reload trang để kiểm tra dữ liệu localStorage vẫn được normalize và filter hoạt động.

Kết quả kiểm tra thực tế:

- `npm run build`: đạt, backend và frontend build thành công.
- `npm test`: đạt, 7 test files và 97 tests backend đều pass.
- ESLint riêng hai file TypeScript thay đổi: đạt.
- `npm run lint`: còn 14 lỗi có sẵn ở các module ngoài dashboard cán bộ; thay đổi của task không tạo lỗi lint mới.
- Browser QA tại `/#/can-bo`: cả năm trạng thái, empty state, reset, count và lựa chọn chi tiết hoạt động đúng; không có lỗi console.
- Viewport mobile 390px: sidebar và bảng không làm tràn ngang trang.

## 8. Giới hạn hiện tại do không sửa backend

Filter chỉ áp dụng cho dữ liệu mock và localStorage trong trình duyệt hiện tại. Dashboard chưa có API phân trang/filter phía server và task không cho phép thay đổi backend.
