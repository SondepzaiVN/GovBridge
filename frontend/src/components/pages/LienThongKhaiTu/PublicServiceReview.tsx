import React, { useState } from "react";
import {
  Download,
  Menu,
  Minus,
  MoreVertical,
  Plus,
  Printer,
  RotateCw,
} from "lucide-react";

interface PublicServiceReviewProps {
  onNext: () => void;
  onBack: () => void;
}

interface ReviewTab {
  title: string;
  url: string;
  pageCount: number;
}

const REVIEW_TABS: ReviewTab[] = [
  {
    title: "Tờ khai đăng ký khai tử",
    url: "/lien-thong-khai-tu/tokhai_khaitu.pdf",
    pageCount: 2,
  },
  {
    title: "Tờ khai thay đổi thông tin cư trú (CT01)",
    url: "/lien-thong-khai-tu/tokhai_xoa_dang_ky_thuong_tru.pdf",
    pageCount: 2,
  },
  {
    title: "Tờ khai đề nghị hỗ trợ chi phí mai táng",
    url: "/lien-thong-khai-tu/tokhai_mai_tang_phi.pdf",
    pageCount: 3,
  },
];

const PublicServiceReview: React.FC<PublicServiceReviewProps> = ({
  onNext,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [isTabListVisible, setIsTabListVisible] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const activeReviewTab = REVIEW_TABS[activeTab] ?? REVIEW_TABS[0];

  React.useEffect(() => {
    setZoom(100);
    setRotation(0);
  }, [activeReviewTab.url]);

  const handlePrint = () => {
    const printWindow = window.open(activeReviewTab.url, "_blank");
    if (printWindow) {
      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 700);
      return;
    }

    iframeRef.current?.contentWindow?.focus();
    iframeRef.current?.contentWindow?.print();
  };

  const handleZoomOut = () => setZoom((currentZoom) => Math.max(50, currentZoom - 10));
  const handleZoomIn = () => setZoom((currentZoom) => Math.min(200, currentZoom + 10));
  const handleRotate = () => setRotation((currentRotation) => (currentRotation + 90) % 360);

  return (
    <section className="ltks-section ltkt-review-section">
      <div className="ltks-section-title">
        <h3>Xem lại các tờ khai chi tiết</h3>
      </div>

      <div className="ltks-pdf-review">
        {isTabListVisible && (
          <div className="ltks-pdf-tabs" role="tablist" aria-label="Danh sách tờ khai">
            {REVIEW_TABS.map((tab, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={index === activeTab}
                className={index === activeTab ? "active" : ""}
                key={tab.title}
                onClick={() => setActiveTab(index)}
              >
                {tab.title}
              </button>
            ))}
          </div>
        )}

        <div className="ltks-pdf-panel" role="tabpanel" aria-label={activeReviewTab.title}>
          <div className="ltks-pdf-toolbar">
            <div className="ltks-pdf-toolbar-group">
              <button
                type="button"
                aria-label={isTabListVisible ? "Ẩn danh mục tờ khai" : "Mở danh mục tờ khai"}
                title={isTabListVisible ? "Ẩn danh mục tờ khai" : "Mở danh mục tờ khai"}
                onClick={() => setIsTabListVisible((isVisible) => !isVisible)}
              >
                <Menu size={20} />
              </button>
              <strong>{activeReviewTab.title}</strong>
            </div>

            <div className="ltks-pdf-toolbar-group center">
              <span>1 / {activeReviewTab.pageCount}</span>
              <span className="ltks-pdf-divider" />
              <button type="button" aria-label="Thu nhỏ" title="Thu nhỏ" onClick={handleZoomOut}>
                <Minus size={18} />
              </button>
              <span>{zoom}%</span>
              <button type="button" aria-label="Phóng to" title="Phóng to" onClick={handleZoomIn}>
                <Plus size={18} />
              </button>
              <span className="ltks-pdf-divider" />
              <button type="button" aria-label="Xoay trang" title="Xoay trang" onClick={handleRotate}>
                <RotateCw size={18} />
              </button>
            </div>

            <div className="ltks-pdf-toolbar-group">
              <button type="button" aria-label="In tờ khai" title="In tờ khai" onClick={handlePrint}>
                <Printer size={18} />
              </button>
              <a href={activeReviewTab.url} download title="Tải tờ khai" aria-label="Tải tờ khai">
                <Download size={18} />
              </a>
              <button
                type="button"
                aria-label="Mở tờ khai trong tab mới"
                title="Mở tờ khai trong tab mới"
                onClick={() => window.open(activeReviewTab.url, "_blank", "noopener,noreferrer")}
              >
                <MoreVertical size={18} />
              </button>
            </div>
          </div>

          <div className="ltks-pdf-canvas">
            <div
              className="ltks-pdf-frame-shell"
              style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)` }}
            >
              <iframe
                ref={iframeRef}
                key={activeReviewTab.url}
                className="ltks-pdf-frame"
                src={`${activeReviewTab.url}#toolbar=0&navpanes=0&view=FitH`}
                title={activeReviewTab.title}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="ltks-actions">
        <button type="button" className="ltks-btn ghost">
          Hủy
        </button>
        <button type="button" className="ltks-btn secondary" onClick={onBack}>
          Quay lại bước trước
        </button>
        <button type="button" className="ltks-btn primary" onClick={onNext}>
          Chuyển bước tiếp theo
        </button>
      </div>
    </section>
  );
};

export default PublicServiceReview;
