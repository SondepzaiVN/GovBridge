# Quy tắc commit dự án

Sau khi hoàn thành các task, hãy tự kiểm tra các file đã thay đổi và tạo commit theo chuẩn Conventional Commit.

Format commit:
`<type>: <mô tả>`

Trong đó `<type>` phải chọn đúng theo ý nghĩa thay đổi:
- **feat**: thêm một feature/chức năng mới.
- **fix**: sửa bug, vá lỗi trong codebase.
- **refactor**: sửa lại code, cải thiện cấu trúc code nhưng không thêm feature mới và không trực tiếp fix bug.
- **docs**: thêm hoặc thay đổi tài liệu.
- **chore**: các sửa đổi nhỏ không liên quan trực tiếp tới code chính.
- **style**: thay đổi giao diện, CSS, UI, layout hoặc format code mà không làm thay đổi logic xử lý.
- **perf**: cải tiến hiệu năng xử lý.
- **vendor**: cập nhật version dependencies, packages hoặc thư viện bên ngoài.
