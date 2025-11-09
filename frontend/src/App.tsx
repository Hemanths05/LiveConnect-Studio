import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { Playground } from './pages/Playground';
import { Configuration } from './pages/Configuration';
import { Layout } from './components/Layout';

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'playground' | 'configuration'>('dashboard');
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');

  if (!isAuthenticated) {
    if (authView === 'signup') {
      return (
        <Signup
          onSignupSuccess={() => setCurrentView('dashboard')}
          onSwitchToLogin={() => setAuthView('login')}
        />
      );
    }
    return (
      <Login
        onLoginSuccess={() => setCurrentView('dashboard')}
        onSwitchToSignup={() => setAuthView('signup')}
      />
    );
  }

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      {currentView === 'dashboard' && <Dashboard />}
      {currentView === 'playground' && <Playground />}
      {currentView === 'configuration' && <Configuration />}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
