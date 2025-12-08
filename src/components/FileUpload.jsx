// transfernet/frontend/src/components/FileUpload.jsx

import React, { useState, useRef } from 'react';
import { uploadFile, formatBytes, formatTimeRemaining } from '../services/api';
import ProgressBar from './ProgressBar';

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedChunks, setUploadedChunks] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    // Check file size (100GB limit)
    const MAX_SIZE = 100 * 1024 * 1024 * 1024; // 100GB
    if (selectedFile.size > MAX_SIZE) {
      setError('File size exceeds 100GB limit');
      return;
    }

    setFile(selectedFile);
    setError('');
    setDownloadUrl('');
  };

  const handleFileInputChange = (e) => {
    const selectedFile = e.target.files[0];
    handleFileSelect(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const selectedFile = e.dataTransfer.files[0];
    handleFileSelect(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError('');
    setProgress(0);

    try {
      const result = await uploadFile(file, (progressData) => {
        setProgress(progressData.progress);
        setUploadedChunks(progressData.uploadedChunks);
        setTotalChunks(progressData.totalChunks);
      });

      setDownloadUrl(result.downloadUrl);
      setExpiresAt(result.expiresAt);
      setUploading(false);
    } catch (err) {
      setError(err.message);
      setUploading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(downloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setFile(null);
    setDownloadUrl('');
    setProgress(0);
    setUploadedChunks(0);
    setTotalChunks(0);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="card">
      {!file && !downloadUrl && (
        <div
          className={`upload-area ${dragging ? 'dragging' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="upload-icon">📤</div>
          <div className="upload-text">Click to select or drag & drop</div>
          <div className="upload-subtext">Files up to 100GB supported</div>
          <input
            ref={fileInputRef}
            type="file"
            className="file-input"
            onChange={handleFileInputChange}
          />
        </div>
      )}

      {file && !downloadUrl && (
        <>
          <div className="selected-file">
            <div className="file-name">📄 {file.name}</div>
            <div className="file-size">{formatBytes(file.size)}</div>
          </div>

          {uploading && (
            <ProgressBar
              progress={progress}
              uploadedChunks={uploadedChunks}
              totalChunks={totalChunks}
              status="Uploading file..."
            />
          )}

          {error && <div className="error-message">{error}</div>}

          <button
            className="button"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <span className="loading"></span> Uploading...
              </>
            ) : (
              'Upload File'
            )}
          </button>

          {!uploading && (
            <button className="button button-secondary" onClick={handleReset}>
              Cancel
            </button>
          )}
        </>
      )}

      {downloadUrl && (
        <>
          <div className="success-message">✅ Upload complete!</div>

          <div className="link-container">
            <label className="link-label">Share this link:</label>
            <div className="link-box">
              <input
                type="text"
                value={downloadUrl}
                readOnly
                className="link-input"
              />
              <button
                className={`copy-button ${copied ? 'copied' : ''}`}
                onClick={handleCopyLink}
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="expiry-info">
            ⏰ Link expires in {formatTimeRemaining(expiresAt)}
          </div>

          <button className="button button-secondary" onClick={handleReset}>
            Upload Another File
          </button>
        </>
      )}
    </div>
  );
};

export default FileUpload;
