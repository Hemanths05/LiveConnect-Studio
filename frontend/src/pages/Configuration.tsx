import React from 'react';
import { ConfigurationForm } from '../components/ConfigurationForm';

export const Configuration: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h1 className="text-3xl font-bold text-white mb-6">Configuration</h1>
        <p className="text-slate-300 mb-8">
          Configure your LiveKit settings and API keys to get started with the playground.
        </p>
        <ConfigurationForm onConfigSaved={() => {}} />
      </div>
    </div>
  );
};
