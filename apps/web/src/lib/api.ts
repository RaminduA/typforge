import type { CompileResult } from "@/types/build";
import type { FileNode, Project, VersionSnapshot } from "@/types/project";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

type Envelope<T> = {
  data: T;
};

export class ApiRequestError extends Error {
  status: number;
  logs?: string;
  payload?: unknown;

  constructor(
    message: string,
    options: {
      status: number;
      logs?: string;
      payload?: unknown;
    }
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options.status;
    this.logs = options.logs;
    this.payload = options.payload;
  }
}

function diagnosticsToText(diagnostics: unknown): string | undefined {
  if (!Array.isArray(diagnostics)) {
    return undefined;
  }

  const lines = diagnostics
    .map((diagnostic) => {
      if (!diagnostic || typeof diagnostic !== "object") {
        return "";
      }

      const item = diagnostic as {
        severity?: unknown;
        message?: unknown;
      };

      const severity = typeof item.severity === "string" ? item.severity : "diagnostic";

      const message = typeof item.message === "string" ? item.message : "";

      return message ? `${severity}: ${message}` : "";
    })
    .filter(Boolean);

  return lines.length > 0 ? lines.join("\n") : undefined;
}

function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Request failed";
  }

  const value = payload as {
    error?: {
      message?: unknown;
    };
    message?: unknown;
  };

  if (typeof value.error?.message === "string") {
    return value.error.message;
  }

  if (typeof value.message === "string") {
    return value.message;
  }

  return "Request failed";
}

function extractErrorLogs(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const value = payload as {
    logs?: unknown;
    diagnostics?: unknown;
    data?: {
      logs?: unknown;
      diagnostics?: unknown;
    };
    error?: {
      logs?: unknown;
      diagnostics?: unknown;
    };
  };

  if (typeof value.logs === "string") {
    return value.logs;
  }

  if (typeof value.data?.logs === "string") {
    return value.data.logs;
  }

  if (typeof value.error?.logs === "string") {
    return value.error.logs;
  }

  return (
    diagnosticsToText(value.diagnostics) ??
    diagnosticsToText(value.data?.diagnostics) ??
    diagnosticsToText(value.error?.diagnostics)
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {})
    }
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const errorPayload = await response.json();

      throw new ApiRequestError(extractErrorMessage(errorPayload), {
        status: response.status,
        logs: extractErrorLogs(errorPayload),
        payload: errorPayload
      });
    }

    const text = await response.text();

    throw new ApiRequestError(text || "Request failed", {
      status: response.status,
      logs: text || undefined
    });
  }

  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  const payload = (await response.json()) as Envelope<T>;
  return payload.data;
}

export const api = {
  baseUrl: API_BASE_URL,

  createProject(name?: string) {
    return request<Project>("/projects/", {
      method: "POST",
      body: JSON.stringify({ name: name ?? "Untitled Project" })
    });
  },

  listProjects() {
    return request<Project[]>("/projects/");
  },

  getProject(projectId: string) {
    return request<Project>(`/projects/${projectId}/`);
  },

  getTree(projectId: string) {
    return request<FileNode>(`/projects/${projectId}/tree`);
  },

  getFile(projectId: string, path: string) {
    return request<{ path: string; content: string }>(
      `/projects/${projectId}/files?path=${encodeURIComponent(path)}`
    );
  },

  updateFile(projectId: string, path: string, content: string) {
    return request<{ path: string }>(
      `/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
      { method: "PUT", body: JSON.stringify({ content }) }
    );
  },

  createFile(projectId: string, path: string, content = "") {
    return request<{ path: string }>(
      `/projects/${projectId}/files`,
      { method: "POST", body: JSON.stringify({ path, content }) }
    );
  },

  createFolder(projectId: string, path: string) {
    return request<{ path: string }>(
      `/projects/${projectId}/folders`,
      { method: "POST", body: JSON.stringify({ path }) }
    );
  },

  uploadZip(projectId: string, file: File) {
    const form = new FormData();
    form.append("file", file);

    return request<{ files: string[] }>(
      `/projects/${projectId}/upload-zip`, 
      { method: "POST", body: form }
    );
  },

  async compile(projectId: string, entry = "main.typ"): Promise<CompileResult> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/compile`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ entry }),
      cache: "no-store"
    });

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      const text = await response.text();

      throw new ApiRequestError(
        text || "Compile request failed", 
        {status: response.status, logs: text || undefined}
      );
    }

    const payload = (await response.json()) as {
      data?: CompileResult;
      error?: {
        message?: string;
        logs?: string;
      };
      message?: string;
    };

    if (payload.data?.buildId) {
      return payload.data;
    }

    if (!response.ok) {
      throw new ApiRequestError(
        payload.error?.message || payload.message || "Compile request failed",
        {status: response.status, logs: payload.error?.logs, payload}
      );
    }

    throw new ApiRequestError(
      "Compile response did not include build data", 
      {status: response.status, payload}
    );
  },

  async getLogs(buildId: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/builds/${buildId}/logs`, {cache: "no-store"});

    if (!response.ok) {
      const text = await response.text();

      throw new ApiRequestError(
        text || "Unable to fetch compiler logs", 
        {status: response.status, logs: text || undefined}
      );
    }

    const payload = (await response.json()) as {
      data?: {
        buildId?: string;
        logs?: string;
      };
    };

    return payload.data?.logs ?? "";
  },

  listVersions(projectId: string) {
    return request<VersionSnapshot[]>(`/projects/${projectId}/versions`);
  },

  createVersion(projectId: string, message: string) {
    return request<VersionSnapshot>(
      `/projects/${projectId}/versions`, 
      { method: "POST", body: JSON.stringify({ message }) }
    );
  },

  restoreVersion(projectId: string, versionId: string) {
    return request<{ status: string }>(
      `/projects/${projectId}/versions/${versionId}/restore`,
      { method: "POST" }
    );
  },

  absoluteUrl(path?: string) {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return `${API_BASE_URL}${path.replace(/^\/api\/v1/, "")}`;
  },

  updateProject(projectId: string, name: string) {
    return request<Project>(
      `/projects/${projectId}/`,
      { method: "PATCH", body: JSON.stringify({ name }) }
    );
  },

  deleteProject(projectId: string) {
    return request<void>(
      `/projects/${projectId}/`,
      { method: "DELETE" }
    );
  },

  duplicateProject(projectId: string) {
    return request<Project>(
      `/projects/${projectId}/duplicate`,
      { method: "POST" }
    );
  },

  renameEntry(projectId: string, path: string, newName: string) {
    return request<{ path: string }>(
      `/projects/${projectId}/entries/rename`,
      { method: "PATCH", body: JSON.stringify({ path, newName }) }
    );
  },

  deleteFile(projectId: string, path: string) {
    return request<void>(
      `/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
      { method: "DELETE" }
    );
  },

  deleteFolder(projectId: string, path: string) {
    return request<void>(
      `/projects/${projectId}/folders?path=${encodeURIComponent(path)}`,
      { method: "DELETE" }
    );
  },

  uploadEntries(projectId: string, entries: Array<{
    file: File;
    path: string;
  }>) {
    const form = new FormData();

    for (const entry of entries) {
      form.append("files", entry.file);
      form.append("paths", entry.path);
    }

    return request<{
      paths: string[];
    }>(
      `/projects/${projectId}/uploads`,
      { method: "POST", body: form }
    );
  },

  fileDownloadUrl(projectId: string, path: string) {
    return `${API_BASE_URL}/projects/${projectId}/files/download?path=${encodeURIComponent(path)}`;
  },

  projectExportUrl(projectId: string) {
    return `${API_BASE_URL}/projects/${projectId}/export`;
  },
};