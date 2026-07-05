import React, { useState } from "react";
import { MissingRequiredFieldsModal } from "../../common/MissingRequiredFieldsModal";

interface PublicServiceResultOptionsProps {
  onNext: () => void;
  onBack: () => void;
}

const PublicServiceResultOptions: React.FC<PublicServiceResultOptionsProps> = ({
  onNext,
  onBack,
}) => {
  // --- STATES ---
  const [khaiTuResult, setKhaiTuResult] = useState(
    "Đến cơ quan giải quyết để nhận kết quả",
  );
  const [thuongTruResult, setThuongTruResult] = useState("Qua cổng thông tin");
  const [isElectronicCopy, setIsElectronicCopy] = useState(true);
  const [isPaperCopy, setIsPaperCopy] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [isCommitted, setIsCommitted] = useState(false);
  const [showMissingRequiredModal, setShowMissingRequiredModal] = useState(false);

  // --- STYLES ---
  const sectionTitleStyle: React.CSSProperties = {
    color: "#b22222",
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "15px",
    marginTop: "30px",
    display: "flex",
    alignItems: "center",
    gap: "20px",
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 0",
    border: "none",
    borderBottom: "1px dotted #ccc",
    outline: "none",
    fontSize: "15px",
    color: "#333",
    backgroundColor: "transparent",
  };

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
      {/* 1. KẾT QUẢ ĐĂNG KÝ KHAI TỬ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          alignItems: "center",
        }}
      >
        <h3
          style={{
            color: "#b22222",
            fontSize: "18px",
            margin: 0,
            fontWeight: "bold",
          }}
        >
          Hình thức nhận kết quả đăng ký khai tử
        </h3>
        <select
          value={khaiTuResult}
          onChange={(e) => setKhaiTuResult(e.target.value)}
          style={selectStyle}
        >
          <option value="Đến cơ quan giải quyết để nhận kết quả">
            Đến cơ quan giải quyết để nhận kết quả
          </option>
          <option value="Qua bưu điện">Qua bưu điện</option>
        </select>
      </div>
      <div style={{ marginTop: "15px" }}>
        <div style={{ fontSize: "12px", color: "#666" }}>Nơi trả kết quả</div>
        <div
          style={{
            fontSize: "15px",
            padding: "5px 0",
            borderBottom: "1px dotted #ccc",
          }}
        >
          UBND Phường Tân An
        </div>
      </div>

      {/* 2. KẾT QUẢ XÓA ĐĂNG KÝ THƯỜNG TRÚ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          alignItems: "center",
          marginTop: "40px",
        }}
      >
        <h3
          style={{
            color: "#b22222",
            fontSize: "18px",
            margin: 0,
            fontWeight: "bold",
          }}
        >
          Hình thức nhận kết quả xóa đăng ký thường trú
        </h3>
        <select
          value={thuongTruResult}
          onChange={(e) => setThuongTruResult(e.target.value)}
          style={selectStyle}
        >
          <option value="Qua cổng thông tin">Qua cổng thông tin</option>
        </select>
      </div>

      {/* 3. KẾT QUẢ TRỢ CẤP MAI TÁNG PHÍ */}
      <div style={sectionTitleStyle}>
        Hình thức nhận kết quả giải quyết hưởng trợ cấp mai táng/Quyết định hỗ
        trợ chi phí mai táng, tử tuất
        <div
          style={{ flex: 1, height: "1px", backgroundColor: "#b22222" }}
        ></div>
      </div>

      <h4
        style={{ color: "#a04000", fontSize: "16px", margin: "20px 0 10px 0" }}
      >
        Quyết định hưởng trợ cấp
      </h4>

      <div style={{ marginBottom: "10px" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            fontSize: "15px",
          }}
        >
          <input
            type="checkbox"
            checked={isElectronicCopy}
            onChange={(e) => setIsElectronicCopy(e.target.checked)}
            style={{ width: "18px", height: "18px", accentColor: "#a04000" }}
          />
          Bản điện tử
        </label>
        <p
          style={{
            fontStyle: "italic",
            fontSize: "13px",
            color: "#555",
            margin: "5px 0 15px 25px",
            lineHeight: "1.5",
          }}
        >
          Các kết quả thủ tục hành chính được gửi vào kho quản lý dữ liệu điện
          tử của người yêu cầu trên Cổng dịch vụ công quốc gia, ứng dụng VNeID
          và Hệ thống thông tin giải quyết thủ tục hành chính cấp bộ, cấp tỉnh
        </p>
      </div>

      <div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            fontSize: "15px",
          }}
        >
          <input
            type="checkbox"
            checked={isPaperCopy}
            onChange={(e) => setIsPaperCopy(e.target.checked)}
            style={{ width: "18px", height: "18px", accentColor: "#a04000" }}
          />
          Bản giấy
        </label>
      </div>

      <h4
        style={{ color: "#a04000", fontSize: "16px", margin: "30px 0 10px 0" }}
      >
        Tiền trợ cấp mai táng phí
      </h4>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          border: "1px solid #dee2e6",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#a04000", color: "#fff" }}>
            <th
              style={{
                padding: "12px",
                border: "1px solid #dee2e6",
                width: "30%",
                textAlign: "center",
              }}
            >
              Người nhận
            </th>
            <th
              style={{
                padding: "12px",
                border: "1px solid #dee2e6",
                textAlign: "left",
              }}
            >
              Hình thức nhận
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td
              style={{
                padding: "15px",
                border: "1px solid #dee2e6",
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              ĐẶNG LAM SƠN
            </td>
            <td style={{ padding: "15px", border: "1px solid #dee2e6" }}>
              <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                Tiền mặt
              </div>
              <div>Qua bưu điện (trên địa bàn)</div>
            </td>
          </tr>
        </tbody>
      </table>
      <div
        style={{
          fontStyle: "italic",
          fontSize: "13px",
          color: "#555",
          marginTop: "10px",
        }}
      >
        Nhận tiền mặt tại cơ quan UBND Phường Tân An. Địa chỉ: Phường Tân An,
        Thành phố Cần Thơ
      </div>

      {/* 4. CAPTCHA & CAM ĐOAN */}
      <div
        style={{
          marginTop: "50px",
          display: "flex",
          alignItems: "flex-end",
          gap: "20px",
        }}
      >
        <div style={{ flex: 1, maxWidth: "300px" }}>
          <label style={{ fontSize: "14px", color: "#333" }}>
            Nhập mã kiểm tra <span style={{ color: "red" }}>*</span>
          </label>
          <input
            id="captcha-input"
            type="text"
            value={captcha}
            onChange={(e) => setCaptcha(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 0",
              border: "none",
              borderBottom: "1px solid #999",
              outline: "none",
              marginTop: "5px",
              fontSize: "16px",
            }}
          />
        </div>

        {/* Hình ảnh Captcha giả lập (Bạn có thể thay bằng ảnh thật nếu muốn) */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              backgroundColor: "#f4e5d3",
              padding: "10px 30px",
              letterSpacing: "5px",
              fontSize: "24px",
              fontWeight: "bold",
              color: "#5a2d22",
              fontFamily: '"Courier New", Courier, monospace',
              userSelect: "none",
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.05) 10px, rgba(0,0,0,0.05) 20px)",
            }}
          >
            xJ1M
          </div>
          <span
            style={{ color: "#0056b3", cursor: "pointer", fontSize: "20px" }}
          >
            ↻
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: "30px",
          backgroundColor: "#f9f9f9",
          padding: "15px",
          borderLeft: "4px solid #a04000",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            cursor: "pointer",
            fontSize: "14px",
            lineHeight: "1.5",
            color: "#333",
          }}
        >
          <input
            id="commitment-checkbox"
            type="checkbox"
            checked={isCommitted}
            onChange={(e) => setIsCommitted(e.target.checked)}
            style={{
              width: "18px",
              height: "18px",
              accentColor: "#a04000",
              marginTop: "2px",
            }}
          />
          Tôi cam đoan nội dung đề nghị trên đây là đúng sự thật, được sự thỏa
          thuận nhất trí của các bên liên quan theo quy định pháp luật. Tôi chịu
          hoàn toàn trách nhiệm trước pháp luật về nội dung cam đoan của mình.
        </label>
      </div>

      {/* 5. ĐIỀU HƯỚNG */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "15px",
          marginTop: "40px",
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
          onClick={() => {
            setShowMissingRequiredModal(false);
            if (!captcha || !isCommitted) {
              setShowMissingRequiredModal(true);
              return;
            }
            onNext();
          }}
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
          Hoàn thành
        </button>
        <button
          style={{
            padding: "10px 24px",
            backgroundColor: "#8b4513",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          Lưu nháp
        </button>
      </div>
      {showMissingRequiredModal && (
        <MissingRequiredFieldsModal onClose={() => setShowMissingRequiredModal(false)} />
      )}
    </div>
  );
};

export default PublicServiceResultOptions;
