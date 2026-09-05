import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage'; // <-- CHANGED
import { ComingSoon } from './components/layout/ComingSoon';
import { AuthPage } from './pages/AuthPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Route: Login Page */}
        <Route path="/login" element={<AuthPage />} />
        
        {/* Protected Routes: Wrapped in AppLayout */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} /> {/* <-- CHANGED */}
          <Route path="/explore" element={<ComingSoon />} />
          <Route path="/notifications" element={<ComingSoon />} />
          <Route path="/messages" element={<ComingSoon />} />
          <Route path="/account" element={<ComingSoon />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;