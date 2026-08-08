import React from "react";
import ReactDOM from "react-dom";
import "./LogoutModal.css";

function LogoutModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="logout-modal">
        <div className="modal-content">
          <h2 className="modal-title">Log Out</h2>
          <p className="modal-description">
            Are you sure you want to log out of your account?
          </p>
        </div>
        <div className="modal-actions">
          <button className="modal-cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-confirm-button" onClick={onConfirm}>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}

export default LogoutModal;
