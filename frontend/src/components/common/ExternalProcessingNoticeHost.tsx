import React from 'react';
import { CheckCircle2, ShieldCheck, X } from 'lucide-react';
import {
    subscribeExternalProcessingNotices,
    type ExternalProcessingNotice,
} from '../../utils/externalProcessingNotices';

export const ExternalProcessingNoticeHost: React.FC = () => {
    const [notice, setNotice] = React.useState<ExternalProcessingNotice | null>(null);

    React.useEffect(() => subscribeExternalProcessingNotices(setNotice), []);

    if (!notice) return null;

    const isOpenAiReview = notice.kind === 'openai-review';

    return (
        <div className="external-processing-notice" role="status" aria-live="polite">
            <div className={`external-processing-icon ${notice.kind}`}>
                {isOpenAiReview ? <ShieldCheck size={22} /> : <CheckCircle2 size={22} />}
            </div>
            <div className="external-processing-copy">
                <strong>{notice.title}</strong>
                <p>{notice.message}</p>
            </div>
            <div className="external-processing-actions">
                <button
                    type="button"
                    className="external-processing-primary"
                    onClick={() => setNotice(null)}
                >
                    {notice.actionLabel}
                </button>
                <button
                    type="button"
                    className="external-processing-close"
                    aria-label="Đóng thông báo"
                    onClick={() => setNotice(null)}
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};
