import React, { useState } from "react";

// --- ĐỊNH NGHĨA KIỂU DỮ LIỆU ---
interface ApplicantInfo {
  fullName: string;
  idNumber: string;
  dob: string;
  gender: string;
  idIssueDate: string;
  idIssuePlace: string;
  residenceType: string;
  country: string;
  province: string;
  ward: string;
  addressDetail: string;
  relationship: string;
  phone: string;
  email: string;
}

interface DeceasedInfo {
  inputMethod: "manual" | "insurance";
  lastName: string;
  middleName: string;
  firstName: string;
  dob: string;
  gender: string;
  idNumber: string;
  idIssueDate: string;
  idIssuePlace: string;
  nationality: string;
  ethnicity: string;
  residenceType: string;
  residenceCountry: string;
  residenceProvince: string;
  residenceWard: string;
  residenceDetail: string;
  deathDate: string;
  isDeathPlaceSameAsResidence: boolean;
  deathCountry: string;
  deathProvince: string;
  deathWard: string;
}

const PublicServiceDeclaration: React.FC<{
  onNext: () => void;
  onBack: () => void;
}> = ({ onNext, onBack }) => {
  // 1. STATE THÔNG TIN NGƯỜI YÊU CẦU (Đã có sẵn từ tài khoản)
  const [applicantData, setApplicantData] = useState<ApplicantInfo>({
    fullName: "ĐẶNG LAM SƠN",
    idNumber: "092206004570",
    dob: "10/04/2006",
    gender: "Nam",
    idIssueDate: "26/04/2021",
    idIssuePlace: "Cục Cảnh sát QLHC về TTXH",
    residenceType: "Thường trú",
    country: "Cộng hòa XHCN Việt Nam",
    province: "Thành phố Cần Thơ",
    ward: "Phường Tân An",
    addressDetail: "228B TẦM VU",
    relationship: "",
    phone: "",
    email: "",
  });

  // 2. STATE THÔNG TIN NGƯỜI ĐƯỢC KHAI TỬ (Người dùng / Chatbot sẽ nhập)
  const [deceasedData, setDeceasedData] = useState<DeceasedInfo>({
    inputMethod: "manual",
    lastName: "",
    middleName: "",
    firstName: "",
    dob: "",
    gender: "",
    idNumber: "",
    idIssueDate: "",
    idIssuePlace: "",
    nationality: "Việt Nam",
    ethnicity: "Kinh", // Mặc định như trong ảnh
    residenceType: "Thường trú",
    residenceCountry: "Cộng hòa XHCN Việt Nam",
    residenceProvince: "",
    residenceWard: "",
    residenceDetail: "",
    deathDate: "23/06/2026",
    isDeathPlaceSameAsResidence: false,
    deathCountry: "",
    deathProvince: "",
    deathWard: "",
  });

  const handleApplicantChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setApplicantData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleDeceasedChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setDeceasedData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // --- CÁC STYLE TÁI SỬ DỤNG ---
  const headerStyle: React.CSSProperties = {
    color: "#b22222",
    margin: "30px 0 15px 0",
    fontSize: "20px",
    fontWeight: "bold",
    borderBottom: "2px solid #b22222",
    paddingBottom: "10px",
    display: "flex",
    justifyContent: "space-between",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#666",
    marginBottom: "5px",
    display: "block",
  };
  const readOnlyStyle: React.CSSProperties = {
    padding: "8px 0",
    borderBottom: "1px dotted #ccc",
    fontSize: "15px",
  };
  const inputYellowStyle: React.CSSProperties = {
    width: "100%",
    border: "none",
    background: "transparent",
    borderBottom: "1px solid #666",
    padding: "5px 0",
    outline: "none",
  };
  const yellowBox: React.CSSProperties = {
    backgroundColor: "transparent",
    padding: "10px",
    borderRadius: "4px",
  };

  return (
    <div className="ltkt-public-service-form">
      <section className="ltkt-form-card">
      {/* =========================================================
          PHẦN 1: THÔNG TIN NGƯỜI YÊU CẦU 
          ========================================================= */}
      <div style={headerStyle}>
        <span>Thông tin người yêu cầu</span>
        <button
          style={{
            backgroundColor: "#a04000",
            color: "#fff",
            border: "none",
            padding: "6px 12px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Xác thực với CSDLQG về dân cư
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr 0.8fr",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        <div>
          <label style={labelStyle}>
            Họ, chữ đệm, tên người yêu cầu{" "}
            <span style={{ color: "red" }}>*</span>
          </label>
          <div style={{ ...readOnlyStyle, fontWeight: "bold" }}>
            {applicantData.fullName}
          </div>
        </div>
        <div>
          <label style={labelStyle}>
            Số định danh <span style={{ color: "red" }}>*</span>
          </label>
          <div style={readOnlyStyle}>{applicantData.idNumber}</div>
        </div>
        <div>
          <label style={labelStyle}>
            Ngày sinh <span style={{ color: "red" }}>*</span>
          </label>
          <div style={readOnlyStyle}>{applicantData.dob}</div>
        </div>
        <div>
          <label style={labelStyle}>
            Giới tính <span style={{ color: "red" }}>*</span>
          </label>
          <div style={readOnlyStyle}>{applicantData.gender}</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <div style={yellowBox}>
          <label style={{ ...labelStyle, fontWeight: "bold", color: "#000" }}>
            Quan hệ với người chết <span style={{ color: "red" }}>*</span>
          </label>
          <select
            name="relationship"
            value={applicantData.relationship}
            onChange={handleApplicantChange}
            style={inputYellowStyle}
          >
            <option value="">-- Chọn --</option>
            <option value="Con">Con</option>
            <option value="Vợ/Chồng">Vợ/Chồng</option>
          </select>
        </div>
        <div style={yellowBox}>
          <label style={{ ...labelStyle, fontWeight: "bold", color: "#000" }}>
            Số điện thoại <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            name="phone"
            placeholder="Trường không được để trống"
            value={applicantData.phone}
            onChange={handleApplicantChange}
            style={inputYellowStyle}
          />
        </div>
        <div style={{ padding: "10px" }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            name="email"
            value={applicantData.email}
            onChange={handleApplicantChange}
            style={inputYellowStyle}
          />
        </div>
      </div>

      </section>

      <section className="ltkt-form-card">
      {/* =========================================================
          PHẦN 2: THÔNG TIN NGƯỜI ĐƯỢC KHAI TỬ
          ========================================================= */}
      <div style={headerStyle}>
        <span>Thông tin người được khai tử</span>
        <div>
          <button
            style={{
              backgroundColor: "#a04000",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              marginRight: "10px",
            }}
          >
            Xác thực với CSDLQG về dân cư
          </button>
          <button
            style={{
              backgroundColor: "#a04000",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Nhập lại
          </button>
        </div>
      </div>

      {/* Radio chọn phương thức nhập */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        <label
          style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <input
            type="radio"
            name="inputMethod"
            value="manual"
            checked={deceasedData.inputMethod === "manual"}
            onChange={handleDeceasedChange}
            style={{ accentColor: "#a04000", marginRight: "5px" }}
          />{" "}
          Nhập tay
        </label>
        <label
          style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <input
            type="radio"
            name="inputMethod"
            value="insurance"
            checked={deceasedData.inputMethod === "insurance"}
            onChange={handleDeceasedChange}
            style={{ accentColor: "#a04000", marginRight: "5px" }}
          />{" "}
          Lấy dữ liệu báo tử từ CSDL Bảo hiểm
        </label>
      </div>

      {/* Hàng 1: Họ tên */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1.5fr",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        <div>
          <label style={labelStyle}>Họ người được khai tử</label>
          <input
            type="text"
            name="lastName"
            style={inputYellowStyle}
            value={deceasedData.lastName}
            onChange={handleDeceasedChange}
          />
        </div>
        <div>
          <label style={labelStyle}>Chữ đệm người được khai tử</label>
          <input
            type="text"
            name="middleName"
            style={inputYellowStyle}
            value={deceasedData.middleName}
            onChange={handleDeceasedChange}
          />
        </div>
        <div style={yellowBox}>
          <label style={{ ...labelStyle, fontWeight: "bold", color: "#000" }}>
            Tên người được khai tử <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            name="firstName"
            style={inputYellowStyle}
            value={deceasedData.firstName}
            onChange={handleDeceasedChange}
          />
        </div>
      </div>

      {/* Hàng 2: Ngày sinh, Giới tính, Định danh */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        <div style={yellowBox}>
          <label style={{ ...labelStyle, fontWeight: "bold", color: "#000" }}>
            Ngày tháng năm sinh <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="date"
            name="dob"
            style={inputYellowStyle}
            value={deceasedData.dob}
            onChange={handleDeceasedChange}
          />
        </div>
        <div style={yellowBox}>
          <label style={{ ...labelStyle, fontWeight: "bold", color: "#000" }}>
            Giới tính <span style={{ color: "red" }}>*</span>
          </label>
          <select
            name="gender"
            style={inputYellowStyle}
            value={deceasedData.gender}
            onChange={handleDeceasedChange}
          >
            <option value="">-- Chọn --</option>
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
          </select>
        </div>
        <div style={yellowBox}>
          <label style={{ ...labelStyle, fontWeight: "bold", color: "#000" }}>
            Số định danh <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            name="idNumber"
            style={inputYellowStyle}
            value={deceasedData.idNumber}
            onChange={handleDeceasedChange}
          />
        </div>
        <div style={yellowBox}>
          <label style={{ ...labelStyle, fontWeight: "bold", color: "#000" }}>
            Ngày cấp <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="date"
            name="idIssueDate"
            style={inputYellowStyle}
            value={deceasedData.idIssueDate}
            onChange={handleDeceasedChange}
          />
        </div>
      </div>

      {/* Hàng 3: Quốc tịch, Dân tộc */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <div style={yellowBox}>
          <label style={{ ...labelStyle, fontWeight: "bold", color: "#000" }}>
            Nơi cấp <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            name="idIssuePlace"
            style={inputYellowStyle}
            value={deceasedData.idIssuePlace}
            onChange={handleDeceasedChange}
          />
        </div>
        <div>
          <label style={labelStyle}>
            Quốc tịch <span style={{ color: "red" }}>*</span>
          </label>
          <div style={readOnlyStyle}>{deceasedData.nationality}</div>
        </div>
        <div>
          <label style={labelStyle}>
            Dân tộc <span style={{ color: "red" }}>*</span>
          </label>
          <div style={readOnlyStyle}>{deceasedData.ethnicity}</div>
        </div>
      </div>

      <h4 style={{ color: "#a04000", margin: "0 0 15px 0" }}>
        Nơi cư trú cuối cùng
      </h4>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        <div>
          <label style={labelStyle}>
            Tỉnh/Thành phố <span style={{ color: "red" }}>*</span>
          </label>
          <select style={inputYellowStyle}>
            <option>Thành phố Cần Thơ</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>
            Phường/Xã <span style={{ color: "red" }}>*</span>
          </label>
          <select style={inputYellowStyle}>
            <option>Phường Tân An</option>
          </select>
        </div>
      </div>

      </section>

      <section className="ltkt-form-card">
      {/* =========================================================
          PHẦN 3: THỜI GIAN VÀ NƠI CHẾT
          ========================================================= */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: "40px",
          marginTop: "40px",
        }}
      >
        {/* Khối Thời gian */}
        <div>
          <h3
            style={{
              color: "#b22222",
              fontSize: "18px",
              borderBottom: "2px solid #b22222",
              paddingBottom: "10px",
            }}
          >
            Thời gian chết
          </h3>
          <div style={{ ...yellowBox, marginTop: "15px" }}>
            <label style={{ ...labelStyle, fontWeight: "bold", color: "#000" }}>
              Thời gian chết <span style={{ color: "red" }}>*</span>
            </label>
            <input
              type="date"
              name="deathDate"
              style={inputYellowStyle}
              value={deceasedData.deathDate}
              onChange={handleDeceasedChange}
            />
          </div>
        </div>

        {/* Khối Nơi chết */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              borderBottom: "2px solid #b22222",
              paddingBottom: "10px",
            }}
          >
            <h3 style={{ color: "#b22222", fontSize: "18px", margin: 0 }}>
              Nơi chết
            </h3>
            <label
              style={{ fontSize: "14px", cursor: "pointer", color: "#a04000" }}
            >
              <input
                type="checkbox"
                name="isDeathPlaceSameAsResidence"
                checked={deceasedData.isDeathPlaceSameAsResidence}
                onChange={handleDeceasedChange}
                style={{ accentColor: "#a04000", marginRight: "5px" }}
              />
              Là nơi cư trú cuối cùng
            </label>
          </div>
          <div
            style={{
              ...yellowBox,
              marginTop: "15px",
              opacity: deceasedData.isDeathPlaceSameAsResidence ? 0.6 : 1,
            }}
          >
            <label style={{ ...labelStyle, fontWeight: "bold", color: "#000" }}>
              Quốc gia <span style={{ color: "red" }}>*</span>
            </label>
            <select
              name="deathCountry"
              style={inputYellowStyle}
              disabled={deceasedData.isDeathPlaceSameAsResidence}
              value={deceasedData.deathCountry}
              onChange={handleDeceasedChange}
            >
              <option value="">-- Chọn --</option>
              <option value="VN">Cộng hòa XHCN Việt Nam</option>
            </select>
          </div>
        </div>
      </div>

      </section>

      <section className="ltkt-form-card">
      {/* =========================================================
          PHẦN 4: NGUYÊN NHÂN CHẾT & GIẤY BÁO TỬ
          ========================================================= */}
      <div style={{ marginTop: "20px" }}>
        <label style={labelStyle}>Chi tiết</label>
        <div
          style={{
            fontSize: "13px",
            fontStyle: "italic",
            color: "#d32f2f",
            marginBottom: "10px",
            lineHeight: "1.5",
          }}
        >
          Ghi chú cách kê khai thông tin địa chỉ chi tiết nơi chết: Chỉ ghi
          thông tin tên bệnh viện, cơ sở y tế (không ghi tên tỉnh, xã- thông tin
          tỉnh, xã được chọn từ danh mục trên); đối với trường hợp nơi chết
          ngoài cơ sở y tế thì ghi thông tin địa chỉ chi tiết là số nhà,
          đường,...
        </div>
        <div style={{ marginBottom: "30px" }}>
          <label style={labelStyle}>Nguyên nhân chết</label>
          <input
            type="text"
            name="causeOfDeath"
            defaultValue=""
            style={{
              width: "100%",
              padding: "8px 0",
              border: "none",
              borderBottom: "1px solid #ccc",
              outline: "none",
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #b22222",
          paddingBottom: "10px",
          marginBottom: "20px",
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
          Giấy báo tử/ Giấy thay thế giấy báo tử
        </h3>
        <label
          style={{
            fontSize: "14px",
            cursor: "pointer",
            color: "#a04000",
            display: "flex",
            alignItems: "center",
          }}
        >
          <input
            type="checkbox"
            style={{
              accentColor: "#a04000",
              marginRight: "5px",
              width: "16px",
              height: "16px",
            }}
          />
          UBND cấp xã có thẩm quyền đăng ký khai tử đồng thời có trách nhiệm cấp
          Giấy báo tử thì không thực hiện cấp Giấy báo tử
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        <div>
          <label style={labelStyle}>
            Loại giấy <span style={{ color: "red" }}>*</span>
          </label>
          <select
            style={{
              width: "100%",
              padding: "8px 0",
              border: "none",
              borderBottom: "1px solid #ccc",
              outline: "none",
            }}
          >
            <option value="">-- Chọn --</option>
            <option value="giay_bao_tu">Giấy báo tử</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>
            Số giấy tờ <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            style={{
              width: "100%",
              padding: "8px 0",
              border: "none",
              borderBottom: "1px solid #ccc",
              outline: "none",
            }}
          />
        </div>
        <div>
          <label style={labelStyle}>
            Ngày tháng cấp <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="date"
            style={{
              width: "100%",
              padding: "8px 0",
              border: "none",
              borderBottom: "1px solid #ccc",
              outline: "none",
            }}
          />
        </div>
      </div>
      <div style={{ marginBottom: "30px" }}>
        <label style={labelStyle}>
          Nơi cấp <span style={{ color: "red" }}>*</span>
        </label>
        <input
          type="text"
          style={{
            width: "100%",
            padding: "8px 0",
            border: "none",
            borderBottom: "1px solid #ccc",
            outline: "none",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          marginBottom: "40px",
        }}
      >
        <label style={{ fontSize: "14px", fontWeight: "bold" }}>
          Đề nghị cấp bản sao <span style={{ color: "red" }}>*</span>
        </label>
        <label style={{ cursor: "pointer" }}>
          <input
            type="radio"
            name="requestCopy"
            value="yes"
            defaultChecked
            style={{ accentColor: "#a04000" }}
          />{" "}
          Có
        </label>
        <div
          style={{
            ...yellowBox,
            padding: "5px 10px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <label style={{ fontSize: "12px", fontWeight: "bold" }}>
            Số lượng <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="number"
            defaultValue={1}
            style={{
              width: "50px",
              border: "none",
              borderBottom: "1px solid #666",
              background: "transparent",
              textAlign: "center",
              outline: "none",
            }}
          />{" "}
          Bản
        </div>
        <label style={{ cursor: "pointer" }}>
          <input
            type="radio"
            name="requestCopy"
            value="no"
            style={{ accentColor: "#a04000" }}
          />{" "}
          Không
        </label>
      </div>

      </section>

      <section className="ltkt-form-card">
      {/* =========================================================
          PHẦN 5: THÔNG TIN CHỦ HỘ
          ========================================================= */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "30px",
          borderBottom: "2px solid #b22222",
          paddingBottom: "10px",
          marginBottom: "20px",
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
          Thông tin chủ hộ
        </h3>
        <label
          style={{
            fontSize: "14px",
            cursor: "pointer",
            color: "#666",
            display: "flex",
            alignItems: "center",
          }}
        >
          <input
            type="checkbox"
            style={{ accentColor: "#a04000", marginRight: "5px" }}
          />{" "}
          Hộ chỉ có một thành viên duy nhất (là người được khai tử)
        </label>
        <label
          style={{
            fontSize: "14px",
            cursor: "pointer",
            color: "#666",
            display: "flex",
            alignItems: "center",
          }}
        >
          <input
            type="checkbox"
            style={{ accentColor: "#a04000", marginRight: "5px" }}
          />{" "}
          Là người kê khai
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "20px",
          marginBottom: "40px",
        }}
      >
        <div style={yellowBox}>
          <label style={{ ...labelStyle, fontWeight: "bold", color: "#000" }}>
            Họ tên chủ hộ <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            placeholder="Trường không được để trống"
            style={inputYellowStyle}
          />
        </div>
        <div style={yellowBox}>
          <label style={{ ...labelStyle, fontWeight: "bold", color: "#000" }}>
            Số định danh <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            placeholder="Trường không được để trống"
            style={inputYellowStyle}
          />
        </div>
        <div style={yellowBox}>
          <label style={{ ...labelStyle, fontWeight: "bold", color: "#000" }}>
            Mối quan hệ của người được khai tử với chủ hộ{" "}
            <span style={{ color: "red" }}>*</span>
          </label>
          <select style={inputYellowStyle}>
            <option value="">-- Chọn --</option>
            <option value="Cha">Cha</option>
            <option value="Mẹ">Mẹ</option>
            <option value="Vợ/Chồng">Vợ/Chồng</option>
            <option value="Con">Con</option>
          </select>
        </div>
      </div>

      </section>

      <section className="ltkt-form-card">
      {/* =========================================================
          PHẦN 6: THÔNG TIN MAI TÁNG PHÍ / TRỢ CẤP
          ========================================================= */}
      <h3
        style={{
          color: "#b22222",
          fontSize: "20px",
          fontWeight: "bold",
          borderBottom: "2px solid #b22222",
          paddingBottom: "10px",
          marginBottom: "20px",
        }}
      >
        Thông tin Mai táng phí/ Hỗ trợ chi phí mai táng
      </h3>

      <div style={{ marginBottom: "20px" }}>
        <label style={labelStyle}>
          Thời gian mai táng <span style={{ color: "red" }}>*</span>
        </label>
        <input
          type="date"
          defaultValue="2026-07-03"
          style={{
            padding: "8px 0",
            border: "none",
            borderBottom: "1px solid #ccc",
            outline: "none",
          }}
        />
      </div>

      <h4 style={{ color: "#a04000", margin: "0 0 15px 0" }}>Nơi mai táng</h4>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        <div>
          <label style={labelStyle}>
            Tỉnh/Thành phố <span style={{ color: "red" }}>*</span>
          </label>
          <select
            style={{
              width: "100%",
              padding: "8px 0",
              border: "none",
              borderBottom: "1px solid #ccc",
              outline: "none",
            }}
          >
            <option>-- Chọn --</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>
            Phường/Xã <span style={{ color: "red" }}>*</span>
          </label>
          <select
            style={{
              width: "100%",
              padding: "8px 0",
              border: "none",
              borderBottom: "1px solid #ccc",
              outline: "none",
            }}
          >
            <option>-- Chọn --</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: "30px" }}>
        <label style={labelStyle}>Chi tiết</label>
        <input
          type="text"
          style={{
            width: "100%",
            padding: "8px 0",
            border: "none",
            borderBottom: "1px solid #ccc",
          outline: "none",
          }}
        />
      </div>

      </section>

      <section className="ltkt-form-card">
      {/* =========================================================
          PHẦN 6: THÔNG TIN CƠ QUAN, TỔ CHỨC, CÁ NHÂN NHẬN TRỢ CẤP MAI TÁNG
          ========================================================= */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #b22222",
          paddingBottom: "10px",
          marginBottom: "20px",
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
          Thông tin cơ quan, tổ chức, cá nhân nhận trợ cấp mai táng
        </h3>
      </div>

      {/* Thanh điều khiển: Lựa chọn loại đối tượng, checkbox đồng bộ và các nút tác vụ */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "25px",
          flexWrap: "wrap",
          gap: "15px",
        }}
      >
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <label
            style={{ cursor: "pointer", fontWeight: "bold", color: "#a04000" }}
          >
            <input
              type="radio"
              name="recipientType"
              value="org"
              style={{ accentColor: "#a04000", marginRight: "5px" }}
            />{" "}
            Cơ quan tổ chức
          </label>
          <label
            style={{ cursor: "pointer", fontWeight: "bold", color: "#a04000" }}
          >
            <input
              type="radio"
              name="recipientType"
              value="individual"
              defaultChecked
              style={{ accentColor: "#a04000", marginRight: "5px" }}
            />{" "}
            Cá nhân
          </label>
          <label
            style={{
              cursor: "pointer",
              marginLeft: "15px",
              display: "flex",
              alignItems: "center",
              color: "#333",
            }}
          >
            <input
              type="checkbox"
              style={{ accentColor: "#a04000", marginRight: "5px" }}
            />{" "}
            Là người yêu cầu
          </label>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            style={{
              backgroundColor: "#a04000",
              color: "#fff",
              border: "none",
              padding: "8px 15px",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "13px",
            }}
          >
            Xác thực với CSDLQG về dân cư
          </button>
          <button
            style={{
              backgroundColor: "#a04000",
              color: "#fff",
              border: "none",
              padding: "8px 15px",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "13px",
            }}
          >
            Nhập lại
          </button>
        </div>
      </div>

      {/* Thông tin định danh cơ bản */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        <div>
          <label style={labelStyle}>
            Họ, chữ đệm, tên <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #ccc",
              padding: "8px 0",
              outline: "none",
            }}
          />
        </div>
        <div>
          <label style={labelStyle}>
            Ngày tháng năm sinh <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="date"
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #ccc",
              padding: "6px 0",
              outline: "none",
            }}
          />
        </div>
        <div>
          <label style={labelStyle}>
            Giới tính <span style={{ color: "red" }}>*</span>
          </label>
          <select
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #ccc",
              padding: "8px 0",
              outline: "none",
            }}
          >
            <option value="">-- Chọn --</option>
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
          </select>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr",
          gap: "20px",
          marginBottom: "25px",
        }}
      >
        <div>
          <label style={labelStyle}>
            Số định danh <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #ccc",
              padding: "8px 0",
              outline: "none",
            }}
          />
        </div>
        <div>
          <label style={labelStyle}>
            Ngày cấp <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="date"
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #ccc",
              padding: "6px 0",
              outline: "none",
            }}
          />
        </div>
        <div>
          <label style={labelStyle}>
            Nơi cấp <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #ccc",
              padding: "8px 0",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Phân nhóm: Nơi cư trú */}
      <h4
        style={{
          color: "#a04000",
          margin: "25px 0 10px 0",
          fontWeight: "bold",
          fontSize: "15px",
        }}
      >
        Nơi cư trú
      </h4>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "20px",
          marginBottom: "15px",
        }}
      >
        <div>
          <label style={labelStyle}>
            Loại cư trú <span style={{ color: "red" }}>*</span>
          </label>
          <select
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #ccc",
              padding: "8px 0",
              outline: "none",
            }}
          >
            <option value="ThuongTru">Thường trú</option>
            <option value="TamTru">Tạm trú</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>
            Tỉnh/Thành phố <span style={{ color: "red" }}>*</span>
          </label>
          <select
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #ccc",
              padding: "8px 0",
              outline: "none",
            }}
          >
            <option value="">-- Chọn Tỉnh/Thành --</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>
            Phường/Xã <span style={{ color: "red" }}>*</span>
          </label>
          <select
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #ccc",
              padding: "8px 0",
              outline: "none",
            }}
          >
            <option value="">-- Chọn Phường/Xã --</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: "25px" }}>
        <label style={labelStyle}>Chi tiết</label>
        <input
          type="text"
          style={{
            width: "100%",
            border: "none",
            borderBottom: "1px solid #ccc",
            padding: "8px 0",
            outline: "none",
          }}
        />
      </div>

      {/* Phân nhóm: Quê quán của người nhận mai táng phí */}
      <h4
        style={{
          color: "#a04000",
          margin: "25px 0 10px 0",
          fontWeight: "bold",
          fontSize: "15px",
        }}
      >
        Quê quán của người nhận mai táng phí
      </h4>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "20px",
          marginBottom: "15px",
        }}
      >
        <div>
          <label style={labelStyle}>
            Quốc gia <span style={{ color: "red" }}>*</span>
          </label>
          <select
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #ccc",
              padding: "8px 0",
              outline: "none",
            }}
          >
            <option value="">-- Chọn Quốc gia --</option>
            <option value="VN">Cộng hòa xã hội chủ nghĩa Việt Nam</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Tỉnh/Thành phố</label>
          <select
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #ccc",
              padding: "8px 0",
              outline: "none",
            }}
          >
            <option value="">-- Chọn Tỉnh/Thành --</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Phường/Xã</label>
          <select
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #ccc",
              padding: "8px 0",
              outline: "none",
            }}
          >
            <option value="">-- Chọn Phường/Xã --</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: "25px" }}>
        <label style={labelStyle}>Chi tiết</label>
        <input
          type="text"
          style={{
            width: "100%",
            border: "none",
            borderBottom: "1px solid #ccc",
            padding: "8px 0",
            outline: "none",
          }}
        />
      </div>

      {/* Các trường thông tin liên hệ và hình thức chi trả dưới cùng */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        <div>
          <label style={labelStyle}>Số điện thoại</label>
          <input
            type="text"
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #ccc",
              padding: "8px 0",
              outline: "none",
            }}
          />
        </div>
        <div>
          <label style={labelStyle}>
            Quan hệ với người chết <span style={{ color: "red" }}>*</span>
          </label>
          <select
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #ccc",
              padding: "8px 0",
              outline: "none",
            }}
          >
            <option value="">-- Chọn --</option>
            <option value="Con">Con</option>
            <option value="Vợ/Chồng">Vợ / Chồng</option>
            <option value="ChaMẹ">Cha / Mẹ</option>
            <option value="Khác">Khác</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: "40px", width: "50%" }}>
        <label style={labelStyle}>
          Hình thức nhận trợ cấp <span style={{ color: "red" }}>*</span>
        </label>
        <select
          style={{
            width: "100%",
            border: "none",
            borderBottom: "1px solid #ccc",
            padding: "8px 0",
            outline: "none",
          }}
        >
          <option value="">-- Chọn --</option>
          <option value="TienMat">Tiền mặt</option>
          <option value="ChuyenKhoan">
            Qua tài khoản ngân hàng (Chuyển khoản)
          </option>
        </select>
      </div>

      </section>

      {/* ĐIỀU HƯỚNG */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          marginTop: "50px",
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

export default PublicServiceDeclaration;
