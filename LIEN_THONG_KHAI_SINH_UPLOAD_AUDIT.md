# Kiểm tra upload file bước 4 - Liên thông khai sinh

## Kết luận
Trước khi kiểm tra, hệ thống **chưa lấy được file ở bước 4**. Component upload file (`UploadDocumentsTable`) thực chất chỉ là giao diện giả (mock UI) với các nút bấm rỗng (không có thẻ `<input type="file">`). Đồng thời luồng Submit ở bước 5 ("Hoàn thành") không thực hiện gọi API hay build payload chứa dữ liệu từ các form, mà chỉ đơn thuần chuyển sang giao diện thành công ở bước 6.

Sau khi phát hiện, tôi **đã thực hiện sửa lỗi (implement fix)** ở component phía frontend để đảm bảo file tải lên được lưu giữ và tích hợp vào payload submit như yêu cầu.

## Route/page liên quan
- Route: `/lien-thong-khai-sinh` và `/lien-thong-khai-sinh/:stepSlug`
- Component cha: `LienThongKhaiSinhPage`

## File/component đã kiểm tra và sửa
- **Đã kiểm tra và sửa**: `frontend/src/components/pages/LienThongKhaiSinhPage.tsx`
- **Đã kiểm tra**: `frontend/src/contexts/FormContext.tsx`, `frontend/src/types/index.ts`

## Luồng upload file bước 4 (Hiện tại sau khi fix)
- Trong `UploadDocumentsTable`, đã bổ sung thẻ `<input type="file" />` bị ẩn. Khi người dùng click nút "Chọn tệp tin", thẻ input này sẽ được trigger.
- File upload được lưu vào biến `uploadedFiles` (kiểu `Record<string, File>`) bằng `React.useState` nằm trong local state của component cha `LienThongKhaiSinhPage`.
- Do React Router không unmount component `LienThongKhaiSinhPage` khi thay đổi parameter `stepSlug` (khi chuyển qua lại giữa các bước), state `uploadedFiles` không bị mất đi. UI cũng được cập nhật để hiển thị tên file nếu file đã được chọn.

## Luồng submit hồ sơ
- Khi người dùng nhấn nút **Hoàn thành** ở Bước 5 (Hàm `handleNext` với `currentStep === 5`).
- Hệ thống sẽ chặn luồng chuyển trang và tiến hành build payload submit.
- Dữ liệu text lấy từ `formState.values` của Context.

## Payload hiện tại (Mock console.log)
- Payload tổng hợp bao gồm toàn bộ form values và object đính kèm `attachments`. Cụ thể:
```js
{
  ...formState.values,
  attachments: {
    step4Files: [
      {
        fieldName: "Tờ khai thay đổi thông tin cư trú...",
        fileName: "file_cua_toi.pdf",
        file: [object File], // Giữ nguyên object File
        size: 10245,
        type: "application/pdf"
      }
    ]
  }
}
```

## File được lưu/gửi ở đâu
- **Trước khi submit**: File nằm ở local state `uploadedFiles` của `LienThongKhaiSinhPage`.
- **Khi submit**: Nằm trong `payload.attachments.step4Files` và được in ra qua `console.log('SUBMIT PAYLOAD:', payload)`.
- **Backend API**: Hiện tại Backend chưa có API submit liên thông thực tế (Component chỉ hiển thị `CompletePanel` thành công rồi dừng). Dữ liệu đã được chuẩn bị đầy đủ sẵn sàng cho bước tích hợp tiếp theo (vd: chuyển sang dùng `FormData` ở `apiClient`).

## Rủi ro hiện tại
- Do file lưu ở React local state, nếu người dùng **tải lại trang (F5/Refresh)** ở bất kỳ bước nào, toàn bộ file đã upload ở bước 4 sẽ bị mất (vì state reset).
- Text form thì vẫn giữ được do FormContext đang dùng `sessionStorage`, nhưng JSON không thể lưu lại object `File` native.

## Đề xuất nếu cần cải thiện
- Chuyển logic handle file sang một Store mạnh hơn hoặc một Database tạm (như IndexedDB) nếu muốn file tồn tại kể cả khi refresh trình duyệt.
- Xây dựng API thực tế nhận multi-part form data ở backend để có thể gọi hàm `apiClient.post` nộp toàn bộ formData.

## Hướng dẫn test lại (Manual Testing Checklist)
1. Mở trang Liên thông khai sinh.
2. Điền thông tin cơ bản và next đến **bước 4**.
3. Nhấn nút **Chọn tệp tin** ở hàng bất kỳ, upload 1 file pdf/ảnh. Tên file sẽ hiển thị trên nút thay vì chữ "Chọn tệp tin".
4. Bấm **Chuyển bước tiếp theo** để qua bước 5.
5. Bấm **Quay lại bước trước** để trở về bước 4 -> File cũ đã upload vẫn còn nguyên (hiện tên file).
6. Đi tiếp đến **bước 5**, điền Captcha và check các điều khoản, bấm **Hoàn thành**.
7. Bật **F12 / Console** của trình duyệt.
8. Sẽ thấy object payload xuất hiện với log `SUBMIT PAYLOAD:` có chứa toàn bộ dữ liệu form và object `attachments.step4Files` chứa đúng thông tin file đã up. Không có lỗi nào xảy ra với UI.
