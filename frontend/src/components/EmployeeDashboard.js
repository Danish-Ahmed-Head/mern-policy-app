import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import '../App.css';

const EmployeeDashboard = () => {
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [isResponding, setIsResponding] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const { state } = useLocation();
  const { username, position, positionId, experience } = state || {};
  const sessionId = useRef(crypto.randomUUID()).current;
  const chatContainerRef = useRef(null);
  const lastQueryTime = useRef(Date.now());
  const cancelTokenRef = useRef(null);
  const sidebarRef = useRef(null);

  const initializeSession = useCallback(async () => {
    if (!username || !positionId) {
      console.error('Missing username or positionId:', { username, positionId });
      alert('Invalid user data. Please log in again.');
      navigate('/');
      return;
    }

    try {
      const normalizedPositionId = positionId.startsWith("EMP")
        ? positionId.replace("EMP", "").replace(/^0+/, "").padStart(2, "0")
        : positionId;
      console.log('Sending /chat request with:', {
        session_id: sessionId,
        position_id: normalizedPositionId,
        username,
        experience,
      });
      const response = await axios.post(
        'http://localhost:8000/chat',
        {
          session_id: sessionId,
          position_id: normalizedPositionId,
          username,
          experience: experience || 'N/A',
        },
        { timeout: 30000 }
      );
      console.log('Received /chat response:', response.data);
      if (response.status === 200) {
        setIsConnected(true);
        setMessages([
          { text: 'Am I connected with the bot?', isUser: true },
          { text: 'Yes, you are connected! You can ask your questions.', isUser: false },
        ]);
      }
    } catch (err) {
      console.error('Session initialization failed:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      const errorMessage = err.response?.data?.detail
        ? `Unable to connect to the chat server: ${err.response.data.detail}`
        : `Unable to connect to the chat server: ${err.message}. Please check if the server is running.`;
      alert(errorMessage);
      navigate('/');
    }
  }, [navigate, positionId, username, experience, sessionId]);

  const loadChatHistory = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/chat/history', {
        params: { username },
      });
      setChatHistory(
        response.data.map(item => ({
          query: item.userQuery,
          response: item.botResponse,
          date: new Date(item.queryDate),
        }))
      );
    } catch (err) {
      console.error('Error loading chat history:', err.response?.data || err.message);
      alert('Failed to load chat history. Please try again.');
    }
  }, [username]);

  const handleClickOutside = useCallback((event) => {
    if (sidebarRef.current && !sidebarRef.current.contains(event.target) &&
        !event.target.closest('.hamburger-menu') && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [isSidebarOpen]);

  const handleEscapeKey = useCallback((event) => {
    if (event.key === 'Escape' && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    initializeSession();
    loadChatHistory();
    return () => {
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel();
      }
    };
  }, [initializeSession, loadChatHistory]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [handleClickOutside, handleEscapeKey]);

  const toggleSidebar = () => {
    setIsSidebarOpen(prevState => !prevState);
  };

  const saveChat = async (userQuery, botResponse) => {
    try {
      const response = await axios.post('http://localhost:5000/api/chat/save', {
        userQuery,
        botResponse,
        sessionId,
        positionId, // Send original positionId (e.g., "EMP002")
        experience,
        username,
      });
      console.log('Chat saved successfully:', response.data);
      await loadChatHistory(); // Refresh history after saving
    } catch (err) {
      console.error('Failed to save chat:', err.response?.data || err.message);
      alert('Failed to save chat history. Check console for details.');
    }
  };

  const handleQuery = async () => {
    if (!query.trim() || isResponding) return;
    if (Date.now() - lastQueryTime.current < 500) return;
    lastQueryTime.current = Date.now();

    setIsResponding(true);
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel();
    }
    cancelTokenRef.current = axios.CancelToken.source();

    try {
      const currentQuery = query;
      setMessages(prev => [...prev, { text: currentQuery, isUser: true }]);
      setQuery('');

      const response = await axios.post(
        'http://localhost:8000/ask',
        { session_id: sessionId, question: currentQuery },
        { cancelToken: cancelTokenRef.current.token }
      );

      const { answer, related_questions } = response.data;
      const limitedQuestions = (related_questions || []).slice(0, 2);

      let currentText = '';
      const typeCharacter = (index) => {
        if (index >= answer.length || cancelTokenRef.current?.token.reason) {
          setMessages(prev => [
            ...prev.slice(0, -1),
            { text: currentText, isUser: false, relatedQuestions: limitedQuestions },
          ]);
          setIsResponding(false);
          cancelTokenRef.current = null;
          saveChat(currentQuery, answer);
          return;
        }
        currentText += answer[index];
        setMessages(prev => [
          ...prev.slice(0, -1),
          { text: currentText, isUser: false, relatedQuestions: limitedQuestions },
        ]);
        requestAnimationFrame(() => typeCharacter(index + 1));
      };

      setMessages(prev => [
        ...prev,
        { text: '', isUser: false, relatedQuestions: limitedQuestions },
      ]);
      typeCharacter(0);
    } catch (err) {
      if (axios.isCancel(err)) {
        setMessages(prev => [...prev, { text: 'Response was cancelled.', isUser: false }]);
      } else {
        setMessages(prev => [...prev, { text: `Error: ${err.message}`, isUser: false }]);
      }
      setIsResponding(false);
      cancelTokenRef.current = null;
    }
  };

  const handleStop = () => {
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel();
      setMessages(prev => [...prev, { text: 'Response stopped.', isUser: false }]);
      setIsResponding(false);
      cancelTokenRef.current = null;
    }
  };

  const handleNewChat = () => {
    setMessages([{ text: 'New chat started.', isUser: false, isSystem: true }]);
    loadChatHistory();
  };

  const handleDeleteChat = async (chat) => {
    try {
      await axios.delete('http://localhost:5000/api/chat/delete', {
        data: { username, query: chat.query, date: chat.date },
      });
      setMessages([{ text: 'New chat started.', isUser: false, isSystem: true }]);
      await loadChatHistory();
    } catch (err) {
      console.error('Error deleting chat:', err.response?.data || err.message);
      alert('Failed to delete chat. Check console for details.');
    }
  };

  const handleSelectChat = (chat) => {
    setMessages([
      { text: chat.query, isUser: true },
      { text: chat.response, isUser: false },
    ]);
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleRelatedQuestionClick = async (question) => {
    if (isResponding) return;
    setQuery(question);
    setTimeout(() => {
      handleQuery();
    }, 100);
  };

  const handleLogout = () => {
    navigate('/');
  };

  const initials = username?.slice(0, 2).toUpperCase() || '??';

  return (
    <div className="employee-container">
      <div className="title-bar">
        <button
          className={`hamburger-menu ${isSidebarOpen ? 'active' : ''}`}
          onClick={toggleSidebar}
          aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={isSidebarOpen}
          aria-controls="app-sidebar"
        >
          <div className="hamburger-bar"></div>
          <div className="hamburger-bar"></div>
          <div className="hamburger-bar"></div>
        </button>
        <div className="title-bar-logo">
          <div className="logo-circle"></div>
          <span className="title-text">BLINK Dashboard</span>
        </div>
        <div className="user-profile">
          <span className="user-profile-text">Welcome, {username}</span>
          <button
            className="profile-button"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-label="User profile menu"
          >
            <span className="profile-initials">{initials}</span>
          </button>
        </div>
      </div>

      <div
        id="app-sidebar"
        ref={sidebarRef}
        className={`sidebar ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
        role="navigation"
        aria-label="Chat history and navigation"
      >
        <button
          className="primary-button new-chat-button"
          onClick={handleNewChat}
          aria-label="Start new chat"
        >
          + NEW CHAT
        </button>

        <div className="chat-history-header">
          <span className="chat-history-title">Recent Conversations</span>
          <button
            className="delete-chat-button"
            onClick={() => chatHistory[0] && handleDeleteChat(chatHistory[0])}
            disabled={!chatHistory.length}
            aria-label="Delete most recent chat"
          >
            Delete
          </button>
        </div>

        <div className="chat-history" role="list">
          {chatHistory.length > 0 ? (
            chatHistory.map((chat, index) => (
              <div
                key={index}
                className={`chat-history-item ${index === 0 ? 'selected' : ''}`}
                onClick={() => handleSelectChat(chat)}
                role="listitem"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleSelectChat(chat);
                  }
                }}
              >
                <div className="chat-history-query">{chat.query}</div>
                <div className="chat-history-response">
                  {chat.response.slice(0, 80) + (chat.response.length > 80 ? '...' : '')}
                </div>
              </div>
            ))
          ) : (
            <div className="no-history-message">No chat history available</div>
          )}
        </div>
      </div>

      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className={`chat-area ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="chat-messages" ref={chatContainerRef} role="log" aria-live="polite">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.isUser ? 'user' : 'bot'} ${msg.isSystem ? 'system' : ''}`}>
              {msg.text}
              {!msg.isUser && msg.relatedQuestions && msg.relatedQuestions.length > 0 && (
                <div className="related-questions">
                  <div className="related-questions-title">Related questions:</div>
                  {msg.relatedQuestions.map((q, i) => (
                    <button
                      key={i}
                      className="related-question-button"
                      onClick={() => handleRelatedQuestionClick(q)}
                      disabled={isResponding}
                      aria-label={`Ask related question: ${q}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="input-area">
          <input
            className="query-input"
            placeholder="Ask a policy question..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleQuery();
              }
            }}
            disabled={!isConnected || isResponding}
            aria-label="Query input"
          />
          <button
            className="primary-button ask-button"
            onClick={handleQuery}
            disabled={!isConnected || isResponding || !query.trim()}
            aria-label="Send query"
          >
            {isResponding ? 'SENDING...' : 'SEND'}
          </button>
          {isResponding && (
            <button
              className="stop-button"
              onClick={handleStop}
              aria-label="Stop response"
            >
              STOP
            </button>
          )}
        </div>
      </div>

      {profileOpen && (
        <div className="profile-popup" onClick={() => setProfileOpen(false)}>
          <div className="profile-popup-content" onClick={e => e.stopPropagation()}>
            <div className="profile-popup-header">
              <div className="profile-popup-image">
                <span className="profile-popup-initials">{initials}</span>
              </div>
              <div className="profile-popup-info">
                <span className="profile-popup-name">{username}</span>
                <span className="profile-popup-role">{position}</span>
              </div>
            </div>
            <div className="connection-status">
              <span className="connection-status-text">Connected:</span>
              <div className={`connection-status-led ${isConnected ? 'connected' : 'disconnected'}`}></div>
            </div>
            <button className="logout-button" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;