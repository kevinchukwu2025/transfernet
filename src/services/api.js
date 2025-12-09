// transfernet/frontend/src/services/api.js

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

export const uploadFile = async (file, onProgress) => {
  // Use larger chunks now since we're uploading directly to R2 (no Vercel limit!)
  const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  try {
    // Step 1: Initialize upload and get presigned URLs
    const initResponse = await api.post('/api/upload/init', {
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
    });

    const { fileId, presignedUrls } = initResponse.data;

    // Step 2: Upload chunks directly to R2 using presigned URLs
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const presignedUrl = presignedUrls[i].url;

      try {
        // Upload directly to R2 using presigned URL (bypasses our backend!)
        await axios.put(presignedUrl, chunk, {
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          timeout: 120000, // 2 minutes per chunk
          onUploadProgress: (progressEvent) => {
            // Calculate overall progress
            const chunkProgress = progressEvent.loaded / progressEvent.total;
            const overallProgress = ((i + chunkProgress) / totalChunks) * 100;
            
            if (onProgress) {
              onProgress({
                progress: overallProgress,
                uploadedChunks: i,
                totalChunks,
              });
            }
          },
        });

        // Notify backend that chunk was uploaded
        await api.post('/api/upload/chunk-complete', {
          fileId,
          chunkIndex: i,
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
      } catch (chunkError) {
        console.error(`Failed to upload chunk ${i}:`, chunkError);
        
        // Retry once
        console.log(`Retrying chunk ${i}...`);
        try {
          await axios.put(presignedUrl, chunk, {
            headers: {
              'Content-Type': 'application/octet-stream',
            },
            timeout: 120000,
          });

          await api.post('/api/upload/chunk-complete', {
            fileId,
            chunkIndex: i,
          });

          if (onProgress) {
            const progress = ((i + 1) / totalChunks) * 100;
            onProgress({
              progress,
              uploadedChunks: i + 1,
              totalChunks,
            });
          }
        } catch (retryError) {
          throw new Error(`Failed to upload chunk ${i + 1} of ${totalChunks}. Please try again.`);
        }
      }
    }

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
    
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error || error.message;
      
      if (status === 413) {
        throw new Error('File chunk too large. Please contact support.');
      } else if (status === 403) {
        throw new Error('Upload forbidden. Please check your connection.');
      } else if (status === 500) {
        throw new Error('Server error. Please try again later.');
      } else {
        throw new Error(message);
      }
    } else if (error.request) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error(error.message || 'Upload failed. Please try again.');
    }
  }
};

export const getFileInfo = async (fileId) => {
  try {
    const response = await api.get(`/api/download/info/${fileId}`);
    return response.data;
  } catch (error) {
    console.error('Get file info error:', error);
    
    if (error.response?.status === 404) {
      throw new Error('File not found or has expired');
    } else if (error.response?.status === 410) {
      throw new Error('File has expired');
    } else {
      throw new Error(error.response?.data?.error || 'Failed to get file info');
    }
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
      try {
        const response = await api.get(`/api/download/${fileId}/chunk/${i}`, {
          responseType: 'blob',
          timeout: 120000,
        });

        chunks.push(response.data);

        if (onProgress) {
          const progress = ((i + 1) / totalChunks) * 100;
          onProgress({
            progress,
            downloadedChunks: i + 1,
            totalChunks,
          });
        }
      } catch (chunkError) {
        console.error(`Failed to download chunk ${i}:`, chunkError);
        
        // Retry once
        console.log(`Retrying chunk ${i} download...`);
        const response = await api.get(`/api/download/${fileId}/chunk/${i}`, {
          responseType: 'blob',
          timeout: 120000,
        });

        chunks.push(response.data);

        if (onProgress) {
          const progress = ((i + 1) / totalChunks) * 100;
          onProgress({
            progress,
            downloadedChunks: i + 1,
            totalChunks,
          });
        }
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
    
    if (error.message.includes('expired')) {
      throw new Error('File has expired');
    } else if (error.message.includes('not found')) {
      throw new Error('File not found');
    } else {
      throw new Error(error.response?.data?.error || 'Download failed. Please try again.');
    }
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