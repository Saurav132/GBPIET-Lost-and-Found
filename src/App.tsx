import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';

const Feed = lazy(() => import('./pages/Feed').then(m => ({ default: m.Feed })));
const PostItem = lazy(() => import('./pages/PostItem').then(m => ({ default: m.PostItem })));
const ItemDetail = lazy(() => import('./pages/ItemDetail').then(m => ({ default: m.ItemDetail })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Chats = lazy(() => import('./pages/Chats').then(m => ({ default: m.Chats })));
const Leaderboard = lazy(() => import('./pages/Leaderboard').then(m => ({ default: m.Leaderboard })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useAuth();
  
  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center">Loading...</div>;
  }
  
  if (!user || userData?.isRestricted) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster 
        position="top-center" 
        toastOptions={{ 
          style: { 
            background: '#1e293b', 
            color: '#fff', 
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            boxShadow: '0 0 20px rgba(6,182,212,0.1)'
          } 
        }} 
      />
      <Router>
        <Suspense fallback={<div className="flex h-[50vh] items-center justify-center"><div className="animate-pulse flex items-center justify-center space-x-2"><div className="w-4 h-4 bg-primary rounded-full"></div><div className="w-4 h-4 bg-primary rounded-full animation-delay-200"></div><div className="w-4 h-4 bg-primary rounded-full animation-delay-400"></div></div></div>}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Feed />} />
              <Route path="item/:id" element={<ItemDetail />} />
              <Route 
                path="post" 
                element={
                  <ProtectedRoute>
                    <PostItem />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="profile/:id" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="chats" 
                element={
                  <ProtectedRoute>
                    <Chats />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="admin" 
                element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                } 
              />
              <Route path="leaderboard" element={<Leaderboard />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}
