// ============================================================
// Agent Tools — OpenAI Function Calling definitions
// Mỗi tool = 1 hành động agent có thể thực hiện trên UI
// ============================================================

import type { PublicService } from '../types';

// Tạo danh sách element IDs có thể highlight theo route
export const getPageElements = (route: string, services: PublicService[]) => {
  const service = services.find(s => s.route === route);
  const baseElements = [
    { id: 'submit-btn', label: 'Nút Nộp Hồ Sơ' },
    { id: 'search-bar', label: 'Ô tìm kiếm dịch vụ' },
    { id: 'login-btn', label: 'Nút Đăng nhập' },
  ];

  if (!service) return baseElements;

  const formElements = service.fields.map(f => ({
    id: f.id,
    label: f.label,
  }));

  return [...formElements, ...baseElements];
};

// ============================================================
// Tool Definitions (chuẩn OpenAI function calling schema)
// ============================================================
export const buildAgentTools = (route: string, services: PublicService[]) => {
  const elements = getPageElements(route, services);
  const elementIds = elements.map(e => e.id);
  const elementDesc = elements.map(e => `"${e.id}" (${e.label})`).join(', ');

  return [
    // --- 1. Trả lời thông thường ---
    {
      type: 'function' as const,
      function: {
        name: 'chat_response',
        description:
          'Trả lời câu hỏi thông thường, tư vấn thủ tục, giải thích quy trình. Dùng khi không cần thao tác UI.',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Nội dung câu trả lời bằng tiếng Việt, có thể dùng markdown **bold**.',
            },
            suggestions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Danh sách 2-3 gợi ý cho bước tiếp theo.',
            },
          },
          required: ['message'],
        },
      },
    },

    // --- 2. Highlight element trên UI ---
    {
      type: 'function' as const,
      function: {
        name: 'highlight_element',
        description:
          'Làm sáng (spotlight) một phần tử trên màn hình để chỉ dẫn người dùng. Dùng khi người dùng hỏi "ở đâu", "chỗ nào", "nút nào", "tìm ô nhập" hay muốn biết vị trí một trường cụ thể.',
        parameters: {
          type: 'object',
          properties: {
            element_id: {
              type: 'string',
              enum: elementIds.length > 0 ? elementIds : ['submit-btn'],
              description: `ID của element cần highlight. Các element hiện có trên trang: ${elementDesc}`,
            },
            message: {
              type: 'string',
              description: 'Câu nói thân thiện kèm theo, ví dụ: "Bạn điền họ tên vào ô đang sáng nhé!"',
            },
            suggestions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Gợi ý bước tiếp theo.',
            },
          },
          required: ['element_id', 'message'],
        },
      },
    },

    // --- 3. Tự động điền form ---
    {
      type: 'function' as const,
      function: {
        name: 'auto_fill_form',
        description:
          'Điền thông tin vào các ô trong form khi người dùng cung cấp dữ liệu (họ tên, ngày sinh, CCCD, SĐT, địa chỉ…). Chỉ điền các field thực sự được đề cập.',
        parameters: {
          type: 'object',
          properties: {
            fields: {
              type: 'object',
              description:
                'Object key-value: key là field ID trong form, value là giá trị cần điền. Ví dụ: { "hoTen": "Nguyễn Văn A", "ngaySinh": "1990-01-01" }',
              additionalProperties: { type: 'string' },
            },
            message: {
              type: 'string',
              description: 'Thông báo xác nhận đã điền, liệt kê những gì vừa được điền.',
            },
            suggestions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Gợi ý bước tiếp theo.',
            },
          },
          required: ['fields', 'message'],
        },
      },
    },

    // --- 4. Chuyển trang ---
    {
      type: 'function' as const,
      function: {
        name: 'navigate_page',
        description:
          'Chuyển người dùng sang trang dịch vụ khác. Dùng khi người dùng đề cập rõ muốn làm một dịch vụ cụ thể (khai sinh, hộ khẩu, CCCD, kết hôn). Hỏi xác nhận trước khi navigate.',
        parameters: {
          type: 'object',
          properties: {
            route: {
              type: 'string',
              enum: ['/khai-sinh', '/ho-khau', '/cccd', '/ket-hon', '/'],
              description: 'Đường dẫn của trang cần chuyển đến.',
            },
            service_name: {
              type: 'string',
              description: 'Tên dịch vụ hiển thị cho người dùng, ví dụ: "Đăng ký Khai Sinh".',
            },
            message: {
              type: 'string',
              description: 'Câu xác nhận hoặc mời người dùng đồng ý chuyển trang.',
            },
            suggestions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Gợi ý: ít nhất có "Đồng ý, chuyển ngay!" và "Thôi, để sau".',
            },
          },
          required: ['route', 'service_name', 'message'],
        },
      },
    },

    // --- 5. Kiểm tra / validate form ---
    {
      type: 'function' as const,
      function: {
        name: 'validate_form',
        description:
          'Kiểm tra thông tin người dùng đã điền và báo lỗi nếu có. Dùng khi người dùng hỏi "điền đúng chưa", "kiểm tra giúm", "hợp lệ không".',
        parameters: {
          type: 'object',
          properties: {
            validation_errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', description: 'ID của field lỗi' },
                  label: { type: 'string', description: 'Tên hiển thị của field' },
                  message: { type: 'string', description: 'Mô tả lỗi' },
                  severity: {
                    type: 'string',
                    enum: ['error', 'warning'],
                  },
                },
                required: ['field', 'label', 'message', 'severity'],
              },
              description: 'Danh sách lỗi validation (rỗng nếu không có lỗi).',
            },
            message: {
              type: 'string',
              description: 'Tổng kết kết quả kiểm tra.',
            },
            suggestions: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['validation_errors', 'message'],
        },
      },
    },

    // --- 6. Hiển thị thông tin dịch vụ ---
    {
      type: 'function' as const,
      function: {
        name: 'show_service_info',
        description:
          'Hiển thị thông tin chi tiết về một dịch vụ: giấy tờ cần, lệ phí, thời gian xử lý, quy trình từng bước. Dùng khi người dùng hỏi "cần gì", "bao nhiêu tiền", "mất bao lâu", "quy trình".',
        parameters: {
          type: 'object',
          properties: {
            service_id: {
              type: 'string',
              enum: ['khai-sinh', 'ho-khau', 'cccd', 'ket-hon'],
              description: 'ID của dịch vụ cần hiển thị thông tin.',
            },
            info_type: {
              type: 'string',
              enum: ['required_docs', 'fee_and_time', 'steps', 'general'],
              description:
                'Loại thông tin cần trả về: required_docs (giấy tờ), fee_and_time (phí & thời gian), steps (quy trình), general (tổng quát).',
            },
            message: {
              type: 'string',
              description: 'Nội dung câu trả lời chi tiết bằng tiếng Việt.',
            },
            suggestions: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['service_id', 'info_type', 'message'],
        },
      },
    },
  ];
};
