import React from 'react';
import { LiveKitPlayground } from '../components/LiveKitPlayground';

export const Playground: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">LiveConnect Playground</h1>
        <p className="text-slate-300">
          Connect to a LiveConnect room and interact with AI agents in real-time.
        </p>
      </div>
      <LiveKitPlayground />
    </div>
  );
};
