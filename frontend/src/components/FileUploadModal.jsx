import React, { useState, useEffect } from "react";
import "./FileUploadModal.css";
import uploadIcon from "../assets/dashboard/upload-cloud.svg";
import removeIcon from "../assets/dashboard/trash-2.svg";

function FileUploadModal({ isOpen, onClose, onUpload, allowTypeSelection = false, typeOptions = [] }) {
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Clear previously selected files whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setUploadedFiles([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      setUploadedFiles([]);
      onClose();
    }
  };

  const handleFileUpload = () => {
    if (onUpload) {
      const filesToSend = uploadedFiles.map(f => {
        if (allowTypeSelection) {
          const finalType = f.isCustomType ? f.customType : f.type;
          return { rawFile: f.rawFile, type: finalType };
        }
        return f.rawFile;
      }).filter(f => allowTypeSelection ? f.rawFile : f);
      onUpload(filesToSend);
    }
    setUploadedFiles([]);
    onClose();
  };

  const handleRemoveFile = (fileId) => {
    setUploadedFiles(uploadedFiles.filter(file => file.id !== fileId));
  };

  const handleTypeChange = (fileId, value) => {
    setUploadedFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        if (value === "ADD_CUSTOM") {
          return { ...f, type: "ADD_CUSTOM", isCustomType: true };
        } else {
          return { ...f, type: value, isCustomType: false };
        }
      }
      return f;
    }));
  };

  const handleCustomTypeChange = (fileId, value) => {
    setUploadedFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        return { ...f, customType: value };
      }
      return f;
    }));
  };

  const handleUploadClick = () => {
    // Trigger file input click
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = '*/*';
    fileInput.onchange = (e) => {
      const files = Array.from(e.target.files || []);
      const next = files.map((file, idx) => {
        const sizeKB = Math.max(1, Math.round(file.size / 1024));
        return {
          id: Date.now() + idx,
          name: file.name,
          size: `${sizeKB} KB`,
          progress: 100,
          isCompleted: true,
          rawFile: file,
          type: typeOptions.length > 0 ? typeOptions[0] : "Extra",
          isCustomType: false,
          customType: ""
        };
      });
      setUploadedFiles(prev => [...prev, ...next]);
    };
    fileInput.click();
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="file-upload-modal">
        <div className="file-upload-content">
          <div className="file-upload-header">
            <div className="header-title">Upload and attach files</div>
            <div className="header-description">
              Upload and attach files to this project.
            </div>
          </div>
          
          <div className="file-upload-section">
            <div className="file-drop-zone" onClick={handleUploadClick}>
              <div className="drop-zone-content">
                <img
                  src={uploadIcon}
                  alt="Upload icon"
                  className="upload-icon"
                />
                <div className="upload-actions">
                  <div className="upload-text-row">
                    <div className="upload-button-text">Click to upload</div>
                    <div className="upload-drag-text">or drag and drop</div>
                  </div>
                  <div className="upload-supporting-text">
                    Upload supports all documents and media (max. 50mb)
                  </div>
                </div>
              </div>
            </div>
            
            <div className="file-queue">
              {uploadedFiles.map((file) => (
                <div 
                  key={file.id} 
                  className={`file-upload-item ${file.isCompleted ? 'completed' : 'uploading'}`}
                >
                  <div className="file-content">
                    <div className="file-info">
                      <div className="file-name">{file.name}</div>
                      <div className="file-size">{file.size}</div>
                    </div>
                    {allowTypeSelection && (
                      <div style={{ marginTop: '8px', marginBottom: '8px', width: '100%' }}>
                        <select 
                          value={file.type}
                          onChange={(e) => handleTypeChange(file.id, e.target.value)}
                          style={{
                            width: "100%", padding: "6px 10px", borderRadius: 6,
                            border: "1.5px solid #e2e8f0", fontSize: 13,
                            background: "#fff", cursor: "pointer", outline: "none", boxSizing: "border-box"
                          }}
                        >
                          {typeOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                          <option value="ADD_CUSTOM">+ Add Custom Type</option>
                        </select>
                        {file.isCustomType && (
                          <input
                            type="text"
                            placeholder="Enter custom document type"
                            value={file.customType}
                            onChange={(e) => handleCustomTypeChange(file.id, e.target.value)}
                            style={{
                              width: "100%", padding: "6px 10px", borderRadius: 6,
                              border: "1.5px solid #e2e8f0", fontSize: 13,
                              marginTop: 6, boxSizing: "border-box", outline: "none"
                            }}
                          />
                        )}
                      </div>
                    )}
                    <div className="file-progress">
                      <div className="progress-bar">
                        <div className="progress-background">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="progress-percentage">{file.progress}%</div>
                    </div>
                  </div>
                  <button 
                    className="remove-file-button"
                    onClick={() => handleRemoveFile(file.id)}
                  >
                    <img
                      src={removeIcon}
                      alt="Remove file"
                      className="remove-icon"
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="file-upload-actions">
          <button className="file-cancel-button" onClick={onClose}>
            <div className="file-cancel-button-content">
              Cancel
            </div>
          </button>
          <button className="file-attach-button" onClick={handleFileUpload}>
            <div className="file-attach-button-content">
              Attach files
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default FileUploadModal;
