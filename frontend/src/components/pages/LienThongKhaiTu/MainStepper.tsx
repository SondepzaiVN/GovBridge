import React, { useState } from "react";
import StepHeader from "./StepHeader";
import PublicServiceForm from "./PublicServiceForm";
import PublicServiceDeclaration from "./PublicServiceDeclaration";
import PublicServiceReview from "./PublicServiceReview";
import PublicServiceAttachments from "./PublicServiceAttachments";
import PublicServiceResultOptions from "./PublicServiceResultOptions";
import PublicServiceComplete from "./PublicServiceComplete";

const MainStepper: React.FC = () => {
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
    <div className="ltkt-page-shell">
      {/* Header màu xanh của cổng DVC (Mockup) */}

      {/* Thanh Stepper */}
      <StepHeader currentStep={currentStep} />

      <div className="ltkt-step-content ltkt-standard-notices">
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

      {/* Nội dung thay đổi theo Step */}
      <div className="ltkt-step-content">
        {renderStepContent()}
      </div>
    </div>
  );
};

export default MainStepper;
