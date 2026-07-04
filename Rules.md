# Quy tắc kiểm tra văn bản cư trú

Phạm vi hiện tại: tờ khai CT01 và giấy tờ đính kèm cho các thủ tục đăng ký thường trú, đăng ký tạm trú, xác nhận thông tin cư trú.

Kết quả cần trả về:

- `flag = green`: văn bản đọc được rõ, đúng loại giấy tờ, nội dung phù hợp thủ tục, không phát hiện mâu thuẫn quan trọng với dữ liệu form.
- `flag = red`: văn bản không đọc được, không đúng loại giấy tờ, thiếu thông tin bắt buộc, nội dung đề nghị sai mục đích, hoặc có mâu thuẫn quan trọng với dữ liệu form.

## 1. Quy tắc cho CT01

CT01 phải có dấu hiệu nhận diện là tờ khai/thông tin thay đổi cư trú hoặc nội dung tương đương.

Mục "10. Nội dung đề nghị" phải ghi rõ nội dung cần thực hiện và phải khớp với thủ tục hiện tại. Nội dung hợp lệ có thể là:

- Đăng ký thường trú vào địa chỉ cụ thể.
- Đăng ký tạm trú vào địa chỉ cụ thể.
- Xác nhận thông tin cư trú.
- Tách hộ, nhập hộ, điều chỉnh thông tin cư trú hoặc nội dung cư trú khác phù hợp thủ tục.

Đánh dấu không hợp lệ nếu mục nội dung đề nghị:

- Bỏ trống hoặc quá chung chung.
- Ghi sai mục đích thủ tục.
- Ghi nội dung không liên quan cư trú, ví dụ đi xuất khẩu lao động, du học, vay vốn, xin việc.
- Mâu thuẫn với thủ tục đang thao tác trên hệ thống.

## 2. Đối chiếu với dữ liệu form

Nếu form có dữ liệu, đối chiếu các thông tin OCR được từ văn bản với form:

- Họ và tên.
- Số CCCD/số định danh cá nhân.
- Ngày sinh.
- Số điện thoại/email nếu có.
- Địa chỉ thường trú/tạm trú/địa chỉ đề nghị.
- Nội dung đề nghị/thủ tục.

Đánh dấu không hợp lệ nếu có mâu thuẫn rõ ràng giữa văn bản và form ở các trường trên. Nếu OCR không đủ rõ để đối chiếu, nêu là chưa đủ căn cứ và dùng `flag = red` nếu trường đó là thông tin trọng yếu.

## 3. Giấy phép xây dựng có thời hạn

Nếu văn bản là giấy phép xây dựng có thời hạn:

- Tìm ngày cấp/ngày ký.
- So với ngày ký tên hoặc ngày hiện tại nếu không có ngày ký tên.
- Nếu quá 3 năm, kết luận hồ sơ không hợp lệ theo rule demo.

## 4. Giấy tờ về quyền sử dụng đất/chỗ ở

Kiểm tra trường "Mục đích sử dụng đất" hoặc nội dung tương đương.

Hợp lệ nếu có một trong các dấu hiệu:

- "Đất ở tại nông thôn".
- "Đất ở tại đô thị".
- "ONT".
- "ODT".
- Có thông tin về nhà ở hoặc tài sản gắn liền với đất.
- Có giấy phép xây dựng hợp lệ hoặc xác nhận của UBND về nhà ở, đất ở không tranh chấp.

Cảnh báo/không hợp lệ nếu chỉ có một trong các dấu hiệu:

- "Đất trồng lúa".
- "Đất chuyên trồng lúa nước".
- "Đất trồng cây hằng năm".
- "Đất trồng cây lâu năm".
- "Đất nông nghiệp".
- "Đất nuôi trồng thủy sản".
- "Đất rừng sản xuất".

## 5. Cách diễn đạt nhận xét

Nhận xét phải ngắn gọn, dễ hiểu cho người dân:

- Nêu kết luận trước: hợp lệ hoặc chưa hợp lệ.
- Nêu 1-3 lý do chính.
- Nêu người dân cần sửa/bổ sung gì.
- Không khẳng định hồ sơ chắc chắn được cơ quan nhà nước phê duyệt; chỉ nói "theo kiểm tra sơ bộ".
