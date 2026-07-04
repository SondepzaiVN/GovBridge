import React, { useEffect, useState } from "react";
import { administrativeUnitService } from "../../../api/administrativeUnitService";
import { useForm } from "../../../contexts/FormContext";
import type { FormFieldOption } from "../../../types";

const DOI_TUONG_MAI_TANG_PHI: string[] = [
  "Đối tượng được hưởng trợ cấp mai táng phí theo quy định của Luật BHXH",
  "Đối tượng hưởng mai táng phí theo Pháp lệnh ưu đãi người có công",
  "Đối tượng bảo trợ xã hội",
  "Đối tượng nhận trợ cấp khẩn cấp",
];

interface PublicServiceFormProps {
  onNext?: () => void;
}

const PublicServiceForm: React.FC<PublicServiceFormProps> = ({ onNext }) => {
  const { setFieldValue } = useForm();
  const [provinceOptions, setProvinceOptions] = useState<FormFieldOption[]>([]);
  const [khaituWardOptions, setKhaituWardOptions] = useState<FormFieldOption[]>([]);
  const [thuongtruWardOptions, setThuongtruWardOptions] = useState<FormFieldOption[]>([]);
  const [maitangWardOptions, setMaitangWardOptions] = useState<FormFieldOption[]>([]);
  const [isLoadingProvinces, setIsLoadingProvinces] = useState<boolean>(true);
  const [isLoadingKhaituWards, setIsLoadingKhaituWards] = useState<boolean>(false);
  const [isLoadingThuongtruWards, setIsLoadingThuongtruWards] = useState<boolean>(false);
  const [isLoadingMaitangWards, setIsLoadingMaitangWards] = useState<boolean>(false);

  // --- STATE KHỐI 1: ĐĂNG KÝ KHAI TỬ ---
  const [khaituProvince, setKhaituProvince] = useState<string>("");
  const [khaituWard, setKhaituWard] = useState<string>("");
  const khaituAgency = khaituWard ? `UBND ${khaituWard}` : "";

  // --- STATE LOGIC: CÙNG ĐỊA BÀN ---
  const [isSameLocation, setIsSameLocation] = useState<boolean>(true); // Mặc định tích chọn như trong ảnh

  // --- STATE KHỐI 2: XÓA ĐĂNG KÝ THƯỜNG TRÚ ---
  const [rawThuongtruProvince, setRawThuongtruProvince] = useState<string>("");
  const [rawThuongtruWard, setRawThuongtruWard] = useState<string>("");
  const thuongtruProvince = isSameLocation
    ? khaituProvince
    : rawThuongtruProvince;
  const thuongtruWard = isSameLocation ? khaituWard : rawThuongtruWard;
  const thuongtruAgency = thuongtruWard ? `Công an ${thuongtruWard}` : "";

  // --- STATE KHỐI 3: MAI TÁNG PHÍ ---
  const [maitangDoiTuong, setMaitangDoiTuong] = useState<string[]>([]);
  const [isMaitangDropdownOpen, setIsMaitangDropdownOpen] =
    useState<boolean>(false);
  const [maitangProvince, setMaitangProvince] = useState<string>("");
  const [maitangWard, setMaitangWard] = useState<string>("");
  const maitangAgency = maitangWard ? `UBND ${maitangWard}` : "";

  useEffect(() => {
    setFieldValue("ltkt_agency_khaitu_province", khaituProvince);
    setFieldValue("ltkt_agency_khaitu_ward", khaituWard);
    setFieldValue("ltkt_agency_khaitu_name", khaituAgency);
    setFieldValue("ltkt_agency_thuongtru_province", thuongtruProvince);
    setFieldValue("ltkt_agency_thuongtru_ward", thuongtruWard);
    setFieldValue("ltkt_agency_thuongtru_name", thuongtruAgency);
    setFieldValue("ltkt_agency_maitang_province", maitangProvince);
    setFieldValue("ltkt_agency_maitang_ward", maitangWard);
    setFieldValue("ltkt_agency_maitang_name", maitangAgency);
    setFieldValue("ltkt_agency_maitang_doiTuong", maitangDoiTuong.join("; "));
  }, [
    khaituAgency,
    khaituProvince,
    khaituWard,
    maitangAgency,
    maitangDoiTuong,
    maitangProvince,
    maitangWard,
    setFieldValue,
    thuongtruAgency,
    thuongtruProvince,
    thuongtruWard,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    administrativeUnitService
      .getProvinces(controller.signal)
      .then(setProvinceOptions)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setProvinceOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingProvinces(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!khaituProvince) return;

    const controller = new AbortController();

    administrativeUnitService
      .getWards(khaituProvince, controller.signal)
      .then(setKhaituWardOptions)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setKhaituWardOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingKhaituWards(false);
      });

    return () => controller.abort();
  }, [khaituProvince]);

  useEffect(() => {
    if (!rawThuongtruProvince) return;

    const controller = new AbortController();

    administrativeUnitService
      .getWards(rawThuongtruProvince, controller.signal)
      .then(setThuongtruWardOptions)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setThuongtruWardOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingThuongtruWards(false);
      });

    return () => controller.abort();
  }, [rawThuongtruProvince]);

  useEffect(() => {
    if (!maitangProvince) return;

    const controller = new AbortController();

    administrativeUnitService
      .getWards(maitangProvince, controller.signal)
      .then(setMaitangWardOptions)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMaitangWardOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingMaitangWards(false);
      });

    return () => controller.abort();
  }, [maitangProvince]);

  const toggleMaitangDoiTuong = (dt: string) => {
    setMaitangDoiTuong((prev) => {
      let nextSelected = [...prev];
      if (nextSelected.includes(dt)) {
        nextSelected = nextSelected.filter((item) => item !== dt);
      } else {
        nextSelected.push(dt);
        if (dt === "Đối tượng bảo trợ xã hội") {
          nextSelected = nextSelected.filter(
            (item) => item !== "Đối tượng nhận trợ cấp khẩn cấp",
          );
        } else if (dt === "Đối tượng nhận trợ cấp khẩn cấp") {
          nextSelected = nextSelected.filter(
            (item) => item !== "Đối tượng bảo trợ xã hội",
          );
        }
      }
      nextSelected.sort(
        (a, b) =>
          DOI_TUONG_MAI_TANG_PHI.indexOf(a) - DOI_TUONG_MAI_TANG_PHI.indexOf(b),
      );
      return nextSelected;
    });
  };

  // --- GIAO DIỆN CHÍNH ---
  return (
    <div
      className="ltkt-public-service-form"
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
      {/* KHỐI 1: KHAI TỬ */}
      <section className="ltkt-form-card">
      <div
        style={{ display: "flex", alignItems: "center", marginBottom: "25px" }}
      >
        <h3
          style={{
            color: "#8b2611",
            margin: 0,
            fontSize: "16px",
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}
        >
          Cơ quan thực hiện đăng ký khai tử
        </h3>
        <div
          style={{
            flex: 1,
            height: "1px",
            backgroundColor: "#8b2611",
            marginLeft: "15px",
          }}
        ></div>
      </div>

      <div style={{ display: "flex", gap: "40px", marginBottom: "20px" }}>
        <div style={{ flex: 1 }}>
          <label
            style={{
              fontSize: "12px",
              color: "#333",
              fontWeight: "bold",
              display: "block",
            }}
          >
            Tỉnh/Thành phố <span style={{ color: "red" }}>*</span>
          </label>
          <select
            id="khaitu-province"
            value={khaituProvince}
            disabled={isLoadingProvinces}
            onChange={(e) => {
              setKhaituProvince(e.target.value);
              setKhaituWard("");
              setKhaituWardOptions([]);
              setIsLoadingKhaituWards(Boolean(e.target.value));
            }}
            style={{
              width: "100%",
              padding: "8px 0",
              marginTop: "5px",
              border: "none",
              borderBottom: "1px solid #ccc",
              outline: "none",
              fontSize: "15px",
              color: "#333",
              backgroundColor: "transparent",
              cursor: "pointer",
            }}
          >
            <option value="">-- Chọn --</option>
            {provinceOptions.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label
            style={{
              fontSize: "12px",
              color: "#333",
              fontWeight: "bold",
              display: "block",
            }}
          >
            Phường/Xã <span style={{ color: "red" }}>*</span>
          </label>
          <select
            id="khaitu-ward"
            value={khaituWard}
            disabled={!khaituProvince || isLoadingKhaituWards}
            onChange={(e) => setKhaituWard(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 0",
              marginTop: "5px",
              border: "none",
              borderBottom: "1px solid #ccc",
              outline: "none",
              fontSize: "15px",
              color: "#333",
              backgroundColor: "transparent",
              cursor: "pointer",
            }}
          >
            <option value="">-- Chọn --</option>
            {khaituWardOptions.map((w) => (
              <option key={w.value} value={w.label}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: "40px" }}>
        <label
          style={{
            fontSize: "12px",
            color: "#333",
            fontWeight: "bold",
            display: "block",
          }}
        >
          Cơ quan thực hiện <span style={{ color: "red" }}>*</span>
        </label>
        <div
          className="ltkt-agency-display"
          style={{
            padding: "8px 0",
            fontSize: "15px",
            color: "#333",
          }}
        >
          {khaituAgency}
        </div>
      </div>
      </section>

      {/* KHỐI 2: THƯỜNG TRÚ */}
      <section className="ltkt-form-card">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "25px",
          justifyContent: "space-between",
        }}
      >
        <h3
          style={{
            color: "#8b2611",
            margin: 0,
            fontSize: "16px",
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}
        >
          Cơ quan thực hiện xóa đăng ký thường trú
        </h3>
        <div
          style={{
            flex: 1,
            height: "1px",
            backgroundColor: "#8b2611",
            margin: "0 15px",
          }}
        ></div>
        <label
          style={{
            color: "#333",
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            whiteSpace: "nowrap",
          }}
        >
          <input
            id="same-location-checkbox"
            type="checkbox"
            checked={isSameLocation}
            onChange={(e) => setIsSameLocation(e.target.checked)}
            style={{
              marginRight: "8px",
              accentColor: "#8b2611",
              width: "16px",
              height: "16px",
            }}
          />
          Cùng địa bàn thực hiện đăng ký khai tử
        </label>
      </div>

      <div
        style={{
          display: "flex",
          gap: "40px",
          marginBottom: "20px",
          opacity: isSameLocation ? 0.6 : 1,
          pointerEvents: isSameLocation ? "none" : "auto",
        }}
      >
        <div style={{ flex: 1 }}>
          <label
            style={{
              fontSize: "12px",
              color: "#333",
              fontWeight: "bold",
              display: "block",
            }}
          >
            Tỉnh/Thành phố <span style={{ color: "red" }}>*</span>
          </label>
          <select
            id="thuongtru-province"
            value={thuongtruProvince}
            disabled={isSameLocation || isLoadingProvinces}
            onChange={(e) => {
              setRawThuongtruProvince(e.target.value);
              setRawThuongtruWard("");
              setThuongtruWardOptions([]);
              setIsLoadingThuongtruWards(Boolean(e.target.value));
            }}
            style={{
              width: "100%",
              padding: "8px 0",
              marginTop: "5px",
              border: "none",
              borderBottom: "1px solid #ccc",
              outline: "none",
              fontSize: "15px",
              color: "#333",
              backgroundColor: "transparent",
              cursor: "pointer",
            }}
          >
            <option value="">-- Chọn --</option>
            {provinceOptions.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label
            style={{
              fontSize: "12px",
              color: "#333",
              fontWeight: "bold",
              display: "block",
            }}
          >
            Phường/Xã <span style={{ color: "red" }}>*</span>
          </label>
          <select
            id="thuongtru-ward"
            value={thuongtruWard}
            disabled={isSameLocation || !thuongtruProvince || isLoadingThuongtruWards}
            onChange={(e) => setRawThuongtruWard(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 0",
              marginTop: "5px",
              border: "none",
              borderBottom: "1px solid #ccc",
              outline: "none",
              fontSize: "15px",
              color: "#333",
              backgroundColor: "transparent",
              cursor: "pointer",
            }}
          >
            <option value="">-- Chọn --</option>
            {(isSameLocation ? khaituWardOptions : thuongtruWardOptions).map((w) => (
              <option key={w.value} value={w.label}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: "40px", opacity: isSameLocation ? 0.6 : 1 }}>
        <label
          style={{
            fontSize: "12px",
            color: "#333",
            fontWeight: "bold",
            display: "block",
          }}
        >
          Cơ quan thực hiện <span style={{ color: "red" }}>*</span>
        </label>
        <div
          className="ltkt-agency-display"
          style={{
            padding: "8px 0",
            fontSize: "15px",
            color: "#333",
          }}
        >
          {thuongtruAgency}
        </div>
      </div>
      </section>

      {/* KHỐI 3: MAI TÁNG PHÍ */}
      <section className="ltkt-form-card">
      <div
        style={{ display: "flex", alignItems: "center", marginBottom: "25px" }}
      >
        <h3
          style={{
            color: "#8b2611",
            margin: 0,
            fontSize: "16px",
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}
        >
          Cơ quan thực hiện giải quyết chế độ mai táng phí, tử tuất
        </h3>
        <div
          style={{
            flex: 1,
            height: "1px",
            backgroundColor: "#8b2611",
            marginLeft: "15px",
          }}
        ></div>
      </div>

      <div style={{ marginBottom: "20px", position: "relative" }}>
        <label
          style={{
            fontSize: "12px",
            color: "#333",
            fontWeight: "bold",
            display: "block",
          }}
        >
          Đối tượng hưởng trợ cấp mai táng phí{" "}
          <span style={{ color: "red" }}>*</span>
        </label>

        {/* Custom Select Box */}
        <div
          onClick={() => setIsMaitangDropdownOpen(!isMaitangDropdownOpen)}
          style={{
            width: "100%",
            padding: "8px 0",
            marginTop: "5px",
            borderBottom: "1px solid #ccc",
            fontSize: "15px",
            color: "#333",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            minHeight: "35px",
          }}
        >
          <div
            style={{
              flex: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {maitangDoiTuong.length > 0 ? (
              maitangDoiTuong.join(", ")
            ) : (
              <span style={{ color: "#999" }}>Chọn đối tượng...</span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              color: "#666",
            }}
          >
            {maitangDoiTuong.length > 0 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setMaitangDoiTuong([]);
                }}
                style={{ cursor: "pointer", fontSize: "14px" }}
              >
                ✕
              </span>
            )}
            <span style={{ fontSize: "12px" }}>▼</span>
          </div>
        </div>

        {/* Validation Message */}
        {maitangDoiTuong.length === 0 && (
          <div style={{ color: "#c00", fontSize: "12px", marginTop: "5px" }}>
            Trường không được để trống
          </div>
        )}

        {/* Dropdown Options */}
        {isMaitangDropdownOpen && (
          <>
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9,
              }}
              onClick={() => setIsMaitangDropdownOpen(false)}
            />
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                backgroundColor: "#fff",
                border: "1px solid #ccc",
                boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                zIndex: 10,
                marginTop: "2px",
                maxHeight: "250px",
                overflowY: "auto",
              }}
            >
              {DOI_TUONG_MAI_TANG_PHI.map((dt) => (
                <label
                  key={dt}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    padding: "10px",
                    cursor: "pointer",
                    borderBottom: "1px solid #eee",
                    fontSize: "14px",
                    color: "#333",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={maitangDoiTuong.includes(dt)}
                    onChange={() => toggleMaitangDoiTuong(dt)}
                    style={{
                      marginRight: "10px",
                      marginTop: "2px",
                      accentColor: "#8b2611",
                    }}
                  />
                  <span>{dt}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {maitangDoiTuong.length > 0 &&
        (maitangDoiTuong.includes(
          "Đối tượng được hưởng trợ cấp mai táng phí theo quy định của Luật BHXH",
        ) ? (
          <div
            style={{
              marginBottom: "30px",
              fontSize: "15px",
              color: "#333",
              fontStyle: "italic",
              fontWeight: "bold",
            }}
          >
            Cơ quan BHXH thực hiện tiếp nhận và giải quyết hồ sơ mai táng phí,
            tử tuất.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: "40px", marginBottom: "20px" }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: "12px",
                    color: "#333",
                    fontWeight: "bold",
                    display: "block",
                  }}
                >
                  Tỉnh/Thành phố <span style={{ color: "red" }}>*</span>
                </label>
                <select
                  id="maitang-province"
                  value={maitangProvince}
                  disabled={isLoadingProvinces}
                  onChange={(e) => {
                    setMaitangProvince(e.target.value);
                    setMaitangWard("");
                    setMaitangWardOptions([]);
                    setIsLoadingMaitangWards(Boolean(e.target.value));
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 0",
                    marginTop: "5px",
                    border: "none",
                    borderBottom: "1px solid #ccc",
                    outline: "none",
                    fontSize: "15px",
                    color: "#333",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <option value="">-- Chọn --</option>
                  {provinceOptions.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: "12px",
                    color: "#333",
                    fontWeight: "bold",
                    display: "block",
                  }}
                >
                  Phường/Xã <span style={{ color: "red" }}>*</span>
                </label>
                <select
                  id="maitang-ward"
                  value={maitangWard}
                  disabled={!maitangProvince || isLoadingMaitangWards}
                  onChange={(e) => setMaitangWard(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 0",
                    marginTop: "5px",
                    border: "none",
                    borderBottom: "1px solid #ccc",
                    outline: "none",
                    fontSize: "15px",
                    color: "#333",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <option value="">-- Chọn --</option>
                  {maitangWardOptions.map((w) => (
                    <option key={w.value} value={w.label}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: "30px" }}>
              <label
                style={{
                  fontSize: "12px",
                  color: "#333",
                  fontWeight: "bold",
                  display: "block",
                }}
              >
                Cơ quan thực hiện <span style={{ color: "red" }}>*</span>
              </label>
              <div
                className="ltkt-agency-display"
                style={{
                  padding: "8px 0",
                  fontSize: "15px",
                  color: "#333",
                }}
              >
                {maitangAgency}
              </div>
            </div>
          </>
        ))}
      </section>

      {/* FOOTER BUTTONS */}
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

export default PublicServiceForm;
