import React, { useState, useEffect } from 'react';
import { Save, Check } from 'lucide-react';

interface ConfigurationFormProps {
  onConfigSaved: () => void;
}

interface Config {
  livekitApiKey: string;
  livekitSecretKey: string;
  livekitServerUrl: string;
  sttProvider: string;
  sttApiKey: string;
  llmProvider: string;
  llmApiKey: string;
  ttsProvider: string;
  ttsApiKey: string;
}

export const ConfigurationForm: React.FC<ConfigurationFormProps> = ({ onConfigSaved }) => {
  const [config, setConfig] = useState<Config>({
    livekitApiKey: '',
    livekitSecretKey: '',
    livekitServerUrl: '',
    sttProvider: '',
    sttApiKey: '',
    llmProvider: '',
    llmApiKey: '',
    ttsProvider: '',
    ttsApiKey: '',
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const savedConfig = localStorage.getItem('livekit-config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
  }, []);

  const sttProviders = ['AssemblyAI', 'Deepgram', 'Whisper'];
  const llmProviders = ['OpenAI', 'Anthropic', 'Gemini'];
  const ttsProviders = ['ElevenLabs', 'Azure', 'OpenAI'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      localStorage.setItem('livekit-config', JSON.stringify(config));
      setSuccess(true);
      onConfigSaved();

      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-6">Configuration</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              LiveKit API Key
            </label>
            <input
              type="text"
              value={config.livekitApiKey}
              onChange={(e) => setConfig({ ...config, livekitApiKey: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="Enter LiveKit API Key"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              LiveKit Secret Key
            </label>
            <input
              type="password"
              value={config.livekitSecretKey}
              onChange={(e) => setConfig({ ...config, livekitSecretKey: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="Enter LiveKit Secret Key"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              LiveKit Server URL
            </label>
            <input
              type="url"
              value={config.livekitServerUrl}
              onChange={(e) => setConfig({ ...config, livekitServerUrl: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="wss://your-server.livekit.cloud"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Speech-to-Text Provider
            </label>
            <select
              value={config.sttProvider}
              onChange={(e) => setConfig({ ...config, sttProvider: e.target.value, sttApiKey: '' })}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              required
            >
              <option value="">Select STT Provider</option>
              {sttProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
            {config.sttProvider && (
              <input
                type="password"
                value={config.sttApiKey}
                onChange={(e) => setConfig({ ...config, sttApiKey: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent mt-3"
                placeholder={`${config.sttProvider} API Key`}
                required
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              LLM Provider
            </label>
            <select
              value={config.llmProvider}
              onChange={(e) => setConfig({ ...config, llmProvider: e.target.value, llmApiKey: '' })}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              required
            >
              <option value="">Select LLM Provider</option>
              {llmProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
            {config.llmProvider && (
              <input
                type="password"
                value={config.llmApiKey}
                onChange={(e) => setConfig({ ...config, llmApiKey: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent mt-3"
                placeholder={`${config.llmProvider} API Key`}
                required
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Text-to-Speech Provider
            </label>
            <select
              value={config.ttsProvider}
              onChange={(e) => setConfig({ ...config, ttsProvider: e.target.value, ttsApiKey: '' })}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              required
            >
              <option value="">Select TTS Provider</option>
              {ttsProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
            {config.ttsProvider && (
              <input
                type="password"
                value={config.ttsApiKey}
                onChange={(e) => setConfig({ ...config, ttsApiKey: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent mt-3"
                placeholder={`${config.ttsProvider} API Key`}
                required
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-6 py-2 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>

          {success && (
            <div className="flex items-center gap-2 text-green-400">
              <Check className="w-5 h-5" />
              <span>Configuration saved successfully!</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
