import type { CompileResult } from "@/types/build";
import type { FileNode, Project, VersionSnapshot } from "@/types/project";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

type Envelope<T> = {
  data: T;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {})
    }
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const errorPayload = await response.json();
      throw new Error(errorPayload?.error?.message ?? "Request failed");
    }

    throw new Error(await response.text());
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
      {
        method: "PUT",
        body: JSON.stringify({ content })
      }
    );
  },

  createFile(projectId: string, path: string, content = "") {
    return request<{ path: string }>(`/projects/${projectId}/files`, {
      method: "POST",
      body: JSON.stringify({ path, content })
    });
  },

  createFolder(projectId: string, path: string) {
    return request<{ path: string }>(`/projects/${projectId}/folders`, {
      method: "POST",
      body: JSON.stringify({ path })
    });
  },

  uploadZip(projectId: string, file: File) {
    const form = new FormData();
    form.append("file", file);

    return request<{ files: string[] }>(`/projects/${projectId}/upload-zip`, {
      method: "POST",
      body: form
    });
  },

  compile(projectId: string, entry = "main.typ") {
    return request<CompileResult>(`/projects/${projectId}/compile`, {
      method: "POST",
      body: JSON.stringify({ entry })
    });
  },

  getLogs(buildId: string) {
    return request<{ buildId: string; logs: string }>(`/builds/${buildId}/logs`);
  },

  listVersions(projectId: string) {
    return request<VersionSnapshot[]>(`/projects/${projectId}/versions`);
  },

  createVersion(projectId: string, message: string) {
    return request<VersionSnapshot>(`/projects/${projectId}/versions`, {
      method: "POST",
      body: JSON.stringify({ message })
    });
  },

  restoreVersion(projectId: string, versionId: string) {
    return request<{ status: string }>(
      `/projects/${projectId}/versions/${versionId}/restore`,
      {
        method: "POST"
      }
    );
  },

  absoluteUrl(path?: string) {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return `${API_BASE_URL}${path.replace(/^\/api\/v1/, "")}`;
  },

  updateProject(
    projectId: string,
    name: string
  ) {
    return request<Project>(
      `/projects/${projectId}/`,
      {
        method: "PATCH",
        body: JSON.stringify({ name })
      }
    );
  },

  deleteProject(
    projectId: string
  ) {
    return request<void>(
      `/projects/${projectId}/`,
      {
        method: "DELETE"
      }
    );
  },

  duplicateProject(
    projectId: string
  ) {
    return request<Project>(
      `/projects/${projectId}/duplicate`,
      {
        method: "POST"
      }
    );
  },

  renameEntry(
    projectId: string,
    path: string,
    newName: string
  ) {
    return request<{ path: string }>(
      `/projects/${projectId}/entries/rename`,
      {
        method: "PATCH",
        body: JSON.stringify({
          path,
          newName
        })
      }
    );
  },

  deleteFile(
    projectId: string,
    path: string
  ) {
    return request<void>(
      `/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
      {
        method: "DELETE"
      }
    );
  },

  deleteFolder(
    projectId: string,
    path: string
  ) {
    return request<void>(
      `/projects/${projectId}/folders?path=${encodeURIComponent(path)}`,
      {
        method: "DELETE"
      }
    );
  },

  uploadEntries(
    projectId: string,
    entries: Array<{
      file: File;
      path: string;
    }>
  ) {
    const form = new FormData();

    for (const entry of entries) {
      form.append(
        "files",
        entry.file
      );

      form.append(
        "paths",
        entry.path
      );
    }

    return request<{
      paths: string[];
    }>(
      `/projects/${projectId}/uploads`,
      {
        method: "POST",
        body: form
      }
    );
  },

  fileDownloadUrl(
    projectId: string,
    path: string
  ) {
    return `${API_BASE_URL}/projects/${projectId}/files/download?path=${encodeURIComponent(path)}`;
  },

  projectExportUrl(
    projectId: string
  ) {
    return `${API_BASE_URL}/projects/${projectId}/export`;
  },
};