import type {
  VnptReplyButton,
  VnptTextFragment,
} from './vnpt-agentic-event.extractor.js';

const MAX_ANSWER_LENGTH = 100_000;
const MAX_QUICK_REPLIES = 8;
const MAX_QUICK_REPLY_LENGTH = 120;

export class VnptContentLimitError extends Error {
  constructor() {
    super('VNPT knowledge content exceeded its safety limit.');
    this.name = 'VnptContentLimitError';
  }
}

interface OrderedSegment {
  text: string;
  identity: string | null;
}

export class VnptOrderedContentAccumulator {
  private segments: OrderedSegment[] = [];
  private quickReplies: string[] = [];
  private quickReplyKeys = new Set<string>();

  addFragments(fragments: VnptTextFragment[]): void {
    for (const fragment of fragments) this.addFragment(fragment);
  }

  addButtons(buttons: VnptReplyButton[]): void {
    for (const button of buttons) {
      if (button.type === 'phone_number' || button.type === 'web_url') continue;
      const title = button.title.trim().replace(/\s+/g, ' ');
      if (
        !title
        || title.length > MAX_QUICK_REPLY_LENGTH
        || this.quickReplyKeys.has(title)
        || this.quickReplies.length >= MAX_QUICK_REPLIES
      ) {
        continue;
      }
      this.quickReplyKeys.add(title);
      this.quickReplies.push(title);
    }
  }

  answer(): string {
    return this.segments.map(({ text }) => text).join('\n\n');
  }

  replies(): string[] {
    return [...this.quickReplies];
  }

  private addFragment(fragment: VnptTextFragment): void {
    const text = fragment.text;
    if (!text) return;

    if (fragment.identity) {
      const existingIndex = this.segments.findIndex(
        ({ identity }) => identity === fragment.identity,
      );
      if (existingIndex >= 0) {
        const existing = this.segments[existingIndex];
        if (existing && existing.text !== text) {
          this.segments[existingIndex] = { text, identity: fragment.identity };
          this.assertAnswerLimit();
        }
        return;
      }
    }

    const accumulated = this.answer();
    if (accumulated && text.length > accumulated.length && text.startsWith(accumulated)) {
      this.segments = [{ text, identity: fragment.identity }];
      this.assertAnswerLimit();
      return;
    }

    const last = this.segments.at(-1);
    if (last && text !== last.text) {
      if (text.length > last.text.length && text.startsWith(last.text)) {
        this.segments[this.segments.length - 1] = {
          text,
          identity: fragment.identity ?? last.identity,
        };
        this.assertAnswerLimit();
        return;
      }
      if (last.text.length > text.length && last.text.startsWith(text)) return;
    }

    this.segments.push({ text, identity: fragment.identity });
    this.assertAnswerLimit();
  }

  private assertAnswerLimit(): void {
    if (this.answer().length > MAX_ANSWER_LENGTH) {
      throw new VnptContentLimitError();
    }
  }
}
