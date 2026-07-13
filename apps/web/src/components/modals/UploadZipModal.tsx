"use client";

import { useState } from "react";

interface UploadZipModalProps {
  onUpload: (file: File) => Promise<void>;
  onClose: () => void;
}

export function UploadZipModal({ onUpload, onClose }: UploadZipModalProps) {
  const [file, setFile] = useState<File>();
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!file) return;

    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="modal-backdrop app-blur-backdrop">
      <div className="modal">
        <div className="modal-header">
          <strong>Upload ZIP Project</strong>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="zip">ZIP file</label>
            <input
              id="zip"
              type="file"
              accept=".zip"
              onChange={(event) => setFile(event.target.files?.[0])}
            />
          </div>
          <p className="muted small">
            Allowed files include .typ, .bib, images, .pdf, .txt, .csv, .json, and .toml.
          </p>
        </div>

        <div className="modal-footer">
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}