import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AuthCallback from './pages/AuthCallback.tsx';
import NotFound from './pages/NotFound.tsx';
import Index from './pages/Index.tsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;