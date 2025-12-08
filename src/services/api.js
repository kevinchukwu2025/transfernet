// transfernet/frontend/src/services/api.js

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadFile = async (file, onProgress) => {
  const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  try {
    // Step 1: Initialize upload
    const initResponse = await api.post('/api/upload/init', {
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
    });

    const { fileId } = initResponse.data;

    // Step 2: Upload chunks in parallel (3 at a time for optimal speed)
    const uploadPromises = [];
    const maxParallel = 3;

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const uploadChunk = async () => {
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('fileId', fileId);
        formData.append('chunkIndex', i);
        formData.append('totalChunks', totalChunks);
        formData.append('fileName', file.name);
        formData.append('fileSize', file.size);

        const response = await api.post('/api/upload/chunk', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        // Update progress
        if (onProgress) {
          const progress = ((i + 1) / totalChunks) * 100;
          onProgress({
            progress,
            uploadedChunks: i + 1,
            totalChunks,
          });
        }

        return response.data;
      };

      uploadPromises.push(uploadChunk());

      // Wait if we've reached max parallel uploads
      if (uploadPromises.length >= maxParallel) {
        await Promise.race(uploadPromises);
        uploadPromises.splice(
          uploadPromises.findIndex((p) => p !== undefined),
          1
        );
      }
    }

    // Wait for all remaining chunks
    await Promise.all(uploadPromises);

    // Step 3: Complete upload and get download link
    const completeResponse = await api.post('/api/upload/complete', {
      fileId,
    });

    return {
      success: true,
      fileId,
      downloadUrl: `${window.location.origin}/download/${fileId}`,
      ...completeResponse.data,
    };
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error(error.response?.data?.error || 'Upload failed');
  }
};

export const getFileInfo = async (fileId) => {
  try {
    const response = await api.get(`/api/download/info/${fileId}`);
    return response.data;
  } catch (error) {
    console.error('Get file info error:', error);
    throw new Error(error.response?.data?.error || 'Failed to get file info');
  }
};

export const downloadFile = async (fileId, fileName, onProgress) => {
  try {
    // Get file info first
    const fileInfo = await getFileInfo(fileId);
    const totalChunks = fileInfo.totalChunks;

    // Download all chunks
    const chunks = [];
    
    for (let i = 0; i < totalChunks; i++) {
      const response = await api.get(`/api/download/${fileId}/chunk/${i}`, {
        responseType: 'blob',
      });

      chunks.push(response.data);

      // Update progress
      if (onProgress) {
        const progress = ((i + 1) / totalChunks) * 100;
        onProgress({
          progress,
          downloadedChunks: i + 1,
          totalChunks,
        });
      }
    }

    // Combine chunks into one blob
    const blob = new Blob(chunks, { type: 'application/octet-stream' });

    // Trigger download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error('Download error:', error);
    throw new Error(error.response?.data?.error || 'Download failed');
  }
};

export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const formatTimeRemaining = (expiresAt) => {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry - now;

  if (diff <= 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m remaining`;
};

export default api;
