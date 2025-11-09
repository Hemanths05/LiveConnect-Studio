import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Activity, Play, Video, Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: 'dashboard' | 'playground' | 'configuration';
  onViewChange: (view: 'dashboard' | 'playground' | 'configuration') => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange }) => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <nav className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">LiveConnect Studio</span>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => onViewChange('dashboard')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    currentView === 'dashboard'
                      ? 'bg-cyan-500 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  Dashboard
                </button>
                <button
                  onClick={() => onViewChange('playground')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    currentView === 'playground'
                      ? 'bg-cyan-500 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  Playground
                </button>
                <button
                  onClick={() => onViewChange('configuration')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    currentView === 'configuration'
                      ? 'bg-cyan-500 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Configuration
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm text-slate-400">Signed in as</p>
                <p className="text-sm font-medium text-white">{user?.email}</p>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>

          <div className="md:hidden flex items-center gap-2 pb-3">
            <button
              onClick={() => onViewChange('dashboard')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition ${
                currentView === 'dashboard'
                  ? 'bg-cyan-500 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Activity className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => onViewChange('playground')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition ${
                currentView === 'playground'
                  ? 'bg-cyan-500 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Play className="w-4 h-4" />
              Playground
            </button>
            <button
              onClick={() => onViewChange('configuration')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition ${
                currentView === 'configuration'
                  ? 'bg-cyan-500 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Settings className="w-4 h-4" />
              Config
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};
