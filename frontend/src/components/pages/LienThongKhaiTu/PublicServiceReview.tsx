import React, { useEffect, useRef, useState } from "react";
import {
  Download,
  Menu,
  Minus,
  MoreVertical,
  Plus,
  Printer,
  RotateCw,
} from "lucide-react";
import { useForm } from "../../../contexts/FormContext";

interface PublicServiceReviewProps {
  onNext: () => void;
  onBack: () => void;
}

interface ReviewTab {
  title: string;
  url: string;
  pageCount: number;
  downloadName?: string;
}

interface GeneratedDeclarationSection {
  title: string;
  rows: Array<[string, string]>;
}

interface GeneratedDeclaration {
  title: string;
  recipient: string;
  description: string;
  signerName: string;
  downloadName: string;
  sections: GeneratedDeclarationSection[];
}

const REVIEW_TABS: ReviewTab[] = [
  {
    title: "Tờ khai đăng ký khai tử",
    url: "/lien-thong-khai-tu/to_khai_dang_ky_khai_tu.pdf",
    pageCount: 2,
  },
  {
    title: "Tờ khai thay đổi thông tin cư trú (CT01)",
    url: "/lien-thong-khai-tu/mau_ct01.pdf",
    pageCount: 2,
  },
  {
    title: "Tờ khai đề nghị hỗ trợ chi phí mai táng",
    url: "/lien-thong-khai-tu/to_khai_ho_tro_chi_phi_mai_tang.pdf",
    pageCount: 3,
  },
];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getFormText = (values: Record<string, string>, fieldId: string, fallback = "") =>
  (values[fieldId] || fallback).trim();

const joinNonEmpty = (items: string[], separator = ", ") =>
  items.map((item) => item.trim()).filter(Boolean).join(separator);

const formatDateForDeclaration = (value: string) => {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const buildNameFromFields = (
  values: Record<string, string>,
  lastNameId: string,
  middleNameId: string,
  firstNameId: string,
) =>
  joinNonEmpty(
    [
      getFormText(values, lastNameId),
      getFormText(values, middleNameId),
      getFormText(values, firstNameId),
    ],
    " ",
  );

const buildDeclarationAddress = (
  values: Record<string, string>,
  detailFieldId: string,
  wardFieldId: string,
  provinceFieldId: string,
) =>
  joinNonEmpty([
    getFormText(values, detailFieldId),
    getFormText(values, wardFieldId),
    getFormText(values, provinceFieldId),
  ]);

const buildDeclarationHtml = ({
  title,
  recipient,
  description,
  signerName,
  sections,
}: {
  title: string;
  recipient: string;
  description: string;
  signerName?: string;
  sections: GeneratedDeclarationSection[];
}) => `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef2f7; color: #000; font-family: "Times New Roman", serif; }
    .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 22mm 20mm; background: #fff; }
    .national { text-align: center; font-weight: 700; line-height: 1.45; }
    .national .underline { display: inline-block; border-bottom: 1px solid #000; padding: 0 18px 3px; }
    h1 { margin: 26px 0 8px; text-align: center; font-size: 21px; letter-spacing: 0; text-transform: uppercase; }
    .recipient { text-align: center; margin: 0 0 18px; font-size: 15px; }
    .description { margin: 0 0 18px; font-style: italic; }
    h2 { margin: 18px 0 8px; font-size: 16px; text-transform: uppercase; }
    .field-line { display: flex; align-items: baseline; gap: 6px; margin: 8px 0; font-size: 15.5px; line-height: 1.45; }
    .field-line strong { flex: 0 0 auto; font-weight: 700; }
    .field-line .value { flex: 1 1 auto; min-width: 90px; padding-left: 4px; }
    .empty { color: #9ca3af; font-style: italic; }
    .signature { width: 70mm; margin: 34px 0 0 auto; text-align: center; }
    .signature strong { display: block; margin-top: 42px; }
    @media print { body { background: #fff; } .sheet { margin: 0; width: auto; min-height: auto; padding: 0; } }
  </style>
</head>
<body>
  <main class="sheet">
    <div class="national">
      <div>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
      <div class="underline">Độc lập - Tự do - Hạnh phúc</div>
    </div>
    <h1>${escapeHtml(title)}</h1>
    <p class="recipient">Kính gửi: ${escapeHtml(recipient)}</p>
    <p class="description">${escapeHtml(description)}</p>
    ${sections.map((section) => `
      <section>
        <h2>${escapeHtml(section.title)}</h2>
        ${section.rows.map(([label, value]) => `
          <div class="field-line">
            <strong>${escapeHtml(label)}:</strong>
            <span class="value">${value ? escapeHtml(value) : '<span class="empty">Chưa có thông tin</span>'}</span>
          </div>
        `).join("")}
      </section>
    `).join("")}
    <div class="signature">
      <div>Người yêu cầu</div>
      <em>(Ký, ghi rõ họ tên)</em>
      <strong>${escapeHtml(signerName || "")}</strong>
    </div>
  </main>
</body>
</html>`;

const createDeclarationBlobUrl = (html: string) =>
  URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));

const buildGeneratedReviewTabs = (values: Record<string, string>): ReviewTab[] => {
  const requesterName = getFormText(values, "ltkt_applicant_fullName");
  const requesterAddress = buildDeclarationAddress(
    values,
    "ltkt_applicant_addressDetail",
    "ltkt_applicant_ward",
    "ltkt_applicant_province",
  );
  const deceasedName = buildNameFromFields(
    values,
    "ltkt_deceased_lastName",
    "ltkt_deceased_middleName",
    "ltkt_deceased_firstName",
  );
  const deceasedResidenceAddress = buildDeclarationAddress(
    values,
    "ltkt_deceased_residenceDetail",
    "ltkt_deceased_residenceWard",
    "ltkt_deceased_residenceProvince",
  );
  const deathAddress =
    getFormText(values, "ltkt_deceased_isDeathPlaceSameAsResidence") === "true"
      ? deceasedResidenceAddress
      : joinNonEmpty([
          getFormText(values, "ltkt_deceased_deathWard"),
          getFormText(values, "ltkt_deceased_deathProvince"),
          getFormText(values, "ltkt_deceased_deathCountry"),
        ]);
  const requestCopy =
    getFormText(values, "ltkt_deceased_requestCopy") === "no"
      ? "Không"
      : `Có, số lượng ${getFormText(values, "ltkt_deceased_requestCopyCount", "1")} bản`;

  const declarations: GeneratedDeclaration[] = [
    {
      title: "Tờ khai đăng ký khai tử",
      recipient: getFormText(
        values,
        "ltkt_agency_khaitu_name",
        "Ủy ban nhân dân cấp xã nơi đăng ký khai tử",
      ),
      description: "Tờ khai được sinh tự động từ thông tin đã nhập ở các bước trước.",
      signerName: requesterName,
      downloadName: "to-khai-dang-ky-khai-tu.doc",
      sections: [
        {
          title: "Thông tin người yêu cầu",
          rows: [
            ["Họ và tên", requesterName],
            ["Số định danh cá nhân", getFormText(values, "ltkt_applicant_idNumber")],
            ["Ngày sinh", formatDateForDeclaration(getFormText(values, "ltkt_applicant_dob"))],
            ["Giới tính", getFormText(values, "ltkt_applicant_gender")],
            ["Quan hệ với người chết", getFormText(values, "ltkt_applicant_relationship")],
            ["Số điện thoại", getFormText(values, "ltkt_applicant_phone")],
            ["Email", getFormText(values, "ltkt_applicant_email")],
            ["Địa chỉ liên hệ", requesterAddress],
          ],
        },
        {
          title: "Thông tin người được khai tử",
          rows: [
            ["Họ và tên", deceasedName],
            ["Ngày sinh", formatDateForDeclaration(getFormText(values, "ltkt_deceased_dob"))],
            ["Giới tính", getFormText(values, "ltkt_deceased_gender")],
            ["Số định danh cá nhân", getFormText(values, "ltkt_deceased_idNumber")],
            ["Quốc tịch", getFormText(values, "ltkt_deceased_nationality")],
            ["Dân tộc", getFormText(values, "ltkt_deceased_ethnicity")],
            ["Nơi cư trú cuối cùng", deceasedResidenceAddress],
            ["Thời gian chết", formatDateForDeclaration(getFormText(values, "ltkt_deceased_deathDate"))],
            ["Nơi chết", deathAddress],
            ["Nguyên nhân chết", getFormText(values, "ltkt_deceased_causeOfDeath")],
            ["Đề nghị cấp bản sao", requestCopy],
          ],
        },
      ],
    },
    {
      title: "Tờ khai thay đổi thông tin cư trú (CT01)",
      recipient: getFormText(values, "ltkt_agency_thuongtru_name", "Cơ quan đăng ký cư trú"),
      description: "Tờ khai phục vụ xóa đăng ký thường trú cho người đã chết.",
      signerName: requesterName,
      downloadName: "to-khai-thay-doi-thong-tin-cu-tru-ct01.doc",
      sections: [
        {
          title: "Thông tin người có thay đổi thông tin cư trú",
          rows: [
            ["Họ và tên", deceasedName],
            ["Ngày sinh", formatDateForDeclaration(getFormText(values, "ltkt_deceased_dob"))],
            ["Giới tính", getFormText(values, "ltkt_deceased_gender")],
            ["Số định danh cá nhân", getFormText(values, "ltkt_deceased_idNumber")],
            ["Nơi thường trú", deceasedResidenceAddress],
            ["Nội dung đề nghị", "Xóa đăng ký thường trú do đã chết"],
          ],
        },
        {
          title: "Thông tin người yêu cầu",
          rows: [
            ["Họ và tên", requesterName],
            ["Số định danh cá nhân", getFormText(values, "ltkt_applicant_idNumber")],
            ["Quan hệ với người chết", getFormText(values, "ltkt_applicant_relationship")],
            ["Địa chỉ liên hệ", requesterAddress],
          ],
        },
      ],
    },
    {
      title: "Tờ khai đề nghị hỗ trợ chi phí mai táng",
      recipient: getFormText(
        values,
        "ltkt_agency_maitang_name",
        "Cơ quan giải quyết chế độ mai táng",
      ),
      description: "Tờ khai đề nghị hỗ trợ chi phí mai táng được sinh tự động từ hồ sơ khai tử.",
      signerName: requesterName,
      downloadName: "to-khai-ho-tro-chi-phi-mai-tang.doc",
      sections: [
        {
          title: "Thông tin người đề nghị",
          rows: [
            ["Họ và tên", requesterName],
            ["Số định danh cá nhân", getFormText(values, "ltkt_applicant_idNumber")],
            ["Ngày sinh", formatDateForDeclaration(getFormText(values, "ltkt_applicant_dob"))],
            ["Giới tính", getFormText(values, "ltkt_applicant_gender")],
            ["Quan hệ với người chết", getFormText(values, "ltkt_applicant_relationship")],
            ["Số điện thoại", getFormText(values, "ltkt_applicant_phone")],
            ["Địa chỉ liên hệ", requesterAddress],
          ],
        },
        {
          title: "Thông tin người chết",
          rows: [
            ["Họ và tên", deceasedName],
            ["Số định danh cá nhân", getFormText(values, "ltkt_deceased_idNumber")],
            ["Ngày chết", formatDateForDeclaration(getFormText(values, "ltkt_deceased_deathDate"))],
            ["Nơi cư trú cuối cùng", deceasedResidenceAddress],
            ["Đối tượng hưởng trợ cấp mai táng phí", getFormText(values, "ltkt_agency_maitang_doiTuong")],
          ],
        },
        {
          title: "Thông tin tiếp nhận trợ cấp",
          rows: [
            ["Loại người nhận", getFormText(values, "ltkt_deceased_recipientType") === "org" ? "Cơ quan, tổ chức" : "Cá nhân"],
            ["Cơ quan thực hiện", getFormText(values, "ltkt_agency_maitang_name")],
          ],
        },
      ],
    },
  ];

  return declarations.map((declaration) => ({
    title: declaration.title,
    url: createDeclarationBlobUrl(buildDeclarationHtml(declaration)),
    pageCount: 1,
    downloadName: declaration.downloadName,
  }));
};

const PublicServiceReview: React.FC<PublicServiceReviewProps> = ({
  onNext,
  onBack,
}) => {
  const { formState } = useForm();
  const [activeTab, setActiveTab] = useState(0);
  const [generatedTabs, setGeneratedTabs] = useState<ReviewTab[]>([]);
  const [isTabListVisible, setIsTabListVisible] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reviewTabs = generatedTabs.length > 0 ? generatedTabs : REVIEW_TABS;
  const activeReviewTab = reviewTabs[activeTab] ?? reviewTabs[0];

  useEffect(() => {
    const tabs = buildGeneratedReviewTabs(formState.values);
    setGeneratedTabs(tabs);
    return () => {
      tabs.forEach((tab) => URL.revokeObjectURL(tab.url));
    };
  }, [formState.values]);

  useEffect(() => {
    if (activeTab >= reviewTabs.length) {
      setActiveTab(0);
    }
  }, [activeTab, reviewTabs.length]);

  useEffect(() => {
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
            {reviewTabs.map((tab, index) => (
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
              <a
                href={activeReviewTab.url}
                download={activeReviewTab.downloadName || true}
                title="Tải tờ khai"
                aria-label="Tải tờ khai"
              >
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
