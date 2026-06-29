import React from "react";
import { Link } from "react-router-dom";
import type { PublicService, FormField } from "../../types";
import { useForm } from "../../contexts/FormContext";
import { quickValidate, validateForm } from "../../utils/validator";
import { ChevronRight, Home } from "lucide-react";
import { applicationService } from "../../api/applicationService";
import { ApiClientError } from "../../api/client";

// ============================================================
// Reusable form field renderer
// ============================================================
interface FieldProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  isAutofilled?: boolean;
}

export const FormFieldInput: React.FC<FieldProps> = ({
  field,
  value,
  onChange,
  isAutofilled,
}) => {
  const [error, setError] = React.useState("");
  const { formState } = useForm();
  const displayError = error || formState.errors[field.id] || "";

  const handleChange = (val: string) => {
    onChange(val);
    const err = quickValidate(field.id, val, field.label);
    setError(err || "");
  };

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
}

export const ServicePageLayout: React.FC<ServicePageProps> = ({
  service,
  categoryLabel,
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
        (error.details ?? []).forEach((detail) => {
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
    <div className="main-content animate-slide-up">
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

            {/* Form body */}
            <form className="form-body" onSubmit={handleSubmit} noValidate>
              {/* AI autofill hint */}
              <div
                style={{
                  background: "#FFF3EE",
                  border: "1px solid #C8441A",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 16px",
                  marginBottom: 24,
                  fontSize: "0.8375rem",
                  color: "#8B1A1A",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
                data-highlight-id="ai-hint"
              >
                <span style={{ display: 'flex', alignItems: 'center' }}><img src="/logo_Gov_Bridge.jpg" alt="AI" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', border: '1px solid #C8441A' }} /></span>
                <span>
                  <strong>Mẹo:</strong> Nhấn vào nút Trợ lý AI (góc phải) để tự
                  động điền form bằng <strong>giọng nói</strong> hoặc{" "}
                  <strong>ảnh CCCD</strong>!
                </span>
              </div>

              {/* Form fields */}
              <div className="form-grid">
                {service.fields.map((field) => (
                  <FormFieldInput
                    key={field.id}
                    field={field}
                    value={getFieldValue(field.id)}
                    onChange={(val) => setFieldValue(field.id, val)}
                    isAutofilled={isAutofilled(field.id)}
                  />
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

          {/* AI assistant prompt */}
          <div
            style={{
              background: "linear-gradient(135deg, #8B1A1A, #C8441A)",
              color: "white",
              borderRadius: "var(--radius-lg)",
              padding: "20px",
              textAlign: "center",
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><img src="/logo_Gov_Bridge.jpg" alt="AI" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.9)', padding: 2, background: 'white' }} /></div>
            <div
              style={{
                fontWeight: 700,
                marginBottom: 6,
                fontSize: "0.9375rem",
              }}
            >
              Cần hỗ trợ?
            </div>
            <p
              style={{
                fontSize: "0.8rem",
                opacity: 0.9,
                lineHeight: 1.5,
                marginBottom: 12,
              }}
            >
              Trợ lý AI sẵn sàng điền form tự động từ giọng nói hoặc ảnh CCCD
              của bạn!
            </p>
            <div
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 12px",
                fontSize: "0.8rem",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              👉 Nhấn nút <img src="/logo_Gov_Bridge.jpg" alt="AI" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle', margin: '0 4px', display: 'inline-block', border: '1px solid white' }} /> góc phải màn hình
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ServicePageLayout;
