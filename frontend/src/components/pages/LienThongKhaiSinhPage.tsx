import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';
import { SERVICE_MAP } from '../../data/services';
import { useForm } from '../../contexts/FormContext';
import { validateForm } from '../../utils/validator';
import { agentEventBus } from '../../utils/eventBus';
import { FormFieldInput } from './ServicePageLayout';
import { applicationService } from '../../api/applicationService';
import { ApiClientError } from '../../api/client';
import type { ApplicationRecord } from '../../api/applicationService';

const service = SERVICE_MAP['lien-thong-khai-sinh'];

const stepGroups = [1, 2, 3].map((step) => ({
  step,
  title: service.steps[step - 1],
  fields: service.fields.filter((field) => field.step === step),
}));

const parseStep = (stepSlug?: string) => {
  const match = stepSlug?.match(/^buoc-(\d+)$/);
  const step = match ? Number(match[1]) : 1;
  return Math.min(Math.max(step, 1), stepGroups.length);
};

const LienThongKhaiSinhPage: React.FC = () => {
  const { formState, setFieldValue, setFieldError, touchField, setIsSubmitting, resetForm } = useForm();
  const { stepSlug } = useParams();
  const navigate = useNavigate();
  const [submittedApplication, setSubmittedApplication] = React.useState<ApplicationRecord | null>(null);
  const [submitError, setSubmitError] = React.useState('');

  const currentStep = parseStep(stepSlug);
  const currentGroup = stepGroups[currentStep - 1];

  const goToStep = (step: number) => {
    navigate(step === 1 ? service.route : `${service.route}/buoc-${step}`);
  };

  const getValue = (fieldId: string) => formState.values[fieldId] || '';

  const validateCurrentStep = () => {
    const errors = validateForm(formState.values, currentGroup.fields);
    currentGroup.fields.forEach((field) => {
      touchField(field.id);
      const matched = errors.find((error) => error.field === field.id);
      setFieldError(field.id, matched?.message || '');
    });
    return errors.length === 0;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    goToStep(currentStep + 1);
  };

  React.useEffect(() => {
    const handler = (event: { type: string; step?: number }) => {
      if (event.type !== 'NEXT_STEP') return;
      const targetStep = Math.min(
        event.step ?? currentStep + 1,
        currentStep + 1,
        stepGroups.length,
      );
      if (targetStep > currentStep) {
        handleNext();
      } else {
        goToStep(targetStep);
      }
    };
    agentEventBus.on('NEXT_STEP', handler as never);
    return () => agentEventBus.off('NEXT_STEP', handler as never);
  }, [currentStep, formState.values]);

  const handleTabClick = (targetStep: number) => {
    if (targetStep <= currentStep) {
      // Cho phép quay lại thoải mái
      goToStep(targetStep);
    } else if (targetStep === currentStep + 1) {
      // Nhảy sang bước kế tiếp thì phải pass validate
      handleNext();
    } else {
      // Không cho nhảy cóc (ví dụ 1 sang 3)
      alert('Vui lòng hoàn thành lần lượt từng bước!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmittedApplication(null);
    const errors = validateForm(formState.values, service.fields);
    service.fields.forEach((field) => {
      touchField(field.id);
      const matched = errors.find((error) => error.field === field.id);
      setFieldError(field.id, matched?.message || '');
    });
    if (errors.length > 0) return;

    try {
      setIsSubmitting(true);
      const application = await applicationService.submit({
        serviceId: service.id,
        submittedAt: new Date().toISOString(),
        data: Object.fromEntries(service.fields.map((field) => [field.id, getValue(field.id)])),
      });
      setSubmittedApplication(application);
    } catch (error) {
      if (error instanceof ApiClientError) {
        error.details.forEach((detail) => {
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

  return (
    <div className="main-content animate-slide-up">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/"><Home size={13} /> Trang Chủ</Link>
        <ChevronRight size={13} className="breadcrumb-sep" />
        <span>Liên thông</span>
        <ChevronRight size={13} className="breadcrumb-sep" />
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{service.name}</span>
      </nav>

      <div className="service-page">
        <div className="form-section">
          <div className="form-section-header">
            <h1 className="form-section-title">{service.name}</h1>
            <p className="form-section-subtitle">{service.description}</p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {stepGroups.map((group) => {
              // Vô hiệu hóa style cho các bước tương lai chưa được phép nhấn
              const isFuture = group.step > currentStep + 1;
              return (
                <button
                  key={group.step}
                  type="button"
                  className="btn btn-outline"
                  onClick={() => handleTabClick(group.step)}
                  style={{
                    background: currentStep === group.step ? '#C8441A' : isFuture ? '#f5f5f5' : 'white',
                    color: currentStep === group.step ? 'white' : isFuture ? '#aaa' : '#8B1A1A',
                    cursor: isFuture ? 'not-allowed' : 'pointer',
                    borderColor: isFuture ? '#ddd' : undefined,
                  }}
                >
                  {group.title}
                </button>
              );
            })}
          </div>

          <form className="form-body" onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              {currentGroup.fields.map((field) => (
                <FormFieldInput
                  key={field.id}
                  field={field}
                  value={getValue(field.id)}
                  onChange={(value) => setFieldValue(field.id, value)}
                  isAutofilled={!!formState.touched[field.id] && !!formState.values[field.id]}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              {currentStep > 1 && (
                <button type="button" className="btn btn-outline" onClick={() => goToStep(currentStep - 1)}>
                  Quay lại
                </button>
              )}
              {currentStep < stepGroups.length ? (
                <button type="button" className="btn btn-submit" onClick={handleNext}>
                  Tiếp tục
                </button>
              ) : (
                <button type="submit" className="btn btn-submit" disabled={formState.isSubmitting}>
                  {formState.isSubmitting ? 'Đang nộp...' : 'Nộp hồ sơ'}
                </button>
              )}
              <button type="button" className="btn btn-outline" onClick={() => { resetForm(); goToStep(1); }}>
                Làm lại
              </button>
            </div>
          </form>

          {submitError && (
            <div style={{ marginTop: 20, padding: 16, border: '1px solid #b91c1c', borderRadius: 12, color: '#b91c1c' }}>
              {submitError}
            </div>
          )}

          {submittedApplication && (
            <div style={{ marginTop: 20, padding: 16, border: '1px solid #C8441A', borderRadius: 12 }}>
              <strong>Đã nộp hồ sơ thành công.</strong>
              <div style={{ marginTop: 8 }}>Mã hồ sơ: {submittedApplication.id}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LienThongKhaiSinhPage;
