// frontend/src/components/Login.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../App.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotName, setForgotName] = useState('');
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotIssue, setForgotIssue] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('rememberMe');
    if (saved) {
      const { username: savedUser, password: savedPass } = JSON.parse(saved);
      setUsername(savedUser);
      setPassword(savedPass);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:8000/api/auth/login', { username, password });
      if (rememberMe) {
        localStorage.setItem('rememberMe', JSON.stringify({ username, password }));
      } else {
        localStorage.removeItem('rememberMe');
      }
      setError('');
      if (res.data.role === 'Admin') {
        navigate('/admin', {
          state: {
            username: res.data.username,
            role: res.data.role,
            positionId: res.data.positionId,
            token: res.data.token,
            position: res.data.position,
            experience: res.data.experience,
          },
        });
      } else if (res.data.role === 'Employee') {
        navigate('/employee', {
          state: {
            username: res.data.username,
            position: res.data.position,
            positionId: res.data.positionId,
            experience: res.data.experience,
            token: res.data.token,
          },
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Incorrect username or password');
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:8000/api/auth/forgot', {
        name: forgotName,
        username: forgotUsername,
        issue: forgotIssue,
      });
      alert('Request sent');
      setShowForgot(false);
      setForgotName('');
      setForgotUsername('');
      setForgotIssue('');
    } catch (err) {
      alert('Failed to send request');
    }
  };

  return (
    <div className="login-container">
      <h2 className="login-header">Welcome Back</h2>
      <p className="login-subheader">Sign in to continue to your account</p>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            type="text"
            className="form-input"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="options">
          <div className="checkbox-container">
            <input
              type="checkbox"
              className="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label className="checkbox-label">Remember Me</label>
          </div>
          <button type="button" className="text-button" onClick={() => setShowForgot(true)}>
            Forgot Password?
          </button>
        </div>
        <button type="submit" className="primary-button">
          SIGN IN
        </button>
      </form>

      {showForgot && (
        <div className="forgot-popup">
          <h3 className="forgot-header">Forgot Password</h3>
          <form onSubmit={handleForgot}>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                className="form-input"
                placeholder="Your full name"
                value={forgotName}
                onChange={(e) => setForgotName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                placeholder="Your username"
                value={forgotUsername}
                onChange={(e) => setForgotUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Issue</label>
              <textarea
                className="form-textarea"
                placeholder="Describe your issue"
                value={forgotIssue}
                onChange={(e) => setForgotIssue(e.target.value)}
                required
              />
            </div>
            <div className="forgot-buttons">
              <button type="button" className="text-button" onClick={() => setShowForgot(false)}>
                Cancel
              </button>
              <button type="submit" className="primary-button">
                Submit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Login;