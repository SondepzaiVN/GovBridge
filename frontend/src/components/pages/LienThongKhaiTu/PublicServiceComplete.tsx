import React, { useState, useEffect } from "react";

interface PublicServiceCompleteProps {
  applicationCode: string;
  onReset?: () => void; // Hàm để quay lại từ đầu nếu cần
}

const PublicServiceComplete: React.FC<PublicServiceCompleteProps> = ({
  applicationCode,
  onReset,
}) => {
  // State để quản lý việc hiển thị thông báo thành công
  const [showToast, setShowToast] = useState<boolean>(true);

  // Hiệu ứng tự động ẩn thông báo sau 3.5 giây
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowToast(false);
    }, 3500);
    return () => clearTimeout(timer); // Dọn dẹp timer khi component unmount
  }, []);

  return (
    <div
      style={{
        position: "relative",
        maxWidth: "960px",
        margin: "20px auto",
        padding: "40px",
        backgroundColor: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        borderRadius: "8px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* THÔNG BÁO FLOAT (TOAST) MÀU XANH */}
      {showToast && (
        <div
          style={{
            position: "absolute",
            top: "-60px",
            right: "0",
            backgroundColor: "#28a745", // Màu xanh lá success
            color: "white",
            padding: "10px 20px",
            borderRadius: "4px",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            animation: "fadeIn 0.5s, fadeOut 0.5s 3s",
            zIndex: 1000,
          }}
        >
          <span
            style={{
              backgroundColor: "#fff",
              color: "#28a745",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "14px",
            }}
          >
            ✓
          </span>
          Kê khai thành công!
        </div>
      )}

      {/* TIÊU ĐỀ BƯỚC 6 */}
      <div style={{ marginBottom: "20px" }}>
        <h2
          style={{
            display: "inline-block",
            backgroundColor: "#ffeb3b", // Nền màu vàng như trong ảnh
            padding: "8px 15px",
            margin: 0,
            fontSize: "22px",
            color: "#000",
            borderRadius: "4px",
          }}
        >
          BƯỚC 6: HOÀN THÀNH NỘP HỒ SƠ
        </h2>
      </div>

      {/* KHUNG NỘI DUNG CHÍNH */}
      <div
        style={{
          backgroundColor: "#fff",
          padding: "30px",
          border: "1px solid #e0e0e0",
          borderRadius: "4px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          lineHeight: "1.8",
          color: "#333",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* CSS mô phỏng hoa văn chìm (watermark) hoa sen nhẹ nhàng phía sau */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.03,
            pointerEvents: "none",
            backgroundImage:
              "radial-gradient(circle at center, #000 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        ></div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <p
            style={{
              color: "#b22222",
              textAlign: "center",
              fontSize: "16px",
              margin: "0 0 10px 0",
            }}
          >
            Vui lòng ghi nhớ các thông tin bên dưới để theo dõi tình hình xử lý
            hoặc cập nhật thông tin hồ sơ của bạn.
          </p>
          <p
            style={{
              color: "#b22222",
              textAlign: "center",
              fontSize: "18px",
              fontWeight: "bold",
              margin: "0 0 20px 0",
            }}
          >
            Số hồ sơ: {applicationCode}
          </p>

          <div style={{ fontSize: "15px" }}>
            <p>
              Thời gian giải quyết của <strong>hồ sơ liên thông</strong> là
              không quá <strong>11 ngày làm việc</strong> đối với trường hợp trợ
              cấp mai táng do cơ quan Bảo hiểm xã hội giải quyết.
            </p>
            <p style={{ margin: "10px 0" }}>Cụ thể:</p>
            <ul style={{ listStyleType: "none", paddingLeft: 0, margin: 0 }}>
              <li
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  marginBottom: "8px",
                }}
              >
                <span style={{ marginRight: "8px" }}>-</span>
                <span>
                  Hồ sơ đăng ký khai tử: 01 ngày làm việc (hoặc 03 ngày làm việc
                  đối với trường hợp phải xác minh) kể từ khi cán bộ tiếp nhận
                  hồ sơ.
                </span>
              </li>
              <li
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  marginBottom: "8px",
                }}
              >
                <span style={{ marginRight: "8px" }}>-</span>
                <span>
                  Hồ sơ Xóa đăng ký thường trú: 02 ngày làm việc kể từ khi cán
                  bộ tiếp nhận hồ sơ.
                </span>
              </li>
              <li
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  marginBottom: "8px",
                }}
              >
                <span style={{ marginRight: "8px" }}>-</span>
                <span>Hồ sơ trợ cấp mai táng phí/Hỗ trợ chi phí mai táng:</span>
              </li>
            </ul>
            <div style={{ paddingLeft: "15px", marginTop: "5px" }}>
              <p style={{ margin: 0 }}>
                + Đối tượng hưởng theo luật BHXH: 10 ngày làm việc kể từ khi cán
                bộ tiếp nhận hồ sơ.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* NÚT ĐIỀU HƯỚNG VỀ TRANG CHỦ HOẶC IN BIÊN NHẬN (Bổ sung để hoàn thiện UI) */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          marginTop: "40px",
        }}
      >
        <button
          onClick={onReset}
          style={{
            padding: "10px 24px",
            backgroundColor: "#e0e0e0",
            color: "#333",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          Về trang chủ
        </button>
        <button
          style={{
            padding: "10px 24px",
            backgroundColor: "#a04000",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          In Biên Lai
        </button>
      </div>
    </div>
  );
};

export default PublicServiceComplete;
