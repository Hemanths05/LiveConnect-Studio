import React, { useState, useEffect } from 'react';
import {
  Activity,
  Clock,
  Zap,
  TrendingUp,
  MessageSquare,
  Mic,
  Volume2,
} from 'lucide-react';

interface UsageStats {
  totalTokens: number;
  totalDuration: number;
  sttTokens: number;
  llmTokens: number;
  ttsTokens: number;
  sessionsCount: number;
  avgSessionDuration: number;
  peakUsageHour: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, color }) => {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold text-white mb-2">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 text-green-400 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>{trend}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<UsageStats>({
    totalTokens: 0,
    totalDuration: 0,
    sttTokens: 0,
    llmTokens: 0,
    ttsTokens: 0,
    sessionsCount: 0,
    avgSessionDuration: 0,
    peakUsageHour: '00:00',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // For now, we'll use mock data since we don't have a stats endpoint
      // You can implement this later when you have actual stats

      // const response = await fetch('/api/stats');
      // if (response.ok) {
      //   const data = await response.json();
      //   setStats(data);
      // }
      const mockStats = {
        totalTokens: 125000,
        totalDuration: 180, // minutes
        sttTokens: 45000,
        llmTokens: 60000,
        ttsTokens: 20000,
        sessionsCount: 24,
        avgSessionDuration: 7.5,
        peakUsageHour: '14:30',
      };
      setStats(mockStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Overview of your LiveConnect Studio usage</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Sessions"
          value={stats.sessionsCount}
          icon={<Activity className="w-6 h-6 text-cyan-400" />}
          trend="+12% from last month"
          color="bg-cyan-500/10"
        />
        <StatCard
          title="Total Duration"
          value={formatDuration(stats.totalDuration)}
          icon={<Clock className="w-6 h-6 text-blue-400" />}
          trend="+8% from last month"
          color="bg-blue-500/10"
        />
        <StatCard
          title="Total Tokens"
          value={formatNumber(stats.totalTokens)}
          icon={<Zap className="w-6 h-6 text-yellow-400" />}
          trend="+15% from last month"
          color="bg-yellow-500/10"
        />
        <StatCard
          title="Avg Session"
          value={formatDuration(stats.avgSessionDuration)}
          icon={<TrendingUp className="w-6 h-6 text-green-400" />}
          color="bg-green-500/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-6">Token Usage by Provider</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Mic className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Speech-to-Text</p>
                  <p className="text-slate-400 text-sm">Processing audio input</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-lg">
                  {formatNumber(stats.sttTokens)}
                </p>
                <p className="text-slate-400 text-sm">tokens</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Large Language Model</p>
                  <p className="text-slate-400 text-sm">AI responses</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-lg">
                  {formatNumber(stats.llmTokens)}
                </p>
                <p className="text-slate-400 text-sm">tokens</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Volume2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Text-to-Speech</p>
                  <p className="text-slate-400 text-sm">Voice synthesis</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-lg">
                  {formatNumber(stats.ttsTokens)}
                </p>
                <p className="text-slate-400 text-sm">tokens</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-6">Usage Insights</h2>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400">Peak Usage Time</span>
                <span className="text-white font-semibold">{stats.peakUsageHour}</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 w-3/4"></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400">STT Usage</span>
                <span className="text-white font-semibold">
                  {Math.round((stats.sttTokens / stats.totalTokens) * 100 || 0)}%
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  style={{ width: `${(stats.sttTokens / stats.totalTokens) * 100 || 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400">LLM Usage</span>
                <span className="text-white font-semibold">
                  {Math.round((stats.llmTokens / stats.totalTokens) * 100 || 0)}%
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-teal-500"
                  style={{ width: `${(stats.llmTokens / stats.totalTokens) * 100 || 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400">TTS Usage</span>
                <span className="text-white font-semibold">
                  {Math.round((stats.ttsTokens / stats.totalTokens) * 100 || 0)}%
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                  style={{ width: `${(stats.ttsTokens / stats.totalTokens) * 100 || 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-white">Session completed</span>
            </div>
            <span className="text-slate-400 text-sm">2 hours ago</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
              <span className="text-white">Configuration updated</span>
            </div>
            <span className="text-slate-400 text-sm">5 hours ago</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-white">New session started</span>
            </div>
            <span className="text-slate-400 text-sm">1 day ago</span>
          </div>
        </div>
      </div>
    </div>
  );
};
