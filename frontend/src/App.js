import React, { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import SplashScreen from './components/SplashScreen';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import EmployeeDashboard from './components/EmployeeDashboard';
import './App.css';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  const router = createBrowserRouter(
    [
      { path: '/', element: <Login /> },
      { path: '/admin', element: <AdminDashboard /> },
      { path: '/employee', element: <EmployeeDashboard /> },
    ],
    {
      future: {
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      },
    }
  );

  return (
    <div className="app-container">
      {showSplash ? (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      ) : (
        <RouterProvider router={router} />
      )}
    </div>
  );
}

export default App;