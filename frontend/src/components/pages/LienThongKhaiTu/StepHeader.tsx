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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        backgroundColor: "transparent",
        padding: "30px 20px",
        marginBottom: "20px",
        overflowX: "auto", // Hỗ trợ scroll ngang trên màn hình nhỏ
      }}
    >
      {STEPS_DATA.map((step, index) => {
        const stepNum = index + 1;
        const isActive = stepNum <= currentStep; // Các bước đã qua hoặc hiện tại đều được tô màu

        return (
          <React.Fragment key={index}>
            {/* Khối Step */}
            <div
              style={{
                width: "120px",
                height: "150px",
                border: `2px solid ${isActive ? "#ff5722" : "#a0a0a0"}`,
                borderRadius: "8px",
                padding: "4px",
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
                backgroundColor: "transparent",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  flex: 1,
                  backgroundColor: isActive ? "#fdc543" : "#d1d1d1",
                  borderRadius: "4px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  padding: "15px 5px",
                  boxShadow: "inset 0 0 5px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: "bold",
                    color: "#222",
                    letterSpacing: "4px",
                    marginBottom: "12px",
                  }}
                >
                  {step.num}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#222",
                    textAlign: "center",
                    lineHeight: "1.4",
                  }}
                >
                  {step.title}
                </div>
              </div>
            </div>

            {/* Mũi tên kết nối (trừ phần tử cuối) */}
            {index < STEPS_DATA.length - 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "35px",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: "2px",
                    backgroundColor: isActive ? "#ff5722" : "#a0a0a0",
                  }}
                />
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: "5px solid transparent",
                    borderBottom: "5px solid transparent",
                    borderLeft: `7px solid ${isActive ? "#ff5722" : "#a0a0a0"}`,
                  }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default StepHeader;

