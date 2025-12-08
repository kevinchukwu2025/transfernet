// transfernet/frontend/src/components/ProgressBar.jsx

import React from 'react';

const ProgressBar = ({ progress, uploadedChunks, totalChunks, status }) => {
  return (
    <div className="progress-container">
      <div className="progress-label">
        <span>
          {uploadedChunks || 0} / {totalChunks || 0} chunks
        </span>
        <span>{Math.round(progress || 0)}%</span>
      </div>
      <div className="progress-bar-bg">
        <div
          className="progress-bar-fill"
          style={{ width: `${progress || 0}%` }}
        />
      </div>
      {status && <div className="progress-status">{status}</div>}
    </div>
  );
};

export default ProgressBar;
