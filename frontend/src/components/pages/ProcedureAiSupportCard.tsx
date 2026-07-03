import React from 'react';

interface ProcedureAiSupportCardProps {
  className?: string;
}

const ProcedureAiSupportCard: React.FC<ProcedureAiSupportCardProps> = ({ className = '' }) => (
  <div className={`dktt-sidebar-ai procedure-ai-support-card${className ? ` ${className}` : ''}`}>
    <div className="procedure-ai-support-logo">
      <img src="/logo_Gov_Bridge.jpg" alt="AI" />
    </div>
    <div className="procedure-ai-support-title">Cần hỗ trợ?</div>
    <p>
      Trợ lý AI sẵn sàng điền form tự động từ giọng nói hoặc ảnh CCCD của bạn.
    </p>
    <div className="procedure-ai-support-tip">
      👉 Nhấn nút
      <img src="/logo_Gov_Bridge.jpg" alt="AI" />
      góc phải màn hình
    </div>
  </div>
);

export default ProcedureAiSupportCard;
