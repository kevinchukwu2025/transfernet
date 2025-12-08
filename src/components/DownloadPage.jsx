// transfernet/frontend/src/components/DownloadPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getFileInfo,
  downloadFile,
  formatBytes,
  formatTimeRemaining,
} from '../services/api';
import ProgressBar from './ProgressBar';

const DownloadPage = () => {
  const { fileId } = useParams();
  const [fileInfo, setFileInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadedChunks, setDownloadedChunks] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFileInfo();
  }, [fileId]);

  const loadFileInfo = async () => {
    try {
      const info = await getFileInfo(fileId);
      setFileInfo(info);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!fileInfo) return;

    setDownloading(true);
    setError('');
    setProgress(0);

    try {
      await downloadFile(fileId, fileInfo.fileName, (progressData) => {
        setProgress(progressData.progress);
        setDownloadedChunks(progressData.downloadedChunks);
        setTotalChunks(progressData.totalChunks);
      });

      setDownloading(false);
    } catch (err) {
      setError(err.message);
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="card download-page">
        <div className="loading"></div>
        <p style={{ marginTop: '1rem' }}>Loading file information...</p>
      </div>
    );
  }

  if (error && !fileInfo) {
    return (
      <div className="card download-page">
        <div className="error-message">{error}</div>
        <button
          className="button button-secondary"
          onClick={() => (window.location.href = '/')}
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="card download-page">
      <div className="download-icon">📥</div>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
        File Ready for Download
      </h2>

      {fileInfo && (
        <div className="download-info">
          <div className="info-item">
            <span className="info-label">File Name:</span>
            <span className="info-value">{fileInfo.fileName}</span>
          </div>
          <div className="info-item">
            <span className="info-label">File Size:</span>
            <span className="info-value">{formatBytes(fileInfo.fileSize)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Expires:</span>
            <span className="info-value">
              {formatTimeRemaining(fileInfo.expiresAt)}
            </span>
          </div>
        </div>
      )}

      {downloading && (
        <ProgressBar
          progress={progress}
          uploadedChunks={downloadedChunks}
          totalChunks={totalChunks}
          status="Downloading file..."
        />
      )}

      {error && <div className="error-message">{error}</div>}

      <button
        className="button"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? (
          <>
            <span className="loading"></span> Downloading...
          </>
        ) : (
          'Download File'
        )}
      </button>

      <button
        className="button button-secondary"
        onClick={() => (window.location.href = '/')}
        disabled={downloading}
      >
        Upload Your Own File
      </button>
    </div>
  );
};

export default DownloadPage;
