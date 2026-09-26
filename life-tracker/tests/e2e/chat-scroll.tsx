import React, { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { ChatPage } from '../../src/pages/ChatPage';
import { MainLayout } from '../../src/components/layout/MainLayout';
import { AppearanceContext, type AppearanceContextValue } from '../../src/hooks/appearanceContext';
import '../../src/index.css';
export function Conversation() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => { Object.assign(window, { chatNavigate: navigate }); }, [navigate]);
  return <MainLayout activeTab="messages" hideBottomNav routeKey={location.pathname} onTabChange={() => {}}>
    <Routes><Route path="/messages/:friendId" element={<ChatPage />} /></Routes>
  </MainLayout>;
}
const width = new URLSearchParams(location.search).get('width') ?? 'full';
createRoot(document.getElementById('root')!).render(
  <StrictMode><AppearanceContext.Provider value={{ contentWidthMode: width } as AppearanceContextValue}>
    <MemoryRouter initialEntries={['/messages/friend']}><Conversation /></MemoryRouter>
  </AppearanceContext.Provider></StrictMode>
);
