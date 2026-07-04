import React from "react";
import { Link } from "react-router-dom";
import type { CCCDInfo, PublicService, FormField } from "../../types";
import { useForm } from "../../contexts/FormContext";
import { quickValidate, validateForm } from "../../utils/validator";
import { Camera, ChevronRight, Home } from "lucide-react";
import { applicationService } from "../../api/applicationService";
import { ApiClientError } from "../../api/client";
import { ocrService } from "../../api/aiServices";

// ============================================================
// Reusable form field renderer
// ============================================================
interface FieldProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  isAutofilled?: boolean;
  disabled?: boolean;
}

export const FormFieldInput: React.FC<FieldProps> = ({
  field,
  value,
  onChange,
  isAutofilled,
  disabled,
}) => {
  const finalDisabled = disabled !== undefined ? disabled : field.disabled;
  const [error, setError] = React.useState("");
  const { formState, setFieldError } = useForm();
  const mergedError = error || formState.errors[field.id] || "";
  const isLockedValidValue = finalDisabled && !!value.trim() && !quickValidate(field.id, value, field.label);
  const displayError = isLockedValidValue ? "" : mergedError;

  const handleChange = (val: string) => {
    onChange(val);
    const err = quickValidate(field.id, val, field.label);
    setError(err || "");
  };

  React.useEffect(() => {
    if (!isLockedValidValue) return;
    if (formState.errors[field.id]) setFieldError(field.id, "");
  }, [field.id, formState.errors, isLockedValidValue, setFieldError]);

  const inputClass = `form-input${isAutofilled ? " autofilled" : ""}${displayError ? " error" : ""}`;
  const selectClass = `form-select${isAutofilled ? " autofilled" : ""}${displayError ? " error" : ""}`;
  const textareaClass = `form-textarea${isAutofilled ? " autofilled" : ""}${displayError ? " error" : ""}`;

  const commonProps = {
    id: field.id,
    "data-field": field.id,
    "data-highlight-id": field.id,
    "aria-label": field.label,
    "aria-required": field.required,
    "aria-invalid": !!displayError,
  };

  let inputEl: React.ReactNode;

  switch (field.type) {
    case "select":
      inputEl = (
        <select
          {...commonProps}
          className={selectClass}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={finalDisabled}
        >
          <option value="">— Chọn —</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
      break;

    case "textarea":
      inputEl = (
        <textarea
          {...commonProps}
          className={textareaClass}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          disabled={finalDisabled}
        />
      );
      break;

    case "radio":
      inputEl = (
        <div
          className="radio-group"
          role="radiogroup"
          aria-labelledby={`${field.id}-label`}
        >
          {field.options?.map((opt) => (
            <label key={opt.value} className="radio-option">
              <input
                type="radio"
                name={field.id}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => handleChange(opt.value)}
                disabled={finalDisabled}
                data-highlight-id={`${field.id}-${opt.value}`}
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
      break;

    default:
      inputEl = (
        <input
          {...commonProps}
          className={inputClass}
          type={
            field.type === "date"
              ? "date"
              : field.type === "phone"
                ? "tel"
                : "text"
          }
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={finalDisabled}
          autoComplete={
            field.type === "phone"
              ? "tel"
              : field.id.includes("Ten")
                ? "name"
                : "off"
          }
        />
      );
  }

  return (
    <div
      className={`form-group${field.type === "textarea" ? " full-width" : ""}`}
    >
      <label className="form-label" htmlFor={field.id} id={`${field.id}-label`}>
        {field.label}
        {field.required && (
          <span className="required" aria-label="bắt buộc">
            {" "}
            *
          </span>
        )}
      </label>
      {inputEl}
      {displayError && (
        <span className="form-error-msg" role="alert">
          ⚠️ {displayError}
        </span>
      )}
      {isAutofilled && !displayError && (
        <span className="form-hint" style={{ color: "var(--accent)" }}>
          ✓ Đã tự động điền
        </span>
      )}
    </div>
  );
};

// ============================================================
// Reusable Service Page Layout
// ============================================================
interface ServicePageProps {
  service: PublicService;
  categoryLabel: string;
  cccdOcrActions?: CccdOcrAction[];
}

export interface CccdOcrAction {
  id: string;
  label: string;
  fieldMap: Record<string, keyof CCCDInfo>;
  insertBeforeFieldId?: string;
}

const normalizeOcrText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizeCccdNumber = (value: string) => value.replace(/\D/g, "");

export const ServicePageLayout: React.FC<ServicePageProps> = ({
  service,
  categoryLabel,
  cccdOcrActions = [],
}) => {
  const {
    formState,
    setFieldValue,
    setFieldError,
    touchField,
    setIsSubmitting,
  } = useForm();
  const [submittedId, setSubmittedId] = React.useState("");
  const [submitError, setSubmitError] = React.useState("");
  const [ocrNotice, setOcrNotice] = React.useState("");
  const [isReadingCccd, setIsReadingCccd] = React.useState(false);
  const cccdInputRef = React.useRef<HTMLInputElement>(null);
  const activeOcrActionRef = React.useRef<CccdOcrAction | null>(null);

  const showOcrNotice = (message: string) => {
    setOcrNotice(message);
    window.setTimeout(() => setOcrNotice(""), 3200);
  };

  const getOcrFieldValue = (fieldId: string, cccdKey: keyof CCCDInfo, info: CCCDInfo) => {
    const rawValue = String(info[cccdKey] || "");
    if (cccdKey === "id") return normalizeCccdNumber(rawValue);
    if (cccdKey !== "gioiTinh") return rawValue;

    const normalizedGender = normalizeOcrText(rawValue);
    const field = service.fields.find((item) => item.id === fieldId);
    const matchedOption = field?.options?.find((option) => {
      const optionValue = normalizeOcrText(option.value);
      const optionLabel = normalizeOcrText(option.label);
      if (normalizedGender.includes("nu")) return optionValue === "nu" || optionLabel === "nu";
      if (normalizedGender.includes("nam")) return optionValue === "nam" || optionLabel === "nam";
      return false;
    });

    if (matchedOption) return matchedOption.value;
    if (normalizedGender.includes("nu")) return "Nữ";
    if (normalizedGender.includes("nam")) return "Nam";
    return "";
  };

  const handleOpenCccdOcr = (action: CccdOcrAction) => {
    activeOcrActionRef.current = action;
    cccdInputRef.current?.click();
  };

  const handleCccdOcrUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const action = activeOcrActionRef.current;
    if (!file || !action) return;

    setIsReadingCccd(true);
    try {
      const info = await ocrService.extractCCCDInfo(await ocrService.resizeImage(file));
      Object.entries(action.fieldMap).forEach(([fieldId, cccdKey]) => {
        const value = getOcrFieldValue(fieldId, cccdKey, info);
        if (!value) return;
        setFieldValue(fieldId, value);
        touchField(fieldId);
        setFieldError(fieldId, "");
      });
      showOcrNotice(`Đã điền ${action.label.toLowerCase()} từ CCCD.`);
    } catch (error) {
      console.error("Không đọc được CCCD cho biểu mẫu:", error);
      showOcrNotice("Không đọc được CCCD. Vui lòng thử lại ảnh rõ hơn.");
    } finally {
      setIsReadingCccd(false);
      event.target.value = "";
    }
  };

  const renderOcrAction = (action: CccdOcrAction) => (
    <div className="service-ocr-action-row" key={`ocr-${action.id}`}>
      <span className="service-ocr-action-title">{action.label}</span>
      <button
        type="button"
        className="dktt-section-camera-btn"
        onClick={() => handleOpenCccdOcr(action)}
        disabled={isReadingCccd}
        title={`Đọc CCCD cho ${action.label.toLowerCase()}`}
        aria-label={`Đọc CCCD cho ${action.label.toLowerCase()}`}
      >
        <Camera size={16} />
      </button>
    </div>
  );

  const renderOcrActionsBeforeField = (fieldId: string) =>
    cccdOcrActions
      .filter((action) => action.insertBeforeFieldId === fieldId)
      .map(renderOcrAction);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSubmittedId("");

    const errors = validateForm(formState.values, service.fields);
    service.fields.forEach((field) => {
      touchField(field.id);
      setFieldError(
        field.id,
        errors.find((error) => error.field === field.id)?.message || "",
      );
    });
    if (errors.length > 0) return;

    try {
      setIsSubmitting(true);
      const application = await applicationService.submit({
        serviceId: service.id,
        submittedAt: new Date().toISOString(),
        data: Object.fromEntries(
          service.fields.map((field) => [field.id, formState.values[field.id] || ""]),
        ),
      });
      setSubmittedId(application.id);
    } catch (error) {
      if (error instanceof ApiClientError) {
        error.details?.forEach((detail) => {
          if (!detail.field) return;
          touchField(detail.field);
          setFieldError(detail.field, detail.message);
        });
      }
      setSubmitError(error instanceof Error ? error.message : "Không thể nộp hồ sơ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldValue = (fieldId: string) => formState.values[fieldId] || "";
  const isAutofilled = (fieldId: string) =>
    !!formState.touched[fieldId] && !!formState.values[fieldId];

  // Group fields by section (every 5 fields or by type)
  const fieldGroups: FormField[][] = [];
  let currentGroup: FormField[] = [];
  service.fields.forEach((f, i) => {
    currentGroup.push(f);
    if ((i + 1) % 5 === 0 || i === service.fields.length - 1) {
      fieldGroups.push(currentGroup);
      currentGroup = [];
    }
  });

  return (
    <div className="main-content dktt-main-content service-standard-page animate-slide-up">
      {/* Breadcrumb */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">
          <Home size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
          Trang Chủ
        </Link>
        <ChevronRight size={13} className="breadcrumb-sep" />
        <span>{categoryLabel}</span>
        <ChevronRight size={13} className="breadcrumb-sep" />
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {service.name}
        </span>
      </nav>

      <div className="service-page">
        {/* Main Form */}
        <div>
          <div
            className="form-section"
            id="form-section"
            data-highlight-id="form-section"
          >
            {/* Header */}
            <div className="form-section-header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* <div style={{ fontSize: "2rem" }}>{service.icon}</div> */}
                <div>
                  <h1 className="form-section-title">{service.name}</h1>
                  <p className="form-section-subtitle">{service.description}</p>
                </div>
              </div>
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  gap: 16,
                  fontSize: "0.8rem",
                  opacity: 0.9,
                }}
              >
                <span>⏱ {service.processingTime}</span>
                {/* <span>💰 {service.fee}</span> */}
              </div>
            </div>

            <div className="dktt-ai-hint" data-highlight-id="ai-hint">
              <span className="dktt-ai-hint-icon">
                <img src="/logo_Gov_Bridge.jpg" alt="AI" />
              </span>
              <span>
                <strong>Mẹo:</strong> Nhấn vào nút Trợ lý AI (góc phải) để tự
                động điền form bằng <strong>giọng nói</strong> hoặc{" "}
                <strong>ảnh CCCD</strong>.
              </span>
            </div>

            <div className="dktt-required-note">
              <strong>Ghi chú:</strong> Các thông tin có dấu{" "}
              <span className="red">(*)</span> là thông tin bắt buộc phải nhập
            </div>

            {/* Form body */}
            <form className="form-body" onSubmit={handleSubmit} noValidate>
              {cccdOcrActions.length > 0 && (
                <input
                  ref={cccdInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="dktt-hidden-file-input"
                  onChange={handleCccdOcrUpload}
                />
              )}

              {/* Form fields */}
              <div className="form-grid">
                {cccdOcrActions
                  .filter((action) => !action.insertBeforeFieldId)
                  .map(renderOcrAction)}
                {service.fields.map((field) => (
                  <React.Fragment key={field.id}>
                    {renderOcrActionsBeforeField(field.id)}
                    <FormFieldInput
                      field={field}
                      value={getFieldValue(field.id)}
                      onChange={(val) => setFieldValue(field.id, val)}
                      isAutofilled={isAutofilled(field.id)}
                    />
                  </React.Fragment>
                ))}
              </div>

              <hr className="form-divider" />

              {/* Submit section */}
              <div>
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    marginBottom: 12,
                  }}
                >
                  <strong>Lưu ý:</strong> Vui lòng kiểm tra kỹ thông tin trước
                  khi nộp hồ sơ. Sau khi nộp, hệ thống sẽ gửi xác nhận qua số
                  điện thoại đã đăng ký.
                </p>

                <button
                  type="submit"
                  className="btn btn-submit"
                  id="submit-btn"
                  data-highlight-id="submit-btn"
                  data-highlight-label="Nút Nộp Hồ Sơ"
                  aria-label="Nộp hồ sơ"
                  disabled={formState.isSubmitting}
                >
                  {formState.isSubmitting ? "Đang nộp..." : "Nộp Hồ Sơ"}
                </button>

                {submitError && (
                  <div className="form-error-msg" role="alert" style={{ marginTop: 16 }}>
                    {submitError}
                  </div>
                )}

                {submittedId && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: "14px 18px",
                      background: "var(--accent-subtle)",
                      border: "1px solid var(--accent)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--accent)",
                      fontSize: "0.875rem",
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                    }}
                    role="alert"
                  >
                    <span style={{ fontSize: "1.25rem" }}>✅</span>
                    <span>
                      <strong>Nộp hồ sơ thành công!</strong> Chúng tôi sẽ xem
                      xét và phản hồi trong {service.processingTime}. Vui lòng
                      giữ điện thoại để nhận thông báo. Mã hồ sơ: {submittedId}.
                    </span>
                  </div>
                )}

                {ocrNotice && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: "14px 18px",
                      background: "var(--primary-subtle)",
                      border: "1px solid var(--primary)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--primary-dark)",
                      fontSize: "0.875rem",
                    }}
                    role="alert"
                  >
                    {ocrNotice}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="service-sidebar" aria-label="Thông tin dịch vụ">
          {/* Required docs */}
          <div className="sidebar-info-card">
            <div className="sidebar-info-card-header">
              {/* <div className="sidebar-info-card-title">
                📋 Giấy tờ cần chuẩn bị
              </div> */}
              <div className="sidebar-info-card-title">
                Giấy tờ cần chuẩn bị
              </div>
            </div>
            <div className="sidebar-info-card-body">
              <ul className="info-list">
                {service.requiredDocs.map((doc, i) => (
                  <li key={i} className="info-list-item">
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Steps */}
          <div className="sidebar-info-card">
            <div className="sidebar-info-card-header">
              {/* <div className="sidebar-info-card-title">
                🔄 Các bước thực hiện
              </div> */}
              <div className="sidebar-info-card-title">Các bước thực hiện</div>
            </div>
            <div className="sidebar-info-card-body">
              <ol className="steps-list">
                {service.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          </div>

          {/* Meta info */}
          <div className="sidebar-info-card">
            <div className="sidebar-info-card-header">
              {/* <div className="sidebar-info-card-title">
                ℹ️ Thông tin dịch vụ
              </div> */}
              <div className="sidebar-info-card-title">Thông tin dịch vụ</div>
            </div>
            <div className="sidebar-info-card-body">
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.8375rem",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    Thời gian xử lý
                  </span>
                  <strong style={{ color: "#C8441A" }}>
                    {service.processingTime}
                  </strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.8375rem",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>Lệ phí</span>
                  <strong style={{ color: "var(--accent)" }}>
                    {service.fee}
                  </strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.8375rem",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    Danh mục
                  </span>
                  <strong>{service.category}</strong>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ServicePageLayout;
