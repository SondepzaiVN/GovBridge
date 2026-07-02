import React, { useState } from "react";
import StepHeader from "./StepHeader";
import PublicServiceForm from "./PublicServiceForm";
import PublicServiceDeclaration from "./PublicServiceDeclaration";
import PublicServiceReview from "./PublicServiceReview";
import PublicServiceAttachments from "./PublicServiceAttachments";
import PublicServiceResultOptions from "./PublicServiceResultOptions";
import PublicServiceComplete from "./PublicServiceComplete";
import ProcedureAiSupportCard from "../ProcedureAiSupportCard";
import { ROUTE_TO_SERVICE_MAP } from "../../../data/services";

const MainStepper: React.FC = () => {
  const service = ROUTE_TO_SERVICE_MAP['/lien-thong-khai-tu'] || { requiredDocs: [], steps: [], processingTime: '', fee: '', category: '' };
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Hàm chuyển bước (Bạn có thể truyền hàm này vào PublicServiceForm dưới dạng props)
  const nextStep = () => setCurrentStep((prev) => (prev < 6 ? prev + 1 : prev));
  const prevStep = () => setCurrentStep((prev) => (prev > 1 ? prev - 1 : prev));

  // Hàm render nội dung tương ứng với từng bước
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        // Bước 1: Gọi Form lựa chọn cơ quan mà chúng ta đã viết
        return <PublicServiceForm onNext={nextStep} />;
      case 2:
        return <PublicServiceDeclaration onNext={nextStep} onBack={prevStep} />;
      case 3:
        return <PublicServiceReview onNext={nextStep} onBack={prevStep} />;
      case 4:
        return <PublicServiceAttachments onNext={nextStep} onBack={prevStep} />;
      case 5:
        return (
          <PublicServiceResultOptions onNext={nextStep} onBack={prevStep} />
        );
      case 6:
        return <PublicServiceComplete onReset={() => setCurrentStep(1)} />;
      default:
        return null;
    }
  };

  return (
    <div className="ltks-page ltks-app-page ltkt-page-shell animate-slide-up">
      <main className="ltks-main">
        <StepHeader currentStep={currentStep} />

        <div className="ltkt-standard-notices">
          <div className="dktt-ai-hint" data-highlight-id="ai-hint">
            <span className="dktt-ai-hint-icon">
              <img src="/logo_Gov_Bridge.jpg" alt="AI" />
            </span>
            <span>
              <strong>Mẹo:</strong> Nhấn vào nút Trợ lý AI (góc phải) để tự động điền
              form bằng <strong>giọng nói</strong> hoặc <strong>ảnh CCCD</strong>.
            </span>
          </div>

          <div className="dktt-required-note">
            <strong>Ghi chú:</strong> Các thông tin có dấu <span className="red">(*)</span> là thông tin bắt buộc phải nhập
          </div>
        </div>

        <form className={`ltks-form ltks-form-step-${currentStep} ltkt-form-frame`} onSubmit={(event) => event.preventDefault()} noValidate>
          <div className="ltks-form-body">
            {renderStepContent()}
          </div>
        </form>
        <aside className="service-sidebar dktt-service-sidebar" aria-label="Thông tin dịch vụ">
          <div className="sidebar-info-card">
            <div className="sidebar-info-card-header">
              <div className="sidebar-info-card-title">Giấy tờ cần chuẩn bị</div>
            </div>
            <div className="sidebar-info-card-body">
              <ul className="info-list">
                {(service.requiredDocs || []).map((doc, index) => (
                  <li key={index} className="info-list-item">{doc}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="sidebar-info-card">
            <div className="sidebar-info-card-header">
              <div className="sidebar-info-card-title">Các bước thực hiện</div>
            </div>
            <div className="sidebar-info-card-body">
              <ol className="steps-list">
                {(service.steps || []).map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          </div>

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

          <div className="dktt-sidebar-ai">
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
              Trợ lý AI sẵn sàng điền form tự động từ giọng nói hoặc ảnh CCCD của bạn.
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
      </main>
    </div>
  );
};

export default MainStepper;
