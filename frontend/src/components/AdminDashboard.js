import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { DataGrid } from '@mui/x-data-grid';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { username, role, token } = state || {};
  
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionData, setCollectionData] = useState({ rows: [], columns: [] });
  const [status, setStatus] = useState('Ready');
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [showRestartPopup, setShowRestartPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);

  // Create axios instance with token
  const axiosInstance = useMemo(() => {
    return axios.create({
      baseURL: 'http://localhost:8000',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });
  }, [token]);

  // Error notification with auto-dismiss
  const showErrorNotification = (message) => {
    setErrorMessage(message);
    setShowError(true);
    setTimeout(() => {
      setShowError(false);
      setErrorMessage('');
    }, 5000);
  };

  // Error Notification Component
  const ErrorNotification = () => (
    showError ? (
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
        color: 'white',
        padding: '15px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(220, 53, 69, 0.4)',
        zIndex: 2000,
        maxWidth: '400px',
        animation: 'slideInRight 0.3s ease-out',
        fontSize: '0.95rem',
        fontWeight: '500'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', marginBottom: '5px' }}>Error</div>
            <div>{errorMessage}</div>
          </div>
          <button
            onClick={() => setShowError(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0',
              opacity: 0.8
            }}
            onMouseEnter={e => e.target.style.opacity = '1'}
            onMouseLeave={e => e.target.style.opacity = '0.8'}
          >
            ✕
          </button>
        </div>
      </div>
    ) : null
  );
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const GenericForm = ({ record, collection, onSave, onCancel }) => {
    const [formData, setFormData] = useState(() => {
      // Initialize form with default values based on schema
      const defaultData = record ? { ...record } : {};
      
      // Set default values for required fields if creating new record
      if (!record && collection) {
        const schema = {
          health_policies: {
            PolicyId: '',
            Role: '',
            ExperienceRange: '',
            MedicalCoverageLimit: '',
            InpatientCoverage: '',
            OutpatientCoverage: '',
            HospitalAccess: '',
            PreventiveCare: '',
            DentalVision: '',
            EmergencyCare: '',
            MentalHealthServices: '',
            MaternityCoverage: '',
            ChronicConditionCoverage: '',
            status: 'Active',
            positionId: []
          },
          vacation_policies: {
            PolicyId: '',
            Role: '',
            ExperienceRange: '',
            VacationDays: 0,
            CarryOverLimit: 0,
            RequestProcess: '',
            status: 'Active',
            positionId: []
          },
          users: {
            username: '',
            password: '',
            role: '',
            positionId: '',
            position: '',
            experience: '',
            email: '',
            isActive: true
          }
        };
        
        Object.assign(defaultData, schema[collection] || {});
      }
      
      return defaultData;
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const schema = {
      health_policies: {
        PolicyId: 'text',
        Role: ['Research Assistant', 'Analyst', 'Associate', 'Assistant Manager', 'Deputy Manager', 'Senior Manager', 'General Manager', 'Director', 'Vice President', 'President'],
        ExperienceRange: ['0-1', '1-2', '1-3', '2-4', '3-5', '4-6', '5-8', '8-12', '10-15', '15-20', '20+'],
        MedicalCoverageLimit: 'text',
        InpatientCoverage: 'textarea',
        OutpatientCoverage: 'textarea',
        HospitalAccess: 'text',
        PreventiveCare: 'text',
        DentalVision: 'text',
        EmergencyCare: 'text',
        MentalHealthServices: 'text',
        MaternityCoverage: 'text',
        ChronicConditionCoverage: 'text',
        status: ['Active', 'Inactive'],
        positionId: { type: 'array', options: ['ADMIN001', 'EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005', 'EMP006', 'EMP007', 'EMP008', 'EMP009', 'EMP010', 'EMP011'] }
      },
      vacation_policies: {
        PolicyId: 'text',
        Role: ['Research Assistant', 'Analyst', 'Associate', 'Assistant Manager', 'Deputy Manager', 'Senior Manager', 'General Manager', 'Director', 'Vice President', 'President'],
        ExperienceRange: ['0-1', '1-2', '1-3', '2-4', '3-5', '4-6', '5-8', '8-12', '10-15', '15-20', '20+'],
        VacationDays: 'number',
        CarryOverLimit: 'number',
        RequestProcess: 'textarea',
        status: ['Active', 'Inactive'],
        positionId: { type: 'array', options: ['ADMIN001', 'EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005', 'EMP006', 'EMP007', 'EMP008', 'EMP009', 'EMP010', 'EMP011'] }
      },
      users: {
        username: 'text',
        password: 'text',
        role: ['Admin', 'Employee'],
        positionId: 'text',
        position: 'text',
        experience: 'text',
        email: 'email',
        isActive: 'checkbox'
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setIsSubmitting(true);
      
      try {
        await onSave(formData, collection);
      } catch (error) {
        console.error('Error saving record:', error);
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleChange = (key, value) => {
      setFormData({ ...formData, [key]: value });
    };

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(5px)',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
          padding: '30px',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          maxWidth: '700px',
          width: '90%',
          maxHeight: '85vh',
          overflowY: 'auto',
          fontSize: '1rem',
          color: '#333',
          fontFamily: '"Segoe UI", "Roboto", "Arial", sans-serif',
          animation: 'slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '25px',
            paddingBottom: '15px',
            borderBottom: '2px solid #e9ecef',
            position: 'sticky',
            top: 0,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            zIndex: 1
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '1.8rem', 
              color: '#1976d2',
              fontWeight: '700',
              textShadow: '0 2px 4px rgba(25, 118, 210, 0.1)'
            }}>
              {record ? 'Edit Record' : 'Create Record'}
            </h3>
            <button
              style={{
                background: 'linear-gradient(135deg, #ff5252 0%, #d32f2f 100%)',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 4px 8px rgba(211, 47, 47, 0.3)'
              }}
              onClick={onCancel}
              onMouseEnter={e => {
                e.target.style.transform = 'scale(1.1) rotate(90deg)';
                e.target.style.boxShadow = '0 6px 12px rgba(211, 47, 47, 0.4)';
              }}
              onMouseLeave={e => {
                e.target.style.transform = 'scale(1) rotate(0deg)';
                e.target.style.boxShadow = '0 4px 8px rgba(211, 47, 47, 0.3)';
              }}
            >
              ✕
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: '20px' }}>
              {schema[collection] && Object.keys(schema[collection]).map((key, index) => {
                const fieldConfig = schema[collection][key];
                const isSelect = Array.isArray(fieldConfig) || (typeof fieldConfig === 'object' && fieldConfig.type === 'array');
                const isArray = typeof fieldConfig === 'object' && fieldConfig.type === 'array';
                const options = isArray ? fieldConfig.options : (Array.isArray(fieldConfig) ? fieldConfig : null);
                const inputType = isArray ? 'select' : (Array.isArray(fieldConfig) ? 'select' : fieldConfig);
                
                return (
                  <div key={key} style={{ 
                    marginBottom: '20px',
                    animation: `slideInUp 0.5s ease-out ${index * 0.1}s both`
                  }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '600',
                      color: '#495057',
                      fontSize: '1.1rem',
                      textTransform: 'capitalize'
                    }}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </label>
                    
                    {inputType === 'textarea' ? (
                      <textarea
                        value={formData[key] || ''}
                        onChange={(e) => handleChange(key, e.target.value)}
                        rows="4"
                        required
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '2px solid #e9ecef',
                          borderRadius: '8px',
                          fontSize: '1rem',
                          color: '#495057',
                          backgroundColor: '#ffffff',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          transition: 'all 0.3s ease',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                        onFocus={e => {
                          e.target.style.borderColor = '#1976d2';
                          e.target.style.boxShadow = '0 0 0 3px rgba(25, 118, 210, 0.1)';
                        }}
                        onBlur={e => {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    ) : inputType === 'checkbox' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={formData[key] || false}
                          onChange={(e) => handleChange(key, e.target.checked)}
                          style={{ 
                            width: '20px',
                            height: '20px',
                            accentColor: '#1976d2',
                            cursor: 'pointer'
                          }}
                        />
                        <span style={{ color: '#6c757d', fontSize: '0.9rem' }}>
                          {formData[key] ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    ) : isSelect ? (
                      <select
                        value={isArray ? '' : (formData[key] || '')}
                        onChange={(e) => {
                          if (isArray) {
                            const value = Array.from(e.target.selectedOptions, option => option.value);
                            handleChange(key, value);
                          } else {
                            handleChange(key, e.target.value);
                          }
                        }}
                        required
                        multiple={isArray}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '2px solid #e9ecef',
                          borderRadius: '8px',
                          fontSize: '1rem',
                          color: '#495057',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          outline: 'none',
                          boxSizing: 'border-box',
                          ...(isArray ? { height: '120px' } : {})
                        }}
                        onFocus={e => {
                          e.target.style.borderColor = '#1976d2';
                          e.target.style.boxShadow = '0 0 0 3px rgba(25, 118, 210, 0.1)';
                        }}
                        onBlur={e => {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        {!isArray && <option value="">Select {key.replace(/([A-Z])/g, ' $1').toLowerCase()}</option>}
                        {options && options.map(option => (
                          <option key={option} value={option} 
                                  selected={isArray && Array.isArray(formData[key]) && formData[key].includes(option)}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={inputType === 'number' ? 'number' : inputType}
                        value={formData[key] || ''}
                        onChange={(e) => handleChange(key, inputType === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '2px solid #e9ecef',
                          borderRadius: '8px',
                          fontSize: '1rem',
                          color: '#495057',
                          backgroundColor: '#ffffff',
                          transition: 'all 0.3s ease',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                        onFocus={e => {
                          e.target.style.borderColor = '#1976d2';
                          e.target.style.boxShadow = '0 0 0 3px rgba(25, 118, 210, 0.1)';
                        }}
                        onBlur={e => {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    )}
                    
                    {/* Display current array values */}
                    {isArray && formData[key] && Array.isArray(formData[key]) && (
                      <div style={{ marginTop: '8px', fontSize: '0.9rem', color: '#6c757d' }}>
                        Current: {formData[key].join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div style={{
              display: 'flex',
              gap: '15px',
              justifyContent: 'flex-end',
              marginTop: '30px',
              paddingTop: '20px',
              borderTop: '2px solid #e9ecef',
              position: 'sticky',
              bottom: 0,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              zIndex: 1
            }}>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: isSubmitting 
                    ? 'linear-gradient(135deg, #90a4ae 0%, #78909c 100%)'
                    : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                  minWidth: '120px',
                  justifyContent: 'center'
                }}
                onMouseEnter={e => !isSubmitting && (e.target.style.transform = 'translateY(-2px)', e.target.style.boxShadow = '0 6px 16px rgba(25, 118, 210, 0.4)')}
                onMouseLeave={e => !isSubmitting && (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 4px 12px rgba(25, 118, 210, 0.3)')}
              >
                {isSubmitting ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #ffffff',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Saving...
                  </>
                ) : (
                  <>Save</>
                )}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                style={{
                  background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)',
                  opacity: isSubmitting ? 0.6 : 1
                }}
                onMouseEnter={e => !isSubmitting && (e.target.style.transform = 'translateY(-2px)', e.target.style.boxShadow = '0 6px 16px rgba(220, 53, 69, 0.4)')}
                onMouseLeave={e => !isSubmitting && (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.3)')}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
        
        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: scale(0.9) translateY(20px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
          
          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  };

  const RestartPopup = ({ onConfirm, onCancel }) => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(5px)',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        padding: '30px',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
        maxWidth: '500px',
        width: '90%',
        fontSize: '1rem',
        color: '#333',
        fontFamily: '"Segoe UI", "Roboto", "Arial", sans-serif',
        animation: 'slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '3rem',
          marginBottom: '20px'
        }}>
          🔄
        </div>
        <h3 style={{ 
          margin: '0 0 15px', 
          fontSize: '1.5rem', 
          color: '#1976d2',
          fontWeight: '700'
        }}>
          Server Restart Required
        </h3>
        <p style={{ 
          margin: '0 0 25px', 
          lineHeight: '1.6', 
          fontSize: '1.1rem',
          color: '#6c757d'
        }}>
          Policy changes require a server restart to take effect in the chatbot. Would you like to restart now?
        </p>
        <div style={{
          display: 'flex',
          gap: '15px',
          justifyContent: 'center'
        }}>
          <button
            style={{
              background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
            }}
            onClick={onConfirm}
            onMouseEnter={e => (e.target.style.transform = 'translateY(-2px)', e.target.style.boxShadow = '0 6px 16px rgba(25, 118, 210, 0.4)')}
            onMouseLeave={e => (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 4px 12px rgba(25, 118, 210, 0.3)')}
          >
            Restart Now
          </button>
          <button
            style={{
              background: 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 12px rgba(108, 117, 125, 0.3)'
            }}
            onClick={onCancel}
            onMouseEnter={e => (e.target.style.transform = 'translateY(-2px)', e.target.style.boxShadow = '0 6px 16px rgba(108, 117, 125, 0.4)')}
            onMouseLeave={e => (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 4px 12px rgba(108, 117, 125, 0.3)')}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );

  // Load collections from API
  const loadCollections = useCallback(async (search = '') => {
    setIsLoading(true);
    setStatus('Loading collections...');
    try {
      const response = await axiosInstance.get('/api/policy/collections');
      const collectionNames = response.data
        .filter(name => search === '' || name.toLowerCase().includes(search.toLowerCase()))
        .sort();
      setCollections(collectionNames);
      setStatus(collectionNames.length ? 'Collections loaded successfully.' : 'No collections found.');
    } catch (err) {
      console.error('Error loading collections:', err.response?.data || err.message);
      const errorMsg = err.response?.data?.detail || err.message || 'Error loading collections';
      setStatus('Error loading collections.');
      showErrorNotification(errorMsg);
      if (err.response?.status === 401) {
        navigate('/');
      }
    } finally {
      setIsLoading(false);
    }
  }, [axiosInstance, navigate]);

  const debouncedLoadCollections = useCallback(debounce(loadCollections, 300), [loadCollections]);

  // Load collection data from API
  const loadCollectionData = useCallback(async (collectionId) => {
    setIsLoading(true);
    setStatus('Loading collection data...');
    try {
      const response = await axiosInstance.get(`/api/policy/collection/${collectionId}`);
      const data = response.data;
      
      const columns = data.length ? [
        { 
          field: 'actions', 
          headerName: 'Actions', 
          width: 240, 
          sortable: false,
          renderCell: (params) => (
            <div style={{ display: 'flex', gap: '8px', padding: '4px 0' }}>
              <button
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(25, 118, 210, 0.3)'
                }}
                onClick={() => handleEditRecord(params.row, collectionId)}
                onMouseEnter={e => (e.target.style.transform = 'translateY(-1px)', e.target.style.boxShadow = '0 4px 8px rgba(25, 118, 210, 0.4)')}
                onMouseLeave={e => (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 2px 4px rgba(25, 118, 210, 0.3)')}
              >
                Edit
              </button>
              <button
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(220, 53, 69, 0.3)'
                }}
                onClick={() => handleDeleteRecord(params.row._id || params.row.PolicyId, collectionId)}
                onMouseEnter={e => (e.target.style.transform = 'translateY(-1px)', e.target.style.boxShadow = '0 4px 8px rgba(220, 53, 69, 0.4)')}
                onMouseLeave={e => (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 2px 4px rgba(220, 53, 69, 0.3)')}
              >
                Delete
              </button>
              <button
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(40, 167, 69, 0.3)'
                }}
                onClick={() => handleDownloadRecord(params.row, collectionId)}
                onMouseEnter={e => (e.target.style.transform = 'translateY(-1px)', e.target.style.boxShadow = '0 4px 8px rgba(40, 167, 69, 0.4)')}
                onMouseLeave={e => (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 2px 4px rgba(40, 167, 69, 0.3)')}
              >
                Download
              </button>
            </div>
          )
        },
        ...Object.keys(data[0] || {}).filter(key => key !== '_id').map(key => ({
          field: key,
          headerName: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          width: 150,
          flex: 1,
          valueFormatter: ({ value }) => Array.isArray(value) ? value.join(', ') : value
        }))
      ] : [];
      
      setCollectionData({ 
        rows: data.map((row, index) => ({ 
          id: row._id || row.PolicyId || index, 
          ...row 
        })), 
        columns 
      });
      setStatus(data.length ? `Loaded ${data.length} records` : 'No records found.');
    } catch (err) {
      console.error('Error loading collection data:', err.response?.data || err.message);
      const errorMsg = err.response?.data?.detail || err.message || 'Error loading collection data';
      setStatus('Error loading data.');
      showErrorNotification(errorMsg);
      if (err.response?.status === 401) {
        navigate('/');
      }
    } finally {
      setIsLoading(false);
    }
  }, [axiosInstance, navigate]);

  // File upload handler
  const handleFileUpload = async (e, action = 'create') => {
    const file = e.target.files[0];
    if (!file || !file.name.endsWith('.json')) {
      alert('Please select a valid JSON file.');
      setStatus('Invalid file type.');
      return;
    }

    try {
      setIsLoading(true);
      setStatus(`Processing ${file.name}...`);
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        alert('JSON file must be an array of objects.');
        setStatus('Invalid JSON file.');
        setIsLoading(false);
        return;
      }

      const collectionId = file.name.replace('.json', '');
      const response = await axiosInstance.post(
        `/api/policy/collection/${collectionId}`,
        { data },
        { params: { action } }
      );
      
      setStatus(response.data.message);
      if (response.data.restart_required && ['health_policies', 'vacation_policies'].includes(collectionId)) {
        setShowRestartPopup(true);
      }
      await loadCollections();
      if (selectedCollection === collectionId) {
        await loadCollectionData(collectionId);
      }
    } catch (err) {
      console.error(`Error processing file ${action}:`, err.response?.data || err.message);
      let errorMsg = err.response?.data?.detail || err.message || `Error ${action}ing collection`;
      
      // Handle specific MongoDB duplicate key error
      if (errorMsg.includes('E11000 duplicate key error')) {
        const match = errorMsg.match(/dup key: \{ ([^:]+): "([^"]+)" \}/);
        if (match) {
          const [, fieldName, fieldValue] = match;
          errorMsg = `Duplicate ${fieldName}: "${fieldValue}" already exists. Please use a unique ${fieldName}.`;
        } else {
          errorMsg = 'Duplicate key error: A record with this identifier already exists.';
        }
      }
      
      setStatus(`Error ${action}ing collection`);
      showErrorNotification(errorMsg);
    } finally {
      setIsLoading(false);
      e.target.value = ''; // Reset file input
    }
  };

  // Download collection data
  const handleDownloadData = async () => {
    if (!selectedCollection) {
      setStatus('Please select a collection to download.');
      return;
    }
    
    setIsLoading(true);
    setStatus('Downloading data...');
    try {
      const response = await axiosInstance.get(`/api/policy/download/${selectedCollection}`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedCollection}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Data downloaded successfully.');
    } catch (err) {
      console.error('Error downloading data:', err.response?.data || err.message);
      setStatus('Error downloading data.');
    } finally {
      setIsLoading(false);
    }
  };

  // Download single record
  const handleDownloadRecord = async (record, collection) => {
    setIsLoading(true);
    setStatus(`Downloading record...`);
    try {
      const recordData = { ...record };
      delete recordData.id;
      delete recordData._id;
      const blob = new Blob([JSON.stringify(recordData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${collection}_${record._id || record.PolicyId || 'record'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Record downloaded successfully.');
    } catch (err) {
      console.error('Error downloading record:', err.message);
      setStatus('Error downloading record.');
    } finally {
      setIsLoading(false);
    }
  };

  // Save record (create or update)
  const handleSaveRecord = async (recordData, collection) => {
    try {
      let response;
      if (editingRecord && editingRecord._id) {
        // Update existing record
        response = await axiosInstance.put(`/api/policy/collection/${collection}/${editingRecord._id}`, {
          data: recordData
        });
      } else {
        // Create new record
        response = await axiosInstance.post(`/api/policy/collection/${collection}/record`, {
          data: recordData
        });
      }
      
      setStatus(response.data.message);
      if (response.data.restart_required && ['health_policies', 'vacation_policies'].includes(collection)) {
        setShowRestartPopup(true);
      }
      setShowForm(false);
      setEditingRecord(null);
      await loadCollectionData(collection);
    } catch (err) {
      console.error('Error saving record:', err.response?.data || err.message);
      let errorMsg = err.response?.data?.detail || err.message || 'Error saving record';
      
      // Handle specific MongoDB duplicate key error
      if (errorMsg.includes('E11000 duplicate key error')) {
        const match = errorMsg.match(/dup key: \{ ([^:]+): "([^"]+)" \}/);
        if (match) {
          const [, fieldName, fieldValue] = match;
          errorMsg = `Duplicate ${fieldName}: "${fieldValue}" already exists. Please use a unique ${fieldName}.`;
        } else {
          errorMsg = 'Duplicate key error: A record with this identifier already exists.';
        }
      }
      
      setStatus('Error saving record');
      showErrorNotification(errorMsg);
      throw err; // Re-throw to handle in form
    }
  };

  // Delete record
  const handleDeleteRecord = async (recordId, collection) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    
    try {
      setIsLoading(true);
      setStatus('Deleting record...');
      const response = await axiosInstance.delete(`/api/policy/collection/${collection}/${recordId}`);
      setStatus(response.data.message);
      if (response.data.restart_required && ['health_policies', 'vacation_policies'].includes(collection)) {
        setShowRestartPopup(true);
      }
      await loadCollectionData(collection);
    } catch (err) {
      console.error('Error deleting record:', err.response?.data || err.message);
      const errorMsg = err.response?.data?.detail || err.message || 'Error deleting record';
      setStatus('Error deleting record');
      showErrorNotification(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Edit record
  const handleEditRecord = (row, collection) => {
    setEditingRecord(row);
    setShowForm(true);
  };

  // Server restart
  const handleRestartServer = () => {
    setStatus('Server restart required. Please restart the backend server manually.');
    setShowRestartPopup(false);
  };

  // Logout
  const handleLogout = () => {
    if (localStorage.getItem('rememberMe')) {
      localStorage.removeItem('rememberMe');
    }
    navigate('/');
  };

  // Filter collections based on search
  const filteredCollections = collections.filter(col => 
    searchText === '' || col.toLowerCase().includes(searchText.toLowerCase())
  );

  // Check authentication and load initial data
  useEffect(() => {
    if (!username || !role || !token || role !== 'Admin') {
      navigate('/');
      return;
    }
    loadCollections();
  }, [username, role, token, navigate, loadCollections]);

  // Load collection data when selection changes
  useEffect(() => {
    if (selectedCollection) {
      loadCollectionData(selectedCollection);
    }
  }, [selectedCollection, loadCollectionData]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      padding: '0',
      margin: '0',
      background: 'linear-gradient(135deg, #f4f6f8 0%, #e8eaf6 100%)',
      fontFamily: '"Segoe UI", "Roboto", "Arial", sans-serif',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, rgb(35 210 25) 0%, rgb(0 0 0) 100%);',
        padding: '15px 25px',
        color: 'white',
        boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)',
        zIndex: 100
      }}>
        <div>
          <h1 style={{ 
            fontSize: '1.8rem', 
            fontWeight: '700', 
            margin: 0,
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
          }}>
            Admin Dashboard
          </h1>
          <p style={{ 
            margin: '5px 0 0', 
            opacity: 0.9, 
            fontSize: '1rem' 
          }}>
            Welcome, {username} • {role}
          </p>
        </div>
        <button
          style={{
            background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)'
          }}
          onClick={handleLogout}
          onMouseEnter={e => (e.target.style.transform = 'translateY(-2px)', e.target.style.boxShadow = '0 6px 16px rgba(220, 53, 69, 0.4)')}
          onMouseLeave={e => (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.3)')}
        >
          Logout
        </button>
      </div>

      {/* Tab Control */}
      <div style={{ 
        padding: '0 25px',
        paddingTop: '20px',
        paddingBottom: '10px'
      }}>
        <button style={{
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: 'white',
          padding: '12px 24px',
          border: 'none',
          borderRadius: '8px 8px 0 0',
          cursor: 'pointer',
          fontSize: '1.1rem',
          fontWeight: '600',
          boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
        }}>
          Manage Policies
        </button>
      </div>

      {/* Main Content Container */}
      <div style={{
        flex: 1,
        margin: '0 25px 25px',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '15px',
          padding: '25px 25px 0',
          flexWrap: 'wrap'
        }}>
          <button
            style={{
              background: selectedCollection 
                ? 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
                : 'linear-gradient(135deg, #b0bec5 0%, #90a4ae 100%)',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              cursor: selectedCollection ? 'pointer' : 'not-allowed',
              fontSize: '1rem',
              fontWeight: '600',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: selectedCollection 
                ? '0 4px 12px rgba(25, 118, 210, 0.3)'
                : '0 2px 6px rgba(176, 190, 197, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onClick={() => {
              if (selectedCollection) {
                setShowForm(true);
                setEditingRecord(null);
              }
            }}
            onMouseEnter={e => selectedCollection && (e.target.style.transform = 'translateY(-2px)', e.target.style.boxShadow = '0 6px 16px rgba(25, 118, 210, 0.4)')}
            onMouseLeave={e => selectedCollection && (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 4px 12px rgba(25, 118, 210, 0.3)')}
            disabled={!selectedCollection}
          >
            Create Record
          </button>
          
          <button
            style={{
              background: selectedCollection 
                ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                : 'linear-gradient(135deg, #b0bec5 0%, #90a4ae 100%)',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              cursor: selectedCollection ? 'pointer' : 'not-allowed',
              fontSize: '1rem',
              fontWeight: '600',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: selectedCollection 
                ? '0 4px 12px rgba(40, 167, 69, 0.3)'
                : '0 2px 6px rgba(176, 190, 197, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onClick={handleDownloadData}
            onMouseEnter={e => selectedCollection && (e.target.style.transform = 'translateY(-2px)', e.target.style.boxShadow = '0 6px 16px rgba(40, 167, 69, 0.4)')}
            onMouseLeave={e => selectedCollection && (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)')}
            disabled={!selectedCollection}
          >
            Download Collection
          </button>
          
          <label style={{
            background: 'linear-gradient(135deg, #6f42c1 0%, #5a32a3 100%)',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 12px rgba(111, 66, 193, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={e => (e.target.style.transform = 'translateY(-2px)', e.target.style.boxShadow = '0 6px 16px rgba(111, 66, 193, 0.4)')}
          onMouseLeave={e => (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 4px 12px rgba(111, 66, 193, 0.3)')}
          >
            Upload JSON
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => handleFileUpload(e, 'create')}
            />
          </label>
        </div>

        {/* Main Grid */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '300px 1fr',
          gap: '25px',
          padding: '25px',
          overflow: 'hidden'
        }}>
          {/* Collections List */}
          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <h3 style={{
              marginBottom: '15px',
              fontSize: '1.3rem',
              color: '#343a40',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              Collections
            </h3>
            
            <input
              style={{
                width: '100%',
                padding: '12px 16px',
                marginBottom: '15px',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                fontSize: '1rem',
                color: '#495057',
                backgroundColor: '#ffffff',
                transition: 'all 0.3s ease',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              placeholder="Search collections..."
              value={searchText}
              onChange={e => {
                setSearchText(e.target.value);
                debouncedLoadCollections(e.target.value);
              }}
              onFocus={e => {
                e.target.style.borderColor = '#1976d2';
                e.target.style.boxShadow = '0 0 0 3px rgba(25, 118, 210, 0.1)';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#e9ecef';
                e.target.style.boxShadow = 'none';
              }}
            />
            
            <div style={{ 
              flex: 1, 
              overflowY: 'auto',
              paddingRight: '5px'
            }}>
              {filteredCollections.map((col, index) => (
                <div
                  key={col}
                  style={{
                    padding: '15px',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    fontSize: '1rem',
                    color: '#495057',
                    background: selectedCollection === col 
                      ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)'
                      : 'transparent',
                    border: selectedCollection === col 
                      ? '2px solid #1976d2'
                      : '2px solid transparent',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    fontWeight: selectedCollection === col ? '600' : '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                  onClick={() => setSelectedCollection(col)}
                  onMouseEnter={e => {
                    if (selectedCollection !== col) {
                      e.target.style.background = 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)';
                      e.target.style.transform = 'translateX(5px)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (selectedCollection !== col) {
                      e.target.style.background = 'transparent';
                      e.target.style.transform = 'translateX(0)';
                    }
                  }}
                >
                  {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
              ))}
              
              {filteredCollections.length === 0 && (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#6c757d',
                  fontSize: '1rem'
                }}>
                  No collections found
                </div>
              )}
            </div>
          </div>

          {/* Data Grid */}
          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {selectedCollection ? (
              collectionData.rows.length > 0 ? (
                <div style={{ flex: 1, minHeight: 0 }}>
                  <DataGrid
                    rows={collectionData.rows}
                    columns={collectionData.columns}
                    pageSize={10}
                    rowsPerPageOptions={[10, 20, 50]}
                    disableSelectionOnClick
                    sx={{
                      border: 'none',
                      height: '100%',
                      '& .MuiDataGrid-cell': {
                        borderColor: 'rgba(0, 0, 0, 0.08)',
                        fontSize: '0.95rem'
                      },
                      '& .MuiDataGrid-columnHeaders': {
                        backgroundColor: '#f8f9fa',
                        borderColor: 'rgba(0, 0, 0, 0.08)',
                        fontSize: '1rem',
                        fontWeight: '600'
                      },
                      '& .MuiDataGrid-row:hover': {
                        backgroundColor: 'rgba(25, 118, 210, 0.04)'
                      }
                    }}
                  />
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  color: '#6c757d'
                }}>
                  <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📄</div>
                  <h3 style={{ margin: '0 0 10px', fontSize: '1.5rem' }}>No Records Found</h3>
                  <p style={{ margin: 0, fontSize: '1.1rem' }}>
                    This collection is empty. Create your first record!
                  </p>
                </div>
              )
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                color: '#6c757d'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '20px' }}>👈</div>
                <h3 style={{ margin: '0 0 10px', fontSize: '1.5rem' }}>Select a Collection</h3>
                <p style={{ margin: 0, fontSize: '1.1rem' }}>
                  Choose a collection from the left to view and manage records
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div style={{
          padding: '15px 25px',
          background: 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)',
          borderTop: '1px solid rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          minHeight: '60px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '1rem',
            color: '#495057',
            fontWeight: '500'
          }}>
            {status}
          </div>
          
          {isLoading && (
            <div style={{
              width: '200px',
              height: '4px',
              background: '#e9ecef',
              borderRadius: '2px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, #1976d2, #64b5f6, #1976d2)',
                backgroundSize: '200% 100%',
                animation: 'loading 2s linear infinite',
                borderRadius: '2px'
              }} />
            </div>
          )}
        </div>
      </div>

      {/* Error Notification */}
      <ErrorNotification />

      {/* Modals */}
      {showForm && (
        <GenericForm
          record={editingRecord}
          collection={selectedCollection}
          onSave={handleSaveRecord}
          onCancel={() => {
            setShowForm(false);
            setEditingRecord(null);
          }}
        />
      )}

      {showRestartPopup && (
        <RestartPopup
          onConfirm={handleRestartServer}
          onCancel={() => setShowRestartPopup(false)}
        />
      )}

      <style jsx>{`
        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;