// Hand-written type contract for the vendored piper-tts-web.js (a real
// npm build, untouched apart from one import specifier — see
// js/vendor/THIRD_PARTY_NOTICES.md — so it stays plain JS rather than
// being rewritten as TypeScript; see tsconfig.json for why sidecar
// *.d.ts files exist at all in this codebase). Only the surface
// piper-voice.ts actually calls is declared.
export interface TtsSessionOptions {
  voiceId: string;
  progress?: (event: { url: string; loaded: number; total: number }) => void;
  logger?: (text: string) => void;
  wasmPaths?: {
    onnxWasm: string;
    piperData: string;
    piperWasm: string;
  };
}

export class TtsSession {
  static create(options: TtsSessionOptions): Promise<TtsSession>;
  predict(text: string): Promise<Blob>;
}
