export interface SseEvent {
  data: string;
  id: string | null;
}

export interface SseDecoderLimits {
  maxTotalBytes: number;
  maxEvents: number;
  maxEventCharacters: number;
}

export interface SseDecodeSummary {
  eventCount: number;
  totalBytes: number;
  doneReceived: boolean;
}

export type SseDecoderErrorKind =
  | 'LIMIT_EXCEEDED'
  | 'READ_TIMEOUT'
  | 'READ_FAILED';

export class SseDecoderError extends Error {
  constructor(public readonly kind: SseDecoderErrorKind) {
    super('SSE stream could not be decoded safely.');
    this.name = 'SseDecoderError';
  }
}

const DEFAULT_LIMITS: SseDecoderLimits = {
  maxTotalBytes: 2 * 1024 * 1024,
  maxEvents: 1_000,
  maxEventCharacters: 256 * 1024,
};

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error
  && (error.name === 'TimeoutError' || error.name === 'AbortError');

export const decodeSseStream = async (
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SseEvent) => void,
  limits: SseDecoderLimits = DEFAULT_LIMITS,
): Promise<SseDecodeSummary> => {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let dataLines: string[] = [];
  let eventId: string | null = null;
  let eventCharacters = 0;
  let eventCount = 0;
  let totalBytes = 0;
  let doneReceived = false;
  let streamFinished = false;

  const dispatchEvent = (): void => {
    if (dataLines.length === 0) {
      eventId = null;
      eventCharacters = 0;
      return;
    }
    if (eventCount >= limits.maxEvents) {
      throw new SseDecoderError('LIMIT_EXCEEDED');
    }
    const data = dataLines.join('\n');
    dataLines = [];
    eventCharacters = 0;
    eventCount += 1;
    if (data.trim() === '[DONE]') {
      doneReceived = true;
      eventId = null;
      return;
    }
    onEvent({ data, id: eventId });
    eventId = null;
  };

  const consumeLine = (rawLine: string): void => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '') {
      dispatchEvent();
      return;
    }
    if (line.startsWith(':')) return;

    const colonIndex = line.indexOf(':');
    const field = colonIndex < 0 ? line : line.slice(0, colonIndex);
    let value = colonIndex < 0 ? '' : line.slice(colonIndex + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'data') {
      eventCharacters += value.length + 1;
      if (eventCharacters > limits.maxEventCharacters) {
        throw new SseDecoderError('LIMIT_EXCEEDED');
      }
      dataLines.push(value);
    } else if (field === 'id' && !value.includes('\0')) {
      eventId = value;
    }
  };

  const consumeBufferedLines = (): void => {
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex >= 0) {
      consumeLine(buffer.slice(0, newlineIndex));
      buffer = buffer.slice(newlineIndex + 1);
      if (doneReceived) return;
      newlineIndex = buffer.indexOf('\n');
    }
    if (buffer.length > limits.maxEventCharacters) {
      throw new SseDecoderError('LIMIT_EXCEEDED');
    }
  };

  try {
    while (!doneReceived) {
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await reader.read();
      } catch (error) {
        throw new SseDecoderError(
          isTimeoutError(error) ? 'READ_TIMEOUT' : 'READ_FAILED',
        );
      }
      if (readResult.done) {
        streamFinished = true;
        break;
      }
      totalBytes += readResult.value.byteLength;
      if (totalBytes > limits.maxTotalBytes) {
        throw new SseDecoderError('LIMIT_EXCEEDED');
      }
      buffer += decoder.decode(readResult.value, { stream: true });
      consumeBufferedLines();
    }

    if (!doneReceived) {
      buffer += decoder.decode();
      consumeBufferedLines();
      if (buffer) consumeLine(buffer);
      dispatchEvent();
    }

    return { eventCount, totalBytes, doneReceived };
  } finally {
    if (!streamFinished) {
      try {
        await reader.cancel();
      } catch {
        // Reader cancellation is best-effort; the original parser error is preserved.
      }
    }
    reader.releaseLock();
  }
};
