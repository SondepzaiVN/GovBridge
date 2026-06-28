import { VNPT_CONFIG, IS_MOCK_MODE } from "../config/vnpt";

// ============================================================
// VNPT SmartVoice — STT (Realtime WebSocket) + TTS
// ============================================================

export type STTCallback = (transcript: string, isFinal: boolean) => void;
export type TTSCallback = (isPlaying: boolean) => void;

// ============================================================
// Speech-to-Text Service (Realtime via WebSocket)
// ============================================================
export class STTService {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;

  private isActive = false;

  // Web Speech API fallback (Chrome native)
  private recognition: any | null = null;

  async startListening(onTranscript: STTCallback): Promise<void> {
    this.isActive = true;

    if (IS_MOCK_MODE || !VNPT_CONFIG.voice.apiKey) {
      // Use Web Speech API as fallback
      this.startWebSpeechAPI(onTranscript);
    } else {
      await this.startVNPTSTT(onTranscript);
    }
  }

  stopListening(): void {
    this.isActive = false;

    // Stop Web Speech API
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }

    // Stop WebSocket STT
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.ws = null;

    // Stop MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;

    // Stop microphone stream
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  // ---- Web Speech API (Fallback) ----
  private startWebSpeechAPI(onTranscript: STTCallback): void {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onTranscript(
        "Trình duyệt không hỗ trợ nhận giọng nói. Vui lòng dùng Chrome.",
        true,
      );
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = "vi-VN";
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (final) {
        onTranscript(final.trim(), true);
      } else if (interim) {
        onTranscript(interim.trim(), false);
      }
    };

    this.recognition.onerror = (e: any) => {
      console.error("Speech recognition error:", e.error);
      if (e.error === "not-allowed") {
        onTranscript("Vui lòng cấp quyền truy cập microphone.", true);
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if still active
      if (this.isActive && this.recognition) {
        try {
          this.recognition.start();
        } catch {
          /* ignore */
        }
      }
    };

    this.recognition.start();
  }

  // ---- VNPT SmartVoice STT via WebSocket ----
  private async startVNPTSTT(onTranscript: STTCallback): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: VNPT_CONFIG.voice.sttSampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Connect WebSocket
      const wsUrl = `${VNPT_CONFIG.voice.sttUrl}?api_key=${VNPT_CONFIG.voice.apiKey}&language=vi-VN`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Start sending audio chunks
        this.mediaRecorder = new MediaRecorder(this.stream!, {
          mimeType: "audio/webm;codecs=opus",
          audioBitsPerSecond: 16000,
        });

        this.mediaRecorder.ondataavailable = (e) => {
          if (this.ws?.readyState === WebSocket.OPEN && e.data.size > 0) {
            this.ws.send(e.data);
          }
        };

        this.mediaRecorder.start(100); // Send chunks every 100ms for realtime
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const transcript = data.transcript || data.text || "";
          const isFinal = data.is_final ?? true;
          if (transcript) onTranscript(transcript, isFinal);
        } catch {
          /* ignore */
        }
      };

      this.ws.onerror = () => {
        console.warn(
          "VNPT STT WebSocket failed, falling back to Web Speech API",
        );
        this.startWebSpeechAPI(onTranscript);
      };
    } catch (err) {
      console.error("STT start error:", err);
      this.startWebSpeechAPI(onTranscript);
    }
  }
}

// ============================================================
// Text-to-Speech Service
// ============================================================
export class TTSService {
  private audio: HTMLAudioElement | null = null;
  private synthesis = window.speechSynthesis;

  async speak(text: string, onStatusChange?: TTSCallback): Promise<void> {
    // Stop any current speech
    this.stop();

    onStatusChange?.(true);

    if (IS_MOCK_MODE) {
      await this.webSpeechTTS(text);
    } else {
      try {
        await this.vnptTTS(text);
      } catch {
        await this.webSpeechTTS(text);
      }
    }

    onStatusChange?.(false);
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    if (this.synthesis.speaking) {
      this.synthesis.cancel();
    }
  }

  // ---- VNPT SmartVoice TTS ----
  private async vnptTTS(text: string): Promise<void> {
    let rawUrl = VNPT_CONFIG.voice.ttsUrl;
    
    // Step 3: Bypassing CORS
    let finalUrl = rawUrl;
    if (rawUrl.startsWith('https://api.idg.vnpt.vn')) {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalhost) {
        // Môi trường Dev (Localhost): Dùng Vite Proxy
        finalUrl = rawUrl.replace('https://api.idg.vnpt.vn', '/tts-api');
      } else {
        // Môi trường Production (Vercel): Dùng Vercel Serverless Function để xóa Origin header
        finalUrl = '/api/tts';
      }
    }

    const res = await fetch(finalUrl, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        speed: String(VNPT_CONFIG.voice.ttsSpeed),
        region: VNPT_CONFIG.voice.ttsVoice,
        domain: 'general'
      }),
    });

    if (!res.ok) {
      let errMessage = `TTS API failed with status ${res.status}`;
      try {
        const errData = await res.json();
        if (errData.error || errData.message) {
          errMessage = `${res.status} - ${errData.error || ''} ${errData.message || ''}`;
        }
      } catch(e) {}
      throw new Error(errMessage);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      throw new Error(`TTS API returned invalid content type HTML.`);
    }

    // The v2/grpc API returns a JSON response containing the audio link
    const data = await res.json();

    let audioUrl = "";
    
    // Step 4: Extract audio_link reliably based on multiple known VNPT response formats
    if (data.object && data.object.playlist && data.object.playlist.length > 0) {
      audioUrl = data.object.playlist[0].audio_link;
    } else if (data.audio_link) {
      audioUrl = data.audio_link;
    } else if (data.code === 'success' && data.data) {
      audioUrl = data.data.audio_link || data.data;
    } else {
      throw new Error(data.message || 'Không tìm thấy audio_link trong response.');
    }

    return new Promise((resolve, reject) => {
      this.audio = new Audio(audioUrl);
      this.audio.onended = () => {
        resolve();
      };
      this.audio.onerror = (e) => {
        console.error("Audio playback error", e);
        reject(new Error("Failed to play VNPT TTS audio"));
      };
      this.audio.play().catch(reject);
    });
  }

  // ---- Web Speech Synthesis (Fallback) ----
  private webSpeechTTS(text: string): Promise<void> {
    return new Promise((resolve) => {
      // Remove markdown for TTS
      const plainText = text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/#{1,6}\s/g, "")
        .replace(/[•\-]\s/g, "")
        .replace(/\n+/g, " ")
        .trim();

      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.lang = "vi-VN";
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Function to speak once voices are ready
      const speakWithVoice = () => {
        const voices = this.synthesis.getVoices();
        const viVoice = voices.find((v) => v.lang.startsWith("vi"));
        if (viVoice) utterance.voice = viVoice;

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        this.synthesis.speak(utterance);
      };

      if (this.synthesis.getVoices().length > 0) {
        speakWithVoice();
      } else {
        // Wait for voices to load (especially on Chrome)
        this.synthesis.onvoiceschanged = () => {
          this.synthesis.onvoiceschanged = null;
          speakWithVoice();
        };
      }
    });
  }
}

export const sttService = new STTService();
export const ttsService = new TTSService();
