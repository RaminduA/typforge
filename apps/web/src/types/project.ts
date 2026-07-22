export type FileNodeType = "file" | "folder";

export interface FileNode {
  name: string;
  path: string;
  type: FileNodeType;
  size?: number;
  children?: FileNode[];
}

export interface Project {
  id: string;
  name: string;
  entryFile: string;
  createdAt: string;
  updatedAt: string;
}

export interface VersionSnapshot {
  id: string;
  message: string;
  createdAt: string;
}