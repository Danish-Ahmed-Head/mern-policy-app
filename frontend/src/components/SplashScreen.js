import React, { useEffect } from 'react';
import '../App.css';

const SplashScreen = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="splash-container">
      <div className="background-canvas">
        <div className="ball ball-1"></div>
        <div className="ball ball-2"></div>
        <div className="ball ball-3"></div>
      </div>
      <img src="/logo.gif" alt="Splash GIF" className="splash-gif" />
    </div>
  );
};

export default SplashScreen;