import React, { useState, useRef } from "react";
import { AttachmentReviewBadge } from "../../common/AttachmentReviewBadge";
import type { DocumentReviewUiState } from "../../../types";
import { reviewUploadedDocument } from "../../../utils/attachmentDocumentReview";

interface AttachmentItem {
  id: number;
  name: string;
  count: number;
  fileName: string | null;
  review?: DocumentReviewUiState;
}

interface PublicServiceAttachmentsProps {
  onNext: () => void;
  onBack: () => void;
}

const PublicServiceAttachments: React.FC<PublicServiceAttachmentsProps> = ({
  onNext,
  onBack,
}) => {
  // 1. DANH SÁCH GIẤY TỜ CẦN ĐÍNH KÈM (Theo đúng ảnh bạn gửi)
  const [attachments, setAttachments] = useState<AttachmentItem[]>([
    {
      id: 1,
      name: "Bản chụp Giấy báo tử hoặc giấy tờ thay thế Giấy báo tử do cơ quan có thẩm quyền cấp. Khi tới cơ quan đăng ký hộ tịch nhận kết quả (Trích lục khai tử/bản sao Trích lục khai tử) người có yêu cầu ĐKKT xuất trình Giấy tờ tuỳ thân, nộp bản chính Giấy báo tử hoặc giấy tờ thay thế Giấy báo tử do cơ quan có thẩm quyền cấp trừ trường hợp đã tải lên bản sao điện tử từ các giấy tờ này.",
      count: 1,
      fileName: null,
    },
    {
      id: 2,
      name: "Bản chụp Giấy tờ, tài liệu, chứng cứ do cơ quan, tổ chức có thẩm quyền cấp hoặc xác nhận hợp lệ chứng minh sự kiện chết đối với trường hợp đăng ký khai tử cho người chết đã lâu, không có Giấy báo tử hoặc giấy tờ thay thế Giấy báo tử. Khi tới cơ quan đăng ký hộ tịch nhận kết quả (Trích lục khai tử/bản sao Trích lục khai tử) người có yêu cầu ĐKKT xuất trình Giấy tờ, tài liệu, chứng cứ do cơ quan, tổ chức có thẩm quyền cấp hoặc xác nhận hợp lệ chứng minh sự kiện chết đối với trường hợp đăng ký khai tử cho người chết đã lâu, không có Giấy báo tử hoặc giấy tờ thay thế Giấy báo tử trừ trường hợp đã tải lên bản sao điện tử từ các giấy tờ này.",
      count: 1,
      fileName: null,
    },
  ]);

  // Ref để mở trình chọn tệp
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  const handleUploadClick = (id: number) => {
    setActiveId(id);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && activeId !== null) {
      const targetId = activeId;
      setAttachments((prev) =>
        prev.map((item) =>
          item.id === targetId ? { ...item, fileName: file.name } : item,
        ),
      );
      const reviewTarget = attachments.find((item) => item.id === targetId);
      void reviewUploadedDocument({
        file,
        label: reviewTarget?.name || file.name,
        currentRoute: '/khai-tu',
        onStatusChange: (review) => {
          setAttachments((prev) =>
            prev.map((item) =>
              item.id === targetId ? { ...item, review } : item,
            ),
          );
        },
      });
    }
  };

  // --- STYLES ---
  const tableHeaderStyle: React.CSSProperties = {
    backgroundColor: "#fff",
    border: "1px solid #dee2e6",
    padding: "12px",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: "14px",
  };

  const tableCellStyle: React.CSSProperties = {
    border: "1px solid #dee2e6",
    padding: "15px",
    fontSize: "14px",
    verticalAlign: "middle",
    color: "#333",
    lineHeight: "1.5",
  };

  const uploadButtonStyle: React.CSSProperties = {
    backgroundColor: "#a04000",
    color: "#fff",
    border: "none",
    padding: "8px 15px",
    borderRadius: "4px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    margin: "0 auto",
    fontSize: "14px",
  };

  return (
    <div
      style={{
        maxWidth: "960px",
        margin: "20px auto",
        padding: "40px",
        backgroundColor: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        borderRadius: "8px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Ẩn input file để custom button */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "30px",
        }}
      >
        <thead>
          <tr>
            <th style={{ ...tableHeaderStyle, width: "60px" }}>STT</th>
            <th style={{ ...tableHeaderStyle }}>Tên giấy tờ</th>
            <th style={{ ...tableHeaderStyle, width: "100px" }}>Số bản</th>
            <th style={{ ...tableHeaderStyle, width: "200px" }}>Tệp tin</th>
            <th style={{ ...tableHeaderStyle, width: "120px" }}>Mẫu đơn</th>
          </tr>
        </thead>
        <tbody>
          {attachments.map((item) => (
            <tr key={item.id}>
              <td style={{ ...tableCellStyle, textAlign: "center" }}>
                {item.id}
              </td>
              <td style={{ ...tableCellStyle, textAlign: "justify" }}>
                {item.name}
              </td>
              <td style={{ ...tableCellStyle, textAlign: "center" }}>
                {item.count}
              </td>
              <td style={{ ...tableCellStyle, textAlign: "center" }}>
                <button
                  onClick={() => handleUploadClick(item.id)}
                  style={uploadButtonStyle}
                >
                  <span style={{ fontSize: "16px" }}>📎</span> Chọn tệp tin
                </button>
                {item.fileName && (
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "12px",
                      color: "green",
                      fontWeight: "bold",
                      wordBreak: "break-all",
                    }}
                  >
                    <span className="attachment-review-inline">
                      <span>✅ {item.fileName}</span>
                      <AttachmentReviewBadge review={item.review} />
                    </span>
                  </div>
                )}
              </td>
              <td style={{ ...tableCellStyle }}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ĐIỀU HƯỚNG */}
      <div style={{ display: "flex", justifyContent: "center", gap: "15px" }}>
        <button
          style={{
            padding: "10px 24px",
            backgroundColor: "#e0e0e0",
            color: "#333",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          Hủy
        </button>
        <button
          onClick={onBack}
          style={{
            padding: "10px 24px",
            backgroundColor: "#fff",
            color: "#666",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          Quay lại bước trước
        </button>
        <button
          onClick={onNext}
          style={{
            padding: "10px 24px",
            backgroundColor: "#a04000",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          Chuyển bước tiếp theo
        </button>
      </div>
    </div>
  );
};

export default PublicServiceAttachments;
