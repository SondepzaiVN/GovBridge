import React, { useState } from "react";

interface PublicServiceReviewProps {
  onNext: () => void;
  onBack: () => void;
}

const TABS = [
  "Tờ khai đăng ký khai tử",
  "Tờ khai thay đổi thông tin cư trú (CT01)",
  "Tờ khai đề nghị hỗ trợ chi phí hỗ trợ chi phí mai táng",
];

const PublicServiceReview: React.FC<PublicServiceReviewProps> = ({
  onNext,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);

  return (
    <div
      style={{
        maxWidth: "960px",
        margin: "20px auto",
        padding: "40px",
        backgroundColor: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        borderRadius: "8px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* 1. KHỐI TABS (CHUYỂN ĐỔI GIỮA CÁC TỜ KHAI) */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #ccc",
          marginBottom: "20px",
          overflowX: "auto",
        }}
      >
        {TABS.map((tab, index) => (
          <div
            key={index}
            onClick={() => setActiveTab(index)}
            style={{
              padding: "12px 20px",
              cursor: "pointer",
              fontWeight: activeTab === index ? "bold" : "normal",
              color: activeTab === index ? "#b22222" : "#666",
              borderBottom:
                activeTab === index
                  ? "3px solid #b22222"
                  : "3px solid transparent",
              whiteSpace: "nowrap",
              transition: "all 0.3s ease",
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* 2. TRÌNH XEM TÀI LIỆU GIẢ LẬP (MOCK PDF VIEWER) */}
      <div
        style={{
          border: "1px solid #555",
          backgroundColor: "#333",
          borderRadius: "4px",
          overflow: "hidden",
          minHeight: "600px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Thanh công cụ (Toolbar) giả lập giống trình xem PDF */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#323639",
            padding: "10px 20px",
            color: "#f1f1f1",
            fontSize: "14px",
            borderBottom: "1px solid #222",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <span style={{ cursor: "pointer", fontSize: "18px" }}>≡</span>
            <span style={{ fontWeight: "bold" }}>{TABS[activeTab]}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <span>1 / 2</span>
            <span
              style={{ borderLeft: "1px solid #666", height: "15px" }}
            ></span>
            <span style={{ cursor: "pointer" }}>−</span>
            <span>100%</span>
            <span style={{ cursor: "pointer" }}>+</span>
            <span
              style={{ borderLeft: "1px solid #666", height: "15px" }}
            ></span>
            <span style={{ cursor: "pointer" }}>↻</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              fontSize: "16px",
            }}
          >
            <span style={{ cursor: "pointer" }}>⎙</span> {/* Icon Print */}
            <span style={{ cursor: "pointer" }}>⤓</span> {/* Icon Download */}
            <span style={{ cursor: "pointer" }}>⋮</span>
          </div>
        </div>

        {/* Vùng hiển thị giấy A4 ảo */}
        <div
          style={{
            backgroundColor: "#525659",
            flex: 1,
            padding: "30px",
            display: "flex",
            justifyContent: "center",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              width: "100%",
              maxWidth: "750px",
              padding: "50px 60px",
              boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
              color: "#000",
              lineHeight: "1.6",
            }}
          >
            {/* Nội dung Tờ khai Khai tử (Render theo tab đang chọn) */}
            {activeTab === 0 && (
              <>
                <div style={{ textAlign: "center", marginBottom: "30px" }}>
                  <h3 style={{ margin: 0, fontSize: "18px" }}>
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                  </h3>
                  <h4
                    style={{
                      margin: "5px 0 0 0",
                      fontSize: "16px",
                      textDecoration: "underline",
                    }}
                  >
                    Độc lập - Tự do - Hạnh phúc
                  </h4>
                  <h2
                    style={{
                      marginTop: "30px",
                      fontSize: "20px",
                      fontWeight: "bold",
                    }}
                  >
                    TỜ KHAI ĐĂNG KÝ KHAI TỬ
                  </h2>
                  <p style={{ marginTop: "15px" }}>
                    Kính gửi: <sup>(1)</sup> UBND Phường Tân An, Thành phố Cần
                    Thơ
                  </p>
                </div>

                <div style={{ fontSize: "15px" }}>
                  <p>
                    <strong>Họ, chữ đệm, tên người yêu cầu:</strong> ĐẶNG LAM
                    SƠN
                  </p>
                  <p>Ngày, tháng, năm sinh: 10/04/2006</p>
                  <p>
                    Nơi cư trú: <sup>(2)</sup> 228B TẦM VU, Phường Tân An, Thành
                    phố Cần Thơ
                  </p>
                  <p>
                    Giấy tờ tùy thân: <sup>(3)</sup> 092206004570 do Cục Cảnh
                    sát quản lý hành chính về trật tự xã hội cấp ngày 26/04/2021
                  </p>
                  <p>Quan hệ với người chết: Con</p>

                  <p style={{ marginTop: "20px" }}>
                    <strong>
                      Đề nghị cơ quan đăng ký khai tử cho người có tên dưới đây:
                    </strong>
                  </p>
                  <p>
                    <strong>Họ, chữ đệm, tên:</strong> [Tên người được khai tử]
                  </p>
                  <p>Ngày, tháng, năm sinh: [Ngày sinh]</p>
                  <p>Giới tính: [Giới tính]</p>
                  <p>
                    Dân tộc: Kinh &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Quốc
                    tịch: Việt Nam
                  </p>
                  <p>Nơi cư trú cuối cùng: [Nơi cư trú]</p>
                  <p>Giấy tờ tùy thân: [Số định danh]</p>
                  <p>
                    Đã chết vào lúc: ... giờ ... phút, ngày 23 tháng 06 năm 2026
                  </p>
                  <p>Nơi chết: [Chi tiết nơi chết]</p>
                  <p>Nguyên nhân chết: Sốt Dengue, sốt xuất huyết</p>
                  <p>
                    Giấy báo tử/Giấy tờ thay thế Giấy báo tử: [Số giấy tờ] do
                    [Cơ quan cấp] cấp ngày .../.../...
                  </p>
                </div>
              </>
            )}

            {/* Các tab khác hiển thị mô phỏng */}
            {activeTab === 1 && (
              <div
                style={{
                  textAlign: "center",
                  marginTop: "100px",
                  color: "#666",
                }}
              >
                <h2>TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (CT01)</h2>
                <p>
                  Nội dung tờ khai đang được hệ thống giả lập tự động tạo dựa
                  trên dữ liệu Bước 2...
                </p>
              </div>
            )}

            {activeTab === 2 && (
              <div
                style={{
                  textAlign: "center",
                  marginTop: "100px",
                  color: "#666",
                }}
              >
                <h2>TỜ KHAI ĐỀ NGHỊ HỖ TRỢ CHI PHÍ MAI TÁNG</h2>
                <p>
                  Nội dung tờ khai đang được hệ thống giả lập tự động tạo dựa
                  trên dữ liệu Bước 2...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. CÁC NÚT ĐIỀU HƯỚNG QUEN THUỘC */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          marginTop: "30px",
        }}
      >
        <button
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
          Hủy
        </button>
        <button
          onClick={onBack}
          style={{
            padding: "10px 24px",
            backgroundColor: "#fff",
            color: "#666",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          Quay lại bước trước
        </button>
        <button
          onClick={onNext}
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
          Chuyển bước tiếp theo
        </button>
      </div>
    </div>
  );
};

export default PublicServiceReview;
