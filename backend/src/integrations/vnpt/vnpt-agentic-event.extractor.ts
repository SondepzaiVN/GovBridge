import { asRecord } from './vnpt-response.js';
import type { KnowledgeReference } from '../../modules/assistant/knowledge.types.js';

export interface VnptTextFragment {
  text: string;
  identity: string | null;
}

export interface VnptReplyButton {
  title: string;
  type: string | null;
}

export interface VnptExtractedEvent {
  fragments: VnptTextFragment[];
  buttons: VnptReplyButton[];
  references: KnowledgeReference[];
  isFinalSnapshot: boolean;
}

const explicitId = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const DOCUMENT_NUMBER_PATTERN =
  /\b\d{1,4}\/\d{4}\/[A-ZĐ]{2,}\d*(?:-[A-ZĐ0-9]+)*\b/iu;

const referenceFromRecord = (rawReference: unknown): KnowledgeReference | null => {
  const reference = asRecord(rawReference);
  const title = typeof reference.title === 'string' ? reference.title.trim() : '';
  const urlValue = typeof reference.url === 'string'
    ? reference.url
    : typeof reference.uri === 'string'
      ? reference.uri
      : '';
  const url = urlValue.trim() || null;
  const documentNumber = typeof reference.documentNumber === 'string'
    ? reference.documentNumber.trim() || null
    : title.match(DOCUMENT_NUMBER_PATTERN)?.[0] ?? null;
  if (!title && !url && !documentNumber) return null;
  return {
    title: title || documentNumber || url || 'Nguồn tham khảo',
    url,
    documentNumber,
  };
};

const appendReferences = (target: KnowledgeReference[], rawReferences: unknown): void => {
  if (!Array.isArray(rawReferences)) return;
  for (const rawReference of rawReferences) {
    const reference = referenceFromRecord(rawReference);
    if (reference) target.push(reference);
  }
};

export const extractVnptAgenticEvent = (
  event: unknown,
  sseEventId: string | null,
): VnptExtractedEvent => {
  const object = asRecord(asRecord(event).object);
  const smartbot = asRecord(object.sb);
  const cards = Array.isArray(smartbot.card_data) ? smartbot.card_data : [];
  const fragments: VnptTextFragment[] = [];
  const buttons: VnptReplyButton[] = [];
  const references: KnowledgeReference[] = [];
  const cardDataInfo = asRecord(smartbot.card_data_info);
  const isFinalSnapshot = cardDataInfo.status === 2
    || cards.some((rawCard) => asRecord(rawCard).status === 2);
  const textId = explicitId(smartbot.text_id);

  appendReferences(references, smartbot.references);
  appendReferences(references, smartbot.citation);

  cards.forEach((rawCard, cardIndex) => {
    const card = asRecord(rawCard);
    appendReferences(references, card.references);
    if (typeof card.text === 'string' && card.text.trim()) {
      const cardId = explicitId(card.id);
      const isStreamDelta = Boolean(textId && !isFinalSnapshot && !cardId);
      fragments.push({
        text: isStreamDelta
          ? card.text.replace(/\r\n?/g, '\n')
          : card.text.replace(/\r\n?/g, '\n').trim(),
        identity: cardId
          ? `card:${cardId}`
          : textId
            ? `stream:${textId}:card:${cardIndex}`
            : sseEventId
              ? `event:${sseEventId}:card:${cardIndex}`
              : null,
      });
    }
    if (!Array.isArray(card.buttons)) return;
    for (const rawButton of card.buttons) {
      const button = asRecord(rawButton);
      if (typeof button.title !== 'string' || !button.title.trim()) continue;
      buttons.push({
        title: button.title,
        type: typeof button.type === 'string' ? button.type : null,
      });
    }
  });

  return { fragments, buttons, references, isFinalSnapshot };
};
