// transfernet/frontend/src/App.jsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FileUpload from './components/FileUpload';
import DownloadPage from './components/DownloadPage';

function App() {
  return (
    <Router>
      <div className="container">
        <header className="header">
          <h1 className="logo">TransferNet</h1>
          <p className="tagline">Send files up to 100GB • 24-hour expiry</p>
        </header>

        <Routes>
          <Route path="/" element={<FileUpload />} />
          <Route path="/download/:fileId" element={<DownloadPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
