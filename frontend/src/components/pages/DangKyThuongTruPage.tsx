import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Home, Send, Save, ArrowLeft, Upload, Camera } from 'lucide-react';
import { SERVICE_MAP } from '../../data/services';
import { useForm } from '../../contexts/FormContext';
import { FormFieldInput } from './ServicePageLayout';
import type { FormField } from '../../types';

// ============================================================
// Section definitions matching the original DVC form
// ============================================================
interface SectionDef {
  id: string;
  number: number;
  title: string;
  fieldIds: string[];
  customContent?: 'upload' | 'vneid';
}

const SECTIONS: SectionDef[] = [
  {
    id: 'co-quan',
    number: 1,
    title: 'Cơ quan thực hiện',
    fieldIds: ['tinhThanhCQ', 'xaPhuongCQ', 'coQuanDKCT', 'sdtCoQuan'],
  },
  {
    id: 'thu-tuc',
    number: 2,
    title: 'Thủ tục hành chính yêu cầu',
    fieldIds: ['thuTuc', 'loaiDKTT', 'truongHop'],
  },
  {
    id: 'nguoi-de-nghi',
    number: 3,
    title: 'Thông tin người đề nghị đăng ký thường trú',
    fieldIds: ['hoTen', 'ngaySinh', 'gioiTinh', 'danToc', 'tonGiao', 'cccd', 'sdt', 'email'],
  },
  {
    id: 'thong-tin-de-nghi',
    number: 4,
    title: 'Thông tin đề nghị',
    fieldIds: ['tinhThanhDN', 'xaPhuongDN', 'diaChiDN', 'noiDungDN'],
  },
  {
    id: 'ho-so-dinh-kem',
    number: 5,
    title: 'Trường hợp và hồ sơ đính kèm',
    fieldIds: [],
    customContent: 'upload',
  },
  {
    id: 'nhan-thong-bao',
    number: 6,
    title: 'Thông tin nhận thông báo tình trạng hồ sơ, kết quả giải quyết hồ sơ',
    fieldIds: ['hinhThucNhanTB', 'sdtNhanTB', 'emailNhanTB', 'hinhThucNhanKQ'],
  },
  {
    id: 'vneid',
    number: 7,
    title: 'Thông tin xác nhận tờ khai thông tin cư trú bản điện tử',
    fieldIds: [],
    customContent: 'vneid',
  },
];

// ============================================================
// Component
// ============================================================
const DangKyThuongTruPage: React.FC = () => {
  const service = SERVICE_MAP['ho-khau'];
  const { formState, setFieldValue } = useForm();
  const navigate = useNavigate();

  // Accordion state — first 4 sections open by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    SECTIONS.forEach((s) => {
      init[s.id] = s.number <= 4;
    });
    return init;
  });

  const [agreedLegal, setAgreedLegal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const [declareSelf, setDeclareSelf] = useState<'self' | 'proxy'>('proxy');

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getFieldValue = (fieldId: string) => formState.values[fieldId] || '';
  const isAutofilled = (fieldId: string) =>
    !!formState.touched[fieldId] && !!formState.values[fieldId];

  // Build a lookup from field id to FormField
  const fieldMap = new Map<string, FormField>();
  service.fields.forEach((f) => fieldMap.set(f.id, f));

  const handleSubmit = () => {
    if (!agreedLegal) {
      alert('Vui lòng xác nhận chịu trách nhiệm trước pháp luật về lời khai trên.');
      return;
    }
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  const handleSaveDraft = () => {
    setSavedDraft(true);
    setTimeout(() => setSavedDraft(false), 3000);
  };

  // Render fields for a section
  const renderFields = (fieldIds: string[], columnsClass = '') => {
    const fields = fieldIds.map((id) => fieldMap.get(id)).filter(Boolean) as FormField[];
    if (fields.length === 0) return null;

    return (
      <div className={`dktt-form-row ${columnsClass}`}>
        {fields.map((field) => (
          <FormFieldInput
            key={field.id}
            field={field}
            value={getFieldValue(field.id)}
            onChange={(val) => setFieldValue(field.id, val)}
            isAutofilled={isAutofilled(field.id)}
          />
        ))}
      </div>
    );
  };

  // Render custom upload section
  const renderUploadSection = () => (
    <div>
      <p className="dktt-note">
        Vui lòng chọn trường hợp và đính kèm các tập tin hình ảnh về các loại giấy tờ sau
        để giúp cơ quan chức năng xác minh và giải quyết hồ sơ của ông/bà
      </p>

      {/* CT01 Upload */}
      <div className="dktt-sub-title">Tờ khai thay đổi thông tin cư trú (CT01)</div>
      <div className="dktt-upload-area">
        <input type="file" accept="image/png, image/jpeg, application/pdf" multiple />
        <div className="dktt-upload-icon">
          <Upload size={32} strokeWidth={1.5} />
        </div>
        <div className="dktt-upload-text">
          <strong>Nhấn để chọn file</strong> hoặc kéo thả file vào đây
          <br />
          Hỗ trợ: JPG, PNG, PDF (tối đa 10MB)
        </div>
      </div>

      {/* Giấy tờ chứng minh chỗ ở */}
      <div className="dktt-sub-title" style={{ marginTop: 24 }}>
        Giấy tờ chứng minh chỗ ở hợp pháp
      </div>
      <div className="dktt-upload-area">
        <input type="file" accept="image/png, image/jpeg, application/pdf" multiple />
        <div className="dktt-upload-icon">
          <Upload size={32} strokeWidth={1.5} />
        </div>
        <div className="dktt-upload-text">
          <strong>Nhấn để chọn file</strong> hoặc kéo thả file vào đây
          <br />
          Sổ đỏ, hợp đồng mua bán, hợp đồng thuê nhà...
        </div>
      </div>

      {/* Văn bản đồng ý chủ hộ */}
      <div className="dktt-sub-title" style={{ marginTop: 24 }}>
        Văn bản đồng ý của chủ hộ / chủ sở hữu chỗ ở hợp pháp (nếu có)
      </div>
      <div className="dktt-upload-area">
        <input type="file" accept="image/png, image/jpeg, application/pdf" multiple />
        <div className="dktt-upload-icon">
          <Upload size={32} strokeWidth={1.5} />
        </div>
        <div className="dktt-upload-text">
          <strong>Nhấn để chọn file</strong> hoặc kéo thả file vào đây
          <br />
          Văn bản có chữ ký của chủ hộ đồng ý cho đăng ký thường trú
        </div>
      </div>
    </div>
  );

  // Render VNeID section
  const renderVNeIDSection = () => (
    <div>
      <div className="dktt-vneid-box">
        <em>
          Công dân kê khai các thông tin sau nếu cần lấy ý kiến đồng ý của chủ hộ;
          chủ sở hữu chỗ ở hợp pháp; cha, mẹ, người giám hộ qua ứng dụng định danh
          điện tử (VNeID) và không bắt buộc đính kèm Tờ khai thay đổi thông tin cư trú
          (CT01, CT02) có chữ ký của người đã xin ý kiến xác nhận qua VNeID.
        </em>
      </div>

      <div className="dktt-form-row cols-2">
        <div className="form-group">
          <label className="form-label">Trạng thái xác nhận</label>
          <input
            className="form-input"
            type="text"
            value="Chưa gửi"
            disabled
            style={{ background: 'var(--gray-50)' }}
          />
        </div>
      </div>

      <div className="dktt-sub-title">Người kê khai là:</div>
      <div className="dktt-form-row cols-3">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8375rem', cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
          Chủ hộ
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8375rem', cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
          Chủ sở hữu chỗ ở hợp pháp
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8375rem', cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
          Cha/Mẹ/Người giám hộ
        </label>
      </div>

      <div className="dktt-sub-title" style={{ marginTop: 20 }}>Danh sách người cần xin ý kiến:</div>
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.8375rem',
        background: 'var(--gray-50)',
      }}>
        Chưa có dữ liệu. Vui lòng thêm thông tin người cần xin ý kiến.
      </div>

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <em style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          *Vui lòng kiểm tra tính chính xác của tài khoản định danh điện tử đã cung cấp
        </em>
        <br />
        <button
          className="btn"
          style={{
            marginTop: 8,
            padding: '10px 20px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '0.8375rem',
            cursor: 'pointer',
          }}
        >
          Kiểm tra tài khoản VNeID
        </button>
      </div>
    </div>
  );

  // Render section body content
  const renderSectionContent = (section: SectionDef) => {
    // Section 3: Thông tin người đề nghị — has special radio + photo
    if (section.id === 'nguoi-de-nghi') {
      return (
        <div>
          {/* Radio: declare self or proxy */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12,
              cursor: 'pointer', fontSize: '0.8375rem', lineHeight: 1.5,
            }}>
              <input
                type="radio"
                name="declareSelf"
                checked={declareSelf === 'self'}
                onChange={() => setDeclareSelf('self')}
                style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--primary)' }}
              />
              <span>
                Người khai thông tin là người đăng ký thường trú
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.775rem' }}>
                  (tự động điền các thông tin của chủ tài khoản được lấy từ dữ liệu dân cư)
                </span>
              </span>
            </label>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              cursor: 'pointer', fontSize: '0.8375rem', lineHeight: 1.5,
            }}>
              <input
                type="radio"
                name="declareSelf"
                checked={declareSelf === 'proxy'}
                onChange={() => setDeclareSelf('proxy')}
                style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--primary)' }}
              />
              <span>
                Khai hộ
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.775rem' }}>
                  (yêu cầu khai đúng các trường thông tin có trong cơ sở dữ liệu quốc gia về dân cư của người được khai hộ)
                </span>
              </span>
            </label>
          </div>

          {/* Row: name, birthdate, gender + photo */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 0', minWidth: 300 }}>
              {renderFields(['hoTen', 'ngaySinh', 'gioiTinh'], 'cols-3')}
              {renderFields(['danToc', 'tonGiao'], 'cols-2')}
              {renderFields(['cccd', 'sdt', 'email'], 'cols-3')}
            </div>
            {/* Photo upload */}
            <div style={{ flexShrink: 0 }}>
              <div className="dktt-photo-box">
                <input type="file" accept="image/png, image/jpeg" />
                <Camera size={24} style={{ opacity: 0.4, marginBottom: 4 }} />
                <span>Ảnh 4x6</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Section with custom content
    if (section.customContent === 'upload') return renderUploadSection();
    if (section.customContent === 'vneid') return renderVNeIDSection();

    // Default: render fields
    const colClass = section.fieldIds.length <= 2 ? 'cols-2' :
                     section.fieldIds.length === 3 ? 'cols-3' : '';
    return renderFields(section.fieldIds, colClass);
  };

  return (
    <div className="main-content animate-slide-up">
      {/* Breadcrumb */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">
          <Home size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          Trang Chủ
        </Link>
        <ChevronRight size={13} className="breadcrumb-sep" />
        <span>Cư trú</span>
        <ChevronRight size={13} className="breadcrumb-sep" />
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          Đăng ký thường trú
        </span>
      </nav>

      <div className="service-page">
        {/* Main Form */}
        <div>
          {/* Page Header */}
          <div className="dktt-page-header" data-highlight-id="form-section">
            <h1>ĐĂNG KÝ THƯỜNG TRÚ</h1>
            <p>Cổng Dịch vụ Công — Bộ Công An</p>
          </div>

          {/* AI hint */}
          <div
            style={{
              background: '#FFF3EE',
              border: '1px solid #C8441A',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: 20,
              fontSize: '0.8375rem',
              color: '#8B1A1A',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
            data-highlight-id="ai-hint"
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <img src="/logo_Gov_Bridge.jpg" alt="AI" style={{
                width: 24, height: 24, borderRadius: '50%', objectFit: 'cover',
                border: '1px solid #C8441A',
              }} />
            </span>
            <span>
              <strong>Mẹo:</strong> Nhấn vào nút Trợ lý AI (góc phải) để tự động điền
              form bằng <strong>giọng nói</strong> hoặc <strong>ảnh CCCD</strong>!
            </span>
          </div>

          {/* Required fields note */}
          <div className="dktt-required-note">
            <strong>Ghi chú:</strong> Các thông tin có dấu{' '}
            <span className="red">(*)</span> là thông tin bắt buộc phải nhập
          </div>

          {/* Accordion Sections */}
          {SECTIONS.map((section) => (
            <div
              key={section.id}
              className={`dktt-section${openSections[section.id] ? ' open' : ''}`}
              id={`section-${section.id}`}
            >
              <div
                className="dktt-section-header"
                onClick={() => toggleSection(section.id)}
                role="button"
                tabIndex={0}
                aria-expanded={openSections[section.id]}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSection(section.id);
                  }
                }}
              >
                <div className="dktt-section-header-left">
                  <span className="dktt-section-number">{section.number}</span>
                  <h3 className="dktt-section-title">{section.title}</h3>
                </div>
                <ChevronDown size={20} className="dktt-section-chevron" />
              </div>
              <div className="dktt-section-body">
                {renderSectionContent(section)}
              </div>
            </div>
          ))}

          {/* Legal checkbox */}
          <label className="dktt-legal-check">
            <input
              type="checkbox"
              checked={agreedLegal}
              onChange={(e) => setAgreedLegal(e.target.checked)}
            />
            <span>
              Tôi xin chịu trách nhiệm trước pháp luật về lời khai trên
            </span>
          </label>

          {/* Action buttons */}
          <div className="dktt-actions">
            <button
              className="btn btn-outline"
              onClick={() => navigate('/')}
            >
              <ArrowLeft size={16} />
              Quay lại
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleSaveDraft}
            >
              <Save size={16} />
              Lưu nháp
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              id="submit-btn"
              data-highlight-id="submit-btn"
              data-highlight-label="Nút Nộp Hồ Sơ"
            >
              <Send size={16} />
              Nộp hồ sơ
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="service-sidebar" aria-label="Thông tin dịch vụ">
          {/* Required docs */}
          <div className="sidebar-info-card">
            <div className="sidebar-info-card-header">
              <div className="sidebar-info-card-title">
                Giấy tờ cần chuẩn bị
              </div>
            </div>
            <div className="sidebar-info-card-body">
              <ul className="info-list">
                {service.requiredDocs.map((doc, i) => (
                  <li key={i} className="info-list-item">{doc}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Steps */}
          <div className="sidebar-info-card">
            <div className="sidebar-info-card-header">
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
              <div className="sidebar-info-card-title">Thông tin dịch vụ</div>
            </div>
            <div className="sidebar-info-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8375rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Thời gian xử lý</span>
                  <strong style={{ color: '#C8441A' }}>{service.processingTime}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8375rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Lệ phí</span>
                  <strong style={{ color: 'var(--accent)' }}>{service.fee}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8375rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Danh mục</span>
                  <strong>{service.category}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* AI assistant prompt */}
          <div style={{
            background: 'linear-gradient(135deg, #8B1A1A, #C8441A)',
            color: 'white',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <img src="/logo_Gov_Bridge.jpg" alt="AI" style={{
                width: 44, height: 44, borderRadius: '50%', objectFit: 'cover',
                border: '2px solid rgba(255,255,255,0.9)', padding: 2, background: 'white',
              }} />
            </div>
            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: '0.9375rem' }}>
              Cần hỗ trợ?
            </div>
            <p style={{ fontSize: '0.8rem', opacity: 0.9, lineHeight: 1.5, marginBottom: 12 }}>
              Trợ lý AI sẵn sàng điền form tự động từ giọng nói hoặc ảnh CCCD của bạn!
            </p>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              fontSize: '0.8rem',
              border: '1px solid rgba(255,255,255,0.25)',
            }}>
              👉 Nhấn nút <img src="/logo_Gov_Bridge.jpg" alt="AI" style={{
                width: 16, height: 16, borderRadius: '50%', objectFit: 'cover',
                verticalAlign: 'middle', margin: '0 4px', display: 'inline-block',
                border: '1px solid white',
              }} /> góc phải màn hình
            </div>
          </div>
        </aside>
      </div>

      {/* Success toasts */}
      {submitted && (
        <div className="dktt-toast" role="alert">
          ✅ Nộp hồ sơ thành công! Chúng tôi sẽ xem xét và phản hồi trong {service.processingTime}.
        </div>
      )}
      {savedDraft && (
        <div className="dktt-toast" style={{ background: 'var(--primary)' }} role="alert">
          💾 Đã lưu nháp hồ sơ thành công!
        </div>
      )}
    </div>
  );
};

export default DangKyThuongTruPage;
