import { asRecord } from './vnpt-response.js';

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
}

const explicitId = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export const extractVnptAgenticEvent = (
  event: unknown,
  sseEventId: string | null,
): VnptExtractedEvent => {
  const object = asRecord(asRecord(event).object);
  const smartbot = asRecord(object.sb);
  const cards = Array.isArray(smartbot.card_data) ? smartbot.card_data : [];
  const fragments: VnptTextFragment[] = [];
  const buttons: VnptReplyButton[] = [];

  cards.forEach((rawCard, cardIndex) => {
    const card = asRecord(rawCard);
    if (typeof card.text === 'string' && card.text.trim()) {
      const cardId = explicitId(card.id);
      fragments.push({
        text: card.text.replace(/\r\n?/g, '\n').trim(),
        identity: cardId
          ? `card:${cardId}`
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

  return { fragments, buttons };
};
