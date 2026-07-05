import type { FC } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface MissingRequiredFieldsModalProps {
    onClose: () => void;
}

export const MissingRequiredFieldsModal: FC<MissingRequiredFieldsModalProps> = ({ onClose }) => (
    <div className="xctt-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="missing-required-title">
        <div className="xctt-modal">
            <button type="button" className="xctt-modal-close" aria-label="Đóng" onClick={onClose}>
                <X size={20} />
            </button>
            <div className="xctt-modal-icon xctt-modal-icon-warning">
                <AlertCircle size={26} />
            </div>
            <h2 id="missing-required-title">Hồ sơ còn thiếu thông tin</h2>
            <p>Vui lòng bổ sung mục bắt buộc đang được đánh dấu trong biểu mẫu.</p>
            <button type="button" className="xctt-btn primary" onClick={onClose}>
                Kiểm tra lại
            </button>
        </div>
    </div>
);
