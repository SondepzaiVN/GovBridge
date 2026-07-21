import {
  decodeSseStream,
  type SseDecodeSummary,
} from './sse-decoder.js';
import {
  VnptOrderedContentAccumulator,
} from './vnpt-agentic-content.accumulator.js';
import { extractVnptAgenticEvent } from './vnpt-agentic-event.extractor.js';
import type { KnowledgeReference } from '../../modules/assistant/knowledge.types.js';

export interface VnptKnowledgeStreamOutput {
  answer: string;
  quickReplies: string[];
  validEventCount: number;
  invalidEventCount: number;
  doneReceived: boolean;
  totalBytes: number;
  references: KnowledgeReference[];
}

export const parseVnptKnowledgeStream = async (
  body: ReadableStream<Uint8Array>,
): Promise<VnptKnowledgeStreamOutput> => {
  const accumulator = new VnptOrderedContentAccumulator();
  let validEventCount = 0;
  let invalidEventCount = 0;
  const references: KnowledgeReference[] = [];
  const referenceKeys = new Set<string>();

  const addReferences = (items: KnowledgeReference[]): void => {
    for (const reference of items) {
      const key = `${reference.title}\n${reference.url ?? ''}\n${reference.documentNumber ?? ''}`;
      if (referenceKeys.has(key)) continue;
      referenceKeys.add(key);
      references.push(reference);
      if (references.length >= 20) break;
    }
  };

  const summary: SseDecodeSummary = await decodeSseStream(body, (sseEvent) => {
    if (!sseEvent.data.trim()) return;
    let event: unknown;
    try {
      event = JSON.parse(sseEvent.data) as unknown;
    } catch {
      invalidEventCount += 1;
      return;
    }
    validEventCount += 1;
    const extracted = extractVnptAgenticEvent(event, sseEvent.id);
    if (extracted.isFinalSnapshot) {
      accumulator.replaceWithSnapshot(extracted.fragments);
    } else {
      accumulator.addFragments(extracted.fragments);
    }
    accumulator.addButtons(extracted.buttons);
    addReferences(extracted.references);
  });

  return {
    answer: accumulator.answer(),
    quickReplies: accumulator.replies(),
    validEventCount,
    invalidEventCount,
    doneReceived: summary.doneReceived,
    totalBytes: summary.totalBytes,
    references,
  };
};
