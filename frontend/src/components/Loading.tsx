import React from 'react';
import '../styles/AppLayout.css';

interface LoadingProps {
  message?: string;
}

const Loading: React.FC<LoadingProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="app-loading">
      <div className="loading-spinner"></div>
      <p>{message}</p>
    </div>
  );
};

export default Loading;

