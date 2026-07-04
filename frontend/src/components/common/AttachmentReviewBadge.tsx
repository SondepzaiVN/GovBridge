import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { DocumentReviewUiState } from '../../types';

interface AttachmentReviewBadgeProps {
    review?: DocumentReviewUiState;
}

export const AttachmentReviewBadge: React.FC<AttachmentReviewBadgeProps> = ({ review }) => {
    const badgeRef = React.useRef<HTMLSpanElement>(null);
    const [tooltipPosition, setTooltipPosition] = React.useState<{
        top: number;
        left: number;
        width: number;
        side: 'right' | 'left' | 'bottom';
    } | null>(null);

    React.useEffect(() => {
        if (!tooltipPosition) return undefined;
        const closeOnViewportMove = () => setTooltipPosition(null);
        window.addEventListener('scroll', closeOnViewportMove, true);
        window.addEventListener('wheel', closeOnViewportMove, { passive: true });
        window.addEventListener('resize', closeOnViewportMove);
        return () => {
            window.removeEventListener('scroll', closeOnViewportMove, true);
            window.removeEventListener('wheel', closeOnViewportMove);
            window.removeEventListener('resize', closeOnViewportMove);
        };
    }, [tooltipPosition]);

    if (!review) return null;

    const isChecking = review.status === 'checking';
    const isValid = review.status === 'valid';
    const comment = review.result?.text || review.text;
    const label = isChecking
        ? 'Đang kiểm tra'
        : isValid
            ? 'Hồ sơ hợp lệ sơ bộ'
            : 'Hồ sơ cần kiểm tra lại';

    const showTooltip = () => {
        const rect = badgeRef.current?.getBoundingClientRect();
        if (!rect) return;
        const availableRight = window.innerWidth - rect.right - 16;
        const availableLeft = rect.left - 16;
        const rightSideLeft = rect.right + 12;
        const side = availableRight >= 190
            ? 'right'
            : availableLeft >= 260
                ? 'left'
                : 'bottom';
        const tooltipWidth = side === 'right'
            ? Math.min(440, Math.max(190, availableRight - 12))
            : side === 'left'
                ? Math.min(440, Math.max(260, availableLeft - 12))
                : Math.min(440, window.innerWidth - 32);
        const left = side === 'right'
            ? rightSideLeft
            : side === 'left'
                ? Math.max(16, rect.left - tooltipWidth - 12)
                : Math.min(window.innerWidth - tooltipWidth - 16, Math.max(16, rect.left - tooltipWidth / 2));
        const top = Math.min(
            window.innerHeight - 120,
            Math.max(16, side === 'bottom' ? rect.bottom + 10 : rect.top + rect.height / 2 - 42),
        );
        setTooltipPosition({
            top,
            left,
            width: tooltipWidth,
            side,
        });
    };

    const hideTooltip = () => setTooltipPosition(null);

    return (
        <>
            <span
                ref={badgeRef}
                className={`attachment-review-badge ${review.status}`}
                tabIndex={0}
                aria-label={`${label}: ${comment}`}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
            >
                {isChecking ? <Loader2 size={14} /> : isValid ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            </span>
            {tooltipPosition && createPortal(
                <div
                    className={`attachment-review-floating-tooltip ${review.status} ${tooltipPosition.side}`}
                    role="tooltip"
                    style={{
                        top: tooltipPosition.top,
                        left: tooltipPosition.left,
                        width: tooltipPosition.width,
                    }}
                >
                    <strong>{label}</strong>
                    <p>{comment}</p>
                </div>,
                document.body,
            )}
        </>
    );
};
