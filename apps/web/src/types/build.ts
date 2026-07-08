export interface Diagnostic {
  file?: string;
  line?: number;
  column?: number;
  severity: "error" | "warning" | string;
  message: string;
}

export interface CompileResult {
  ok: boolean;
  buildId: string;
  pdfUrl?: string;
  downloadUrl?: string;
  logsUrl: string;
  durationMs: number;
  diagnostics?: Diagnostic[];
}