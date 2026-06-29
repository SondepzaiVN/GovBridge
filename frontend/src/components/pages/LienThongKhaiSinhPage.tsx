import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, FileText, Home, Search, UploadCloud } from 'lucide-react';
import { applicationService } from '../../api/applicationService';
import { ApiClientError } from '../../api/client';
import { useForm } from '../../contexts/FormContext';

type FieldType = 'text' | 'date' | 'select' | 'textarea' | 'radio';

interface LinkedField {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  value?: string;
  options?: string[];
  wide?: boolean;
  dotted?: boolean;
}

interface LinkedSection {
  title: string;
  note?: string;
  sameArea?: boolean;
  fields?: LinkedField[];
  uploads?: Array<{ title: string; desc: string }>;
  review?: boolean;
}

interface LinkedStep {
  title: string;
  shortTitle: string;
  sections: LinkedSection[];
}

const resultMethods = [
  'Dịch vụ bưu chính công ích',
  'Tại nơi nhận kết quả khai sinh (UBND)',
  'Tại cơ quan BHXH cấp thẻ BHYT',
  'Chỉ nhận bản điện tử',
];

const steps: LinkedStep[] = [
  {
    title: 'Lựa chọn cơ quan thực hiện',
    shortTitle: 'Lựa chọn cơ quan thực hiện',
    sections: [
      {
        title: 'Cơ quan thực hiện đăng ký khai sinh',
        fields: [
          { id: 'ltks_loaiKhaiSinh', label: 'Loại khai sinh', type: 'select', required: true, wide: true, options: ['Khai sinh trong nước', 'Khai sinh có yếu tố nước ngoài'] },
          { id: 'ltks_tinhKhaiSinh', label: 'Tỉnh/Thành phố', type: 'select', required: true, options: ['Thành phố Hà Nội', 'Thành phố Hồ Chí Minh', 'Thành phố Đà Nẵng'] },
          { id: 'ltks_phuongKhaiSinh', label: 'Phường/Xã', type: 'select', required: true, options: ['Phường Cửa Nam', 'Phường Hàng Bạc', 'Phường Bến Nghé'] },
          { id: 'ltks_coQuanDangKyKhaiSinh', label: 'Cơ quan thực hiện', type: 'text', required: true, wide: true, dotted: true },
          { id: 'ltks_truongHopKhaiSinh', label: 'Trường hợp khai sinh', type: 'select', required: true, wide: true, options: ['Trẻ em sinh tại cơ sở y tế', 'Trẻ em sinh ngoài cơ sở y tế'] },
        ],
      },
      {
        title: 'Cơ quan thực hiện đăng ký thường trú',
        sameArea: true,
        fields: [
          { id: 'ltks_tinhThuongTru', label: 'Tỉnh/Thành phố', type: 'select', required: true, options: ['Thành phố Hà Nội', 'Thành phố Hồ Chí Minh', 'Thành phố Đà Nẵng'] },
          { id: 'ltks_phuongThuongTru', label: 'Phường/Xã', type: 'select', required: true, options: ['Phường Cửa Nam', 'Phường Hàng Bạc', 'Phường Bến Nghé'] },
          { id: 'ltks_coQuanDangKyThuongTru', label: 'Cơ quan thực hiện', type: 'text', required: true, wide: true, dotted: true },
          { id: 'ltks_truongHopDangKyThuongTru', label: 'Trường hợp ĐKTT', type: 'select', required: true, wide: true, options: ['Đăng ký thường trú cho trẻ dưới 6 tuổi', 'Đăng ký thường trú theo cha hoặc mẹ'] },
        ],
      },
      {
        title: 'Cơ quan thực hiện cấp thẻ BHYT',
        fields: [
          { id: 'ltks_coQuanCapBhyt', label: 'Cơ quan thực hiện', type: 'text', required: true, wide: true, dotted: true },
        ],
      },
    ],
  },
  {
    title: 'Thông tin kê khai',
    shortTitle: 'Kê khai',
    sections: [
      {
        title: 'Thông tin người yêu cầu',
        fields: [
          { id: 'ltks_hoTenNguoiYeuCau', label: 'Họ, chữ đệm, tên người yêu cầu', type: 'text', required: true, placeholder: 'Nguyễn Văn An' },
          { id: 'ltks_soDinhDanhNguoiYeuCau', label: 'Số định danh', type: 'text', required: true, placeholder: '001200000000' },
          { id: 'ltks_ngaySinhNguoiYeuCau', label: 'Ngày sinh người yêu cầu', type: 'date', required: true },
          { id: 'ltks_gioiTinhNguoiYeuCau', label: 'Giới tính', type: 'select', required: true, options: ['Nam', 'Nữ'] },
          { id: 'ltks_quanHeVoiTre', label: 'Quan hệ với người được khai sinh', type: 'select', required: true, options: ['Cha', 'Mẹ', 'Người giám hộ'] },
          { id: 'ltks_sdtNguoiYeuCau', label: 'Số điện thoại', type: 'text', placeholder: '09xxxxxxxx' },
          { id: 'ltks_noiCuTruNguoiYeuCau', label: 'Nơi cư trú', type: 'textarea', required: true, wide: true, placeholder: 'Số nhà, đường/phố, phường/xã, tỉnh/thành phố' },
        ],
      },
      {
        title: 'Thông tin người được khai sinh',
        note: 'Ghi đầy đủ và chính xác họ, chữ đệm, tên của người được khai sinh theo giấy tờ tùy thân nếu có.',
        fields: [
          { id: 'ltks_hoTre', label: 'Họ người được khai sinh', type: 'text', required: true },
          { id: 'ltks_chuDemTre', label: 'Chữ đệm người được khai sinh', type: 'text' },
          { id: 'ltks_tenTre', label: 'Tên người được khai sinh', type: 'text', required: true },
          { id: 'ltks_ngaySinhTre', label: 'Ngày tháng năm sinh', type: 'date', required: true },
          { id: 'ltks_gioiTinhTre', label: 'Giới tính', type: 'select', required: true, options: ['Nam', 'Nữ'] },
          { id: 'ltks_quocTichTre', label: 'Quốc tịch', type: 'select', required: true, options: ['Việt Nam'] },
          { id: 'ltks_danTocTre', label: 'Dân tộc', type: 'select', required: true, options: ['Kinh', 'Tày', 'Thái', 'Mường', 'Khác'] },
          { id: 'ltks_noiSinhTre', label: 'Nơi sinh', type: 'textarea', required: true, wide: true, placeholder: 'Tên bệnh viện/cơ sở y tế hoặc địa chỉ chi tiết nơi sinh' },
        ],
      },
    ],
  },
  {
    title: 'Xem lại các tờ khai chi tiết',
    shortTitle: 'Xem lại các tờ khai chi tiết',
    sections: [
      {
        title: 'Thông tin người mẹ đẻ/nhờ mang thai hộ',
        fields: [
          { id: 'ltks_hoMe', label: 'Họ mẹ', type: 'text', required: true },
          { id: 'ltks_chuDemMe', label: 'Chữ đệm mẹ', type: 'text' },
          { id: 'ltks_tenMe', label: 'Tên mẹ', type: 'text', required: true },
          { id: 'ltks_cccdMe', label: 'CCCD/CMND mẹ', type: 'text', required: true },
          { id: 'ltks_danTocMe', label: 'Dân tộc', type: 'select', required: true, options: ['Kinh', 'Tày', 'Thái', 'Mường', 'Khác'] },
          { id: 'ltks_noiCuTruMe', label: 'Nơi cư trú', type: 'textarea', wide: true, placeholder: 'Cùng nơi cư trú với mẹ' },
        ],
      },
      {
        title: 'Thông tin người cha đẻ/nhờ mang thai hộ',
        fields: [
          { id: 'ltks_hoCha', label: 'Họ cha', type: 'text', required: true },
          { id: 'ltks_chuDemCha', label: 'Chữ đệm cha', type: 'text' },
          { id: 'ltks_tenCha', label: 'Tên cha', type: 'text', required: true },
          { id: 'ltks_cccdCha', label: 'Số định danh cá nhân', type: 'text', required: true },
          { id: 'ltks_quocTichCha', label: 'Quốc tịch', type: 'select', required: true, options: ['Việt Nam'] },
          { id: 'ltks_noiCuTruCha', label: 'Nơi cư trú', type: 'textarea', wide: true, placeholder: 'Theo thông tin người yêu cầu' },
        ],
      },
      {
        title: 'Thông tin đăng ký thường trú',
        note: 'Chọn hình thức xác nhận của Chủ hộ, Chủ sở hữu chỗ ở hợp pháp, Cha/mẹ/người giám hộ về việc đăng ký thường trú cho trẻ.',
        fields: [
          { id: 'ltks_hoTenChuHo', label: 'Họ, chữ đệm, tên chủ hộ', type: 'text', required: true },
          { id: 'ltks_quanHeVoiChuHo', label: 'Mối quan hệ của người được khai sinh với chủ hộ', type: 'select', required: true, options: ['Con', 'Cháu', 'Người được giám hộ'] },
          { id: 'ltks_noiDangKyThuongTru', label: 'Nơi đề nghị đăng ký thường trú', type: 'textarea', required: true, wide: true },
        ],
      },
    ],
  },
  {
    title: 'Đính kèm thành phần hồ sơ',
    shortTitle: 'Đính kèm thành phần hồ sơ',
    sections: [
      {
        title: 'Đính kèm thành phần hồ sơ',
        uploads: [
          { title: 'Tờ khai đăng ký khai sinh', desc: 'PDF, PNG, JPG tối đa 5MB' },
          { title: 'Tờ khai thay đổi thông tin cư trú (CT01)', desc: 'Bản ký số hoặc bản scan' },
          { title: 'Tờ khai tham gia, điều chỉnh thông tin BHXH, BHYT (TK1-TS)', desc: 'Mẫu TK1-TS' },
          { title: 'Giấy chứng sinh', desc: 'Mã giấy chứng sinh hoặc file đính kèm' },
        ],
      },
    ],
  },
  {
    title: 'Lựa chọn hình thức nhận kết quả',
    shortTitle: 'Lựa chọn hình thức nhận kết quả',
    sections: [
      {
        title: 'Hình thức nhận kết quả',
        fields: [
          { id: 'ltks_noiKhamChuaBenh', label: 'Nơi khám chữa bệnh ban đầu', type: 'select', required: true, options: ['Trạm y tế phường/xã', 'Bệnh viện đa khoa khu vực', 'Bệnh viện tuyến huyện'] },
          { id: 'ltks_hinhThucNhanBhyt', label: 'Hình thức nhận thẻ BHYT', type: 'select', required: true, options: resultMethods },
          { id: 'ltks_nhanKhaiSinh', label: 'Hình thức nhận kết quả khai sinh', type: 'select', required: true, options: resultMethods },
          { id: 'ltks_nhanThuongTru', label: 'Hình thức nhận kết quả đăng ký thường trú', type: 'select', required: true, options: resultMethods },
          { id: 'ltks_nhanTheBhyt', label: 'Hình thức nhận thẻ BHYT', type: 'select', required: true, options: resultMethods },
          { id: 'ltks_noiNhanKetQua', label: 'Nơi nhận kết quả', type: 'textarea', required: true, wide: true, placeholder: 'Bộ phận một cửa/địa chỉ nhận qua bưu chính' },
        ],
      },
    ],
  },
  {
    title: 'Hoàn thành',
    shortTitle: 'Hoàn thành',
    sections: [
      { title: 'Xác nhận thông tin hồ sơ', review: true },
    ],
  },
];

const allFields = steps.flatMap((step) => step.sections.flatMap((section) => section.fields ?? []));

const portalActions = [
  {
    title: 'Liên thông thủ tục hành chính về đăng ký khai sinh, đăng ký thường trú, cấp thẻ bảo hiểm y tế cho trẻ em dưới 6 tuổi',
    icon: FileText,
    to: '/lien-thong-khai-sinh/buoc-1',
  },
  {
    title: 'Thủ tục liên thông về đăng ký khai tử, xóa đăng ký thường trú, hưởng chế độ tử tuất (trợ cấp tuất và trợ cấp mai táng)/hỗ trợ chi phí mai táng/hưởng mai táng phí',
    icon: FileText,
  },
  {
    title: 'Hồ sơ của tôi',
    icon: FileText,
  },
  {
    title: 'TRA CỨU HỒ SƠ',
    icon: Search,
    featured: true,
  },
];

const parseStep = (stepSlug?: string) => {
  const match = stepSlug?.match(/^buoc-(\d+)$/);
  const step = match ? Number(match[1]) : 1;
  return Math.min(Math.max(step, 1), steps.length);
};

const LienThongKhaiSinhPage: React.FC = () => {
  const navigate = useNavigate();
  const { stepSlug } = useParams();
  const { formState, setFieldValue, setFieldError, touchField, setIsSubmitting, resetForm } = useForm();
  const [submitError, setSubmitError] = React.useState('');
  const [submittedId, setSubmittedId] = React.useState('');
  const [draftSaved, setDraftSaved] = React.useState(false);

  const isPortalHome = !stepSlug;
  const currentStep = isPortalHome ? 1 : parseStep(stepSlug);
  const current = steps[currentStep - 1];

  const goToStep = (step: number) => {
    navigate(`/lien-thong-khai-sinh/buoc-${step}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateStep = () => {
    const fields = current.sections.flatMap((section) => section.fields ?? []);
    let isValid = true;

    fields.forEach((field) => {
      touchField(field.id);
      const value = formState.values[field.id] ?? field.value ?? '';
      const error = field.required && !String(value).trim() ? 'Vui lòng nhập thông tin bắt buộc.' : '';
      setFieldError(field.id, error);
      if (error) isValid = false;
    });

    return isValid;
  };

  const handleNext = () => {
    setSubmitError('');
    if (!validateStep()) return;
    if (currentStep < steps.length) {
      goToStep(currentStep + 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmittedId('');
    if (!validateStep()) return;

    const missing = allFields.filter((field) => {
      const value = formState.values[field.id] ?? field.value ?? '';
      return field.required && !String(value).trim();
    });

    if (missing.length) {
      missing.forEach((field) => {
        touchField(field.id);
        setFieldError(field.id, 'Vui lòng nhập thông tin bắt buộc.');
      });
      setSubmitError('Vui lòng hoàn thiện các bước trước khi gửi hồ sơ.');
      return;
    }

    try {
      setIsSubmitting(true);
      const application = await applicationService.submit({
        serviceId: 'lien-thong-khai-sinh',
        submittedAt: new Date().toISOString(),
        data: Object.fromEntries(allFields.map((field) => [field.id, formState.values[field.id] ?? field.value ?? ''])),
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
      setSubmitError(error instanceof Error ? error.message : 'Không thể nộp hồ sơ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveDraft = () => {
    setDraftSaved(true);
    window.setTimeout(() => setDraftSaved(false), 1800);
  };

  if (isPortalHome) {
    return (
      <LienThongShell>
        <main className="ltks-main ltks-landing" data-highlight-id="ltks-portal-home">
          <nav className="ltks-breadcrumb ltks-landing-title" aria-label="Dịch vụ trực tuyến liên thông">
            <ChevronRight size={20} />
            <strong>DỊCH VỤ TRỰC TUYẾN LIÊN THÔNG</strong>
          </nav>

          <div className="ltks-service-grid">
            {portalActions.map((action) => {
              const Icon = action.icon;
              const className = `ltks-service-card ${action.featured ? 'featured' : ''}`;
              const content = (
                <>
                  <span className="ltks-service-icon" aria-hidden="true">
                    <Icon size={42} strokeWidth={1.9} />
                  </span>
                  <span className="ltks-service-text">{action.title}</span>
                </>
              );

              return action.to ? (
                <Link className={className} to={action.to} key={action.title}>
                  {content}
                </Link>
              ) : (
                <button className={className} type="button" key={action.title}>
                  {content}
                </button>
              );
            })}
          </div>
        </main>
      </LienThongShell>
    );
  }

  return (
    <LienThongShell>
      <main className="ltks-main">
        <nav className="ltks-breadcrumb" aria-label="Breadcrumb">
          <ChevronRight size={20} />
          <Link to="/lien-thong-khai-sinh">Trang chủ DVCLT</Link>
          <span>/ THÊM MỚI HỒ SƠ DỊCH VỤ CÔNG LIÊN THÔNG ĐĂNG KÝ KHAI SINH, ĐĂNG KÝ THƯỜNG TRÚ, CẤP THẺ BHYT CHO TRẺ DƯỚI 6 TUỔI</span>
        </nav>

        <div className="ltks-stepper" role="tablist" aria-label="Các bước kê khai">
          {steps.map((step, index) => {
            const stepNo = index + 1;
            const state = stepNo === currentStep ? 'active' : stepNo < currentStep ? 'done' : '';
            return (
              <button
                type="button"
                className={`ltks-step ${state}`}
                key={step.title}
                onClick={() => goToStep(stepNo)}
                role="tab"
                aria-selected={stepNo === currentStep}
              >
                <span>{String(stepNo).padStart(2, '0').replace('0', '0 ')}</span>
                <strong>{step.shortTitle}</strong>
              </button>
            );
          })}
        </div>

        <form className={`ltks-form ltks-form-step-${currentStep}`} onSubmit={(event) => event.preventDefault()} noValidate>
          <div className="ltks-form-body">
            {current.sections.map((section) => (
              <section className="ltks-section" key={section.title}>
                <div className="ltks-section-title">
                  <h3>{section.title}</h3>
                  {section.sameArea && (
                    <label className="ltks-inline-check">
                      <input type="checkbox" aria-label="Cùng địa bàn thực hiện đăng ký khai sinh" />
                      Cùng địa bàn thực hiện đăng ký khai sinh
                    </label>
                  )}
                </div>
                {section.note && <p className="ltks-note">{section.note}</p>}
                {section.fields && (
                  <div className="ltks-grid">
                    {section.fields.map((field) => (
                      <FieldControl
                        key={field.id}
                        field={field}
                        value={formState.values[field.id] ?? field.value ?? ''}
                        error={formState.errors[field.id]}
                        onChange={(value) => setFieldValue(field.id, value)}
                      />
                    ))}
                  </div>
                )}
                {section.uploads && (
                  <div className="ltks-upload-list">
                    {section.uploads.map((upload) => (
                      <button type="button" className="ltks-upload-item" key={upload.title}>
                        <span>
                          <strong>{upload.title}</strong>
                          <small>{upload.desc}</small>
                        </span>
                        <UploadCloud size={20} />
                      </button>
                    ))}
                  </div>
                )}
                {section.review && <ReviewPanel values={formState.values} />}
              </section>
            ))}
          </div>

          {submitError && <div className="ltks-alert error">{submitError}</div>}
          {submittedId && <div className="ltks-alert success">Đã nộp hồ sơ thành công. Mã hồ sơ: {submittedId}</div>}

          <div className="ltks-actions">
            <button type="button" className="ltks-btn ghost" onClick={() => { resetForm(); navigate('/lien-thong-khai-sinh'); }}>
              Hủy
            </button>
            {currentStep > 1 && (
              <button type="button" className="ltks-btn secondary" onClick={() => goToStep(currentStep - 1)}>
                Quay lại bước trước
              </button>
            )}
            {currentStep > 1 && (
              <button type="button" className="ltks-btn secondary" onClick={saveDraft}>
                {draftSaved ? 'Đã lưu nháp' : 'Lưu nháp'}
              </button>
            )}
            {currentStep < steps.length ? (
              <button type="button" className="ltks-btn primary" onClick={handleNext}>
                Chuyển bước tiếp theo
              </button>
            ) : (
              <button type="button" className="ltks-btn primary" disabled={formState.isSubmitting} onClick={handleSubmit}>
                {formState.isSubmitting ? 'Đang nộp...' : 'Gửi hồ sơ'}
              </button>
            )}
          </div>
        </form>
      </main>
    </LienThongShell>
  );
};

const LienThongShell: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="ltks-page animate-slide-up">
    <section className="ltks-portal">
      <div className="ltks-hero-mark" aria-hidden="true" />
      <h1>DỊCH VỤ CÔNG LIÊN THÔNG</h1>
      <div className="ltks-user">
        <span aria-hidden="true">●</span>
        Trần Minh Hùng
      </div>
    </section>

    <div className="ltks-topbar">
      <Link to="/lien-thong-khai-sinh" className="ltks-home" aria-label="Trang chủ">
        <Home size={18} />
      </Link>
      <div className="ltks-top-actions">
        <select aria-label="Hướng dẫn sử dụng" defaultValue="guide">
          <option value="guide">Hướng dẫn sử dụng</option>
          <option value="docs">Tài liệu HDSD</option>
          <option value="video">Video HDSD</option>
        </select>
        <select aria-label="Ngôn ngữ" defaultValue="vi">
          <option value="vi">(VIE)Tiếng việt</option>
          <option value="en">(ENG)English</option>
        </select>
      </div>
    </div>

    {children}

    <footer className="ltks-footer">
      <p>Số điện thoại đường dây nóng: <strong>1900.0368</strong> hoặc <strong>1900.0134</strong></p>
      <p>Bản quyền thuộc về BỘ CÔNG AN</p>
    </footer>
  </div>
);

interface FieldControlProps {
  field: LinkedField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

const FieldControl: React.FC<FieldControlProps> = ({ field, value, error, onChange }) => {
  const commonProps = {
    id: field.id,
    value,
    'aria-label': field.label,
    'aria-required': field.required,
    'aria-invalid': !!error,
    'data-highlight-id': field.id,
  };

  return (
    <div className={`ltks-field ${field.wide || field.type === 'textarea' ? 'wide' : ''} ${field.dotted ? 'dotted' : ''}`}>
      <label htmlFor={field.id} className={field.required ? 'required' : ''}>{field.label}</label>
      {field.type === 'textarea' ? (
        <textarea {...commonProps} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : field.type === 'select' ? (
        <select {...commonProps} onChange={(event) => onChange(event.target.value)}>
          <option value="">{field.placeholder ?? ''}</option>
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : field.type === 'radio' ? (
        <div className="ltks-radio-group">
          {field.options?.map((option) => (
            <label key={option}>
              <input type="radio" name={field.id} checked={value === option} onChange={() => onChange(option)} />
              {option}
            </label>
          ))}
        </div>
      ) : (
        <input {...commonProps} type={field.type} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
      {error && <span className="ltks-error">{error}</span>}
    </div>
  );
};

const ReviewPanel: React.FC<{ values: Record<string, string> }> = ({ values }) => {
  const babyName = [values.ltks_hoTre, values.ltks_chuDemTre, values.ltks_tenTre].filter(Boolean).join(' ') || 'Chưa nhập';
  const requester = values.ltks_hoTenNguoiYeuCau || 'Chưa nhập';

  return (
    <div className="ltks-review">
      <div><strong>Tên thủ tục</strong><span>Liên thông đăng ký khai sinh, đăng ký thường trú, cấp thẻ BHYT cho trẻ dưới 6 tuổi</span></div>
      <div><strong>Người yêu cầu</strong><span>{requester}</span></div>
      <div><strong>Người được khai sinh</strong><span>{babyName}</span></div>
      <div><strong>Ngày nộp hồ sơ</strong><span>--/--/----</span></div>
      <div><strong>Mã hồ sơ</strong><span>Hồ sơ sẽ được sinh sau khi gửi</span></div>
      <p>Vui lòng ghi nhớ các thông tin bên dưới để theo dõi tình hình xử lý hoặc cập nhật thông tin hồ sơ của bạn.</p>
    </div>
  );
};

export default LienThongKhaiSinhPage;
