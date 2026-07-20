import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Home, ChevronRight } from "lucide-react";
import StepHeader from "./StepHeader";
import PublicServiceForm from "./PublicServiceForm";
import PublicServiceDeclaration from "./PublicServiceDeclaration";
import PublicServiceReview from "./PublicServiceReview";
import PublicServiceAttachments from "./PublicServiceAttachments";
import PublicServiceResultOptions from "./PublicServiceResultOptions";
import PublicServiceComplete from "./PublicServiceComplete";
import { ROUTE_TO_SERVICE_MAP } from "../../../data/services";
import { useForm } from "../../../contexts/FormContext";
import {
  clearSubmissionId,
  getDashboardApplicationCode,
  getOrCreateSubmissionId,
  saveApplicationToDashboard,
} from "../../../utils/dashboardSync";
import { isLikelyConnectivityError, notifyConnectivityFallback } from "../../../utils/connectivityFallback";

const MainStepper: React.FC = () => {
  const service = ROUTE_TO_SERVICE_MAP['/lien-thong-khai-tu'] || { requiredDocs: [], steps: [], processingTime: '', fee: '', category: '' };
  const { formState } = useForm();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedApplicationCode, setSubmittedApplicationCode] = useState("");

  // Hàm chuyển bước (Bạn có thể truyền hàm này vào PublicServiceForm dưới dạng props)
  const nextStep = () => setCurrentStep((prev) => (prev < 6 ? prev + 1 : prev));
  const prevStep = () => setCurrentStep((prev) => (prev > 1 ? prev - 1 : prev));

  const submitApplication = async () => {
    if (isSubmittingApplication) return;

    setSubmitError("");
    setIsSubmittingApplication(true);
    try {
      const values = formState.values;
      const submissionId = getOrCreateSubmissionId("lien-thong-khai-tu");
      const deceasedName = [
        values.ltkt_deceased_lastName,
        values.ltkt_deceased_middleName,
        values.ltkt_deceased_firstName,
      ].filter(Boolean).join(" ");

      const savedApplication = await saveApplicationToDashboard({
        clientSubmissionId: submissionId,
        procedure: "Liên thông khai tử, xóa đăng ký thường trú, trợ cấp mai táng",
        applicant: values.ltkt_applicant_fullName || values.ltkt_fullName || "",
        citizenId: values.ltkt_applicant_idNumber || values.ltkt_idNumber || "",
        phone: values.ltkt_applicant_phone || "",
        email: values.ltkt_applicant_email || "",
        documents: [],
        message: "Người dân đã hoàn tất kê khai hồ sơ liên thông khai tử.",
        caseNote: "Liên thông khai tử",
        details: {
          "Người được khai tử": deceasedName,
          "Số định danh người được khai tử": values.ltkt_deceased_idNumber || "",
          "Ngày mất": values.ltkt_deceased_deathDate || "",
          "Quan hệ với người yêu cầu": values.ltkt_applicant_relationship || "",
          "Cơ quan đăng ký": values.ltkt_registrationAgency || values.ltkt_agency || "",
        },
      });

      setSubmittedApplicationCode(getDashboardApplicationCode(savedApplication));
      clearSubmissionId("lien-thong-khai-tu");
      nextStep();
    } catch (error) {
      console.error("Không thể xác nhận nộp hồ sơ khai tử.", error);
      if (isLikelyConnectivityError(error)) {
        notifyConnectivityFallback({ playAudio: true });
        setSubmitError(
          "Chưa xác nhận nộp hồ sơ thành công do kết nối bị gián đoạn. Dữ liệu vẫn được giữ trên màn hình, vui lòng kiểm tra mạng rồi bấm Hoàn thành để gửi lại.",
        );
      } else {
        setSubmitError("Chưa thể nộp hồ sơ. Hệ thống chưa xác nhận đã nhận hồ sơ, vui lòng thử lại sau.");
      }
    } finally {
      setIsSubmittingApplication(false);
    }
  };

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
          <PublicServiceResultOptions
            isSubmitting={isSubmittingApplication}
            submitError={submitError}
            onSubmit={submitApplication}
            onBack={prevStep}
          />
        );
      case 6:
        return <PublicServiceComplete applicationCode={submittedApplicationCode} onReset={() => setCurrentStep(1)} />;
      default:
        return null;
    }
  };

  return (
    <div className="ltks-page ltks-app-page ltkt-page-shell animate-slide-up">
      <main className="ltks-main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/">
            <Home size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Trang Chủ
          </Link>
          <ChevronRight size={13} className="breadcrumb-sep" />
          <span>Hộ tịch</span>
          <ChevronRight size={13} className="breadcrumb-sep" />
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
            Liên thông khai tử
          </span>
        </nav>
        
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

        </aside>
      </main>
    </div>
  );
};

export default MainStepper;
