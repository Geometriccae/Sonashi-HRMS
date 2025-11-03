import React, { useState } from 'react';
import styles from './AddUserModal.module.css';

const AddUserModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    emailId: '',
    phoneNumber: '',
    role: 'sales_executive'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Basic validation
      if (!formData.username.trim()) {
        throw new Error('Username is required');
      }
      if (!formData.password.trim()) {
        throw new Error('Password is required');
      }
      if (formData.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      if (formData.emailId && !/\S+@\S+\.\S+/.test(formData.emailId)) {
        throw new Error('Please enter a valid email address');
      }

      await onSubmit(formData);
      
      // Reset form
      setFormData({
        username: '',
        password: '',
        emailId: '',
        phoneNumber: '',
        role: 'sales_executive'
      });
    } catch (err) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        username: '',
        password: '',
        emailId: '',
        phoneNumber: '',
        role: 'sales_executive'
      });
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Add New User</h2>
          <button 
            className={styles.closeButton}
            onClick={handleClose}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="username">Username *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              required
              disabled={loading}
              placeholder="Enter username"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              disabled={loading}
              placeholder="Enter password (min 6 characters)"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="emailId">Email ID</label>
            <input
              type="email"
              id="emailId"
              name="emailId"
              value={formData.emailId}
              onChange={handleInputChange}
              disabled={loading}
              placeholder="Enter email address"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="phoneNumber">Phone Number</label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              disabled={loading}
              placeholder="Enter phone number"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="role">Role *</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              required
              disabled={loading}
            >
              <option value="sales_executive">Sales Executive</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className={styles.cancelButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={styles.submitButton}
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;
