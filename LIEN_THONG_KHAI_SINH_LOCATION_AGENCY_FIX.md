# Báo cáo: Sửa lỗi Cascade Select địa bàn và cơ quan tại trang Liên thông khai sinh

## 1. Nguồn dữ liệu đã sử dụng
Để đảm bảo thống nhất và tránh bịa dữ liệu mới, tôi đã áp dụng nguồn dữ liệu đang được sử dụng ở trang **Xác nhận thông tin về cư trú**:
- API: `https://provinces.open-api.vn/api/v2/` do `administrativeUnitService` đảm nhiệm (gọi qua custom hook).
- Mapping Tỉnh/Thành: Tái sử dụng mảng tĩnh `provinces` và `provinceCodeByName` thay vì gọi API cấp 1 (để giữ nguyên convention hiện có).

## 2. File helper dùng chung đã tạo
Đã tạo file `src/hooks/useAdministrativeUnits.ts` chứa:
- Mảng `provinces` (danh sách 63 tỉnh/thành phố).
- Object `provinceCodeByName` (map tên tỉnh sang mã tỉnh theo Open API VN).
- Hook `useWards(provinceName)` (gọi API lấy danh sách quận/huyện/phường/xã).
- Hàm `getKhaiSinhAgencyName(wardName)`: tự động trả về `UBND + Tên Phường/Xã`.
- Hàm `getResidenceAgencyName(wardName)`: tự động trả về `Công an + Tên Phường/Xã`.
- Hàm `getBhytAgencyName(wardName)`: tự động trả về `Bảo hiểm xã hội (theo + Tên Phường/Xã)`.

File `XacNhanCuTruPage.tsx` cũng đã được refactor để sử dụng helper này thay vì tự viết logic riêng, giúp giảm duplicate code.

## 3. Các thay đổi tại `LienThongKhaiSinhPage.tsx`
- Đã biến hằng số tĩnh `steps` thành hàm sinh cấu hình dynamic `getSteps(...)` để có thể nhận dữ liệu Phường/Xã từ API tuỳ theo từng Tỉnh/Thành phố được chọn.
- Áp dụng gọi 8 lần hook `useWards` cho 8 trường chọn địa bàn (Nơi sinh, Quê quán, Cha, Mẹ, Yêu cầu, Khai sinh, Thường trú).
- Tại hàm `handleChangeField` (bọc ngoài `setFieldValue`), tôi đã bổ sung logic **Cascade Reset**:
  - Khi `Tỉnh/Thành phố` thay đổi: xoá (reset) giá trị `Phường/Xã` và `Cơ quan` liên quan.
  - Khi `Phường/Xã` thay đổi: tự động điền `Cơ quan` tương ứng (UBND, Công an, BHXH).

## 4. Báo cáo về field "Huyện/Quận"
Theo API của `provinces.open-api.vn` gọi với tham số `depth=2`, danh sách trả về là danh sách các Quận/Huyện/Xã. Do cấu trúc schema API trả về key là `wards`, kết hợp với thiết kế form hiện tại gộp Quận/Huyện/Phường/Xã vào 1 dropdown cấp dưới, tôi đã giữ nguyên label của field là `Phường/Xã` để đồng bộ với UI hiện tại, nhưng khi người dùng chọn Tỉnh (VD: Hà Nội) thì dropdown sẽ xổ ra đầy đủ danh sách quận/huyện đúng thực tế (VD: Ba Đình, Hoàn Kiếm, v.v.) và tự động gen Cơ quan hợp lệ. 

Tất cả code đã được kiểm tra (build/lint pass) và payload submit được giữ nguyên cấu trúc mong muốn.
