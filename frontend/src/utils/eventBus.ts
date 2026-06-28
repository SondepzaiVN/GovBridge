// ============================================================
// Agent Event Bus — decouples AI service khỏi UI components
//
// Pattern: Event-Driven Architecture
// - agentService emit events sau khi parse tool_calls từ OpenAI
// - UI components (ChatbotContext, UIHighlighter...) subscribe listener
// - Không có dependency giữa AI layer và React layer
// ============================================================

import type { ValidationError } from '../types';

// ---- Event types ----
export type AgentEvent =
  | {
      type: 'CHAT';
      message: string;
      suggestions?: string[];
    }
  | {
      type: 'HIGHLIGHT_ELEMENT';
      elementId: string;
      elementLabel?: string;
      message: string;
      suggestions?: string[];
    }
  | {
      type: 'FILL_FORM';
      fields: Record<string, string>;
      message: string;
      suggestions?: string[];
    }
  | {
      type: 'NAVIGATE';
      route: string;
      serviceName: string;
      message: string;
      suggestions?: string[];
    }
  | {
      type: 'VALIDATE_FORM';
      validationErrors: ValidationError[];
      message: string;
      suggestions?: string[];
    }
  | {
      type: 'SHOW_SERVICE_INFO';
      serviceId: string;
      infoType: string;
      message: string;
      suggestions?: string[];
    }
  | {
      type: 'ERROR';
      message: string;
    };

type EventHandler = (event: AgentEvent) => void;

// ---- Event Bus class ----
class AgentEventBusClass {
  private handlers: Map<AgentEvent['type'] | '*', Set<EventHandler>> = new Map();

  /** Đăng ký lắng nghe một loại event cụ thể, hoặc '*' để nghe tất cả */
  on(eventType: AgentEvent['type'] | '*', handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  /** Hủy đăng ký listener */
  off(eventType: AgentEvent['type'] | '*', handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  /** Phát sự kiện — gọi tất cả listeners phù hợp */
  emit(event: AgentEvent): void {
    // Gọi handler đăng ký theo type cụ thể
    this.handlers.get(event.type)?.forEach(h => h(event));
    // Gọi wildcard handlers
    this.handlers.get('*')?.forEach(h => h(event));
  }
}

// Singleton — dùng chung toàn app
export const agentEventBus = new AgentEventBusClass();
