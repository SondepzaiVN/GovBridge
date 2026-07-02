import React from "react";

interface StepHeaderProps {
  currentStep: number;
}

const STEPS_DATA = [
  { num: "0 1", title: "Lựa chọn cơ quan thực hiện" },
  { num: "0 2", title: "Kê khai" },
  { num: "0 3", title: "Xem lại các tờ khai chi tiết" },
  { num: "0 4", title: "Đính kèm thành phần hồ sơ" },
  { num: "0 5", title: "Lựa chọn hình thức nhận kết quả" },
  { num: "0 6", title: "Hoàn thành" },
];

const StepHeader: React.FC<StepHeaderProps> = ({ currentStep }) => {
  return (
    <div className="ltks-stepper" role="tablist" aria-label="Các bước kê khai">
      {STEPS_DATA.map((step, index) => {
        const stepNum = index + 1;
        const state = stepNum === currentStep ? "active" : stepNum < currentStep ? "done" : "";

        return (
          <button
            type="button"
            className={`ltks-step ${state}`}
            key={step.title}
            role="tab"
            aria-selected={stepNum === currentStep}
          >
            <span>{step.num}</span>
            <strong>{step.title}</strong>
          </button>
        );
      })}
    </div>
  );
};

export default StepHeader;

