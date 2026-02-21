import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { getAvailableModels } from '../../config/web-llm-models';
import { verifyModel, getDeviceInfo } from '../../services/model-verifier';

interface ModelInfo {
  id: string;
  name: string;
  size?: number;
  path?: string;
  vram_required_MB?: number;
  low_resource_required?: boolean;
}

interface ModelSelectorProps {
  onModelChange: (modelId: string) => void;
  currentModel: string;
  isRemote: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange, currentModel, isRemote }) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<{ gpu_name: string; vram_estimate_MB: number; is_integrated: boolean } | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ model_id: string; compatible: boolean; vram_required_MB: number; estimated_load_time: string; warnings: string[] } | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!isRemote) {
          // --- LOCAL: WebLLM Models ---
          const webModels = getAvailableModels().map(m => ({
            id: m.model_id,
            name: m.model_id,
            path: m.model_id,
            vram_required_MB: m.vram_required_MB,
            low_resource_required: m.low_resource_required
          }));
          setModels(webModels);
          
          // Get device info for VRAM warnings
          const info = await getDeviceInfo();
          setDeviceInfo(info);
          
          // If current model is not in the new list, select the first one
          if (webModels.length > 0 && !webModels.some(m => m.id === currentModel)) {
            onModelChange(webModels[0].id);
          }
        } else {
          // --- REMOTE: Inference Server Models ---
          const response = await api.getModels();
          let dataToMap = [];
          if (Array.isArray(response)) {
            dataToMap = response;
          } else if (response && Array.isArray(response.data)) {
            dataToMap = response.data;
          }

          const formattedModels = dataToMap.map((model: any) => ({
            id: typeof model === 'string' ? model : model.id || model.name || model,
            name: typeof model === 'string' ? model : model.name || model.id || model,
            path: typeof model === 'string' ? model : model.path,
          }));

          setModels(formattedModels);
          // If current model is not in the new list, select the first one
          if (formattedModels.length > 0 && !formattedModels.some((m: any) => m.id === currentModel)) {
            onModelChange(formattedModels[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
        setError('Failed to load models.');
        if (isRemote) {
          setModels([{ id: 'default', name: 'Default Model (GLM-4)', path: 'default' }]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [isRemote]);

  const handleVerify = async (e: React.MouseEvent) => {
    e.preventDefault();
    const model = getAvailableModels().find(m => m.model_id === currentModel);
    if (!model) return;

    setVerifying(currentModel);
    setVerificationResult(null);
    
    try {
      const result = await verifyModel(model);
      setVerificationResult(result);
    } catch (err) {
      console.error('Verification failed:', err);
      setVerificationResult({
        model_id: currentModel,
        compatible: false,
        vram_required_MB: 0,
        estimated_load_time: "N/A",
        warnings: ['Verification failed']
      });
    } finally {
      setVerifying(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedModelId = e.target.value;
    onModelChange(selectedModelId);
    setVerificationResult(null); // Clear verification when model changes
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-500"></div>
        <span className="ml-2 text-xs text-gray-500">Loading models...</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <label htmlFor="model-select" className="block text-xs font-mono uppercase tracking-wider text-gray-500">
        Select Model
      </label>
      <div className="flex gap-2">
        <select
          id="model-select"
          value={currentModel}
          onChange={handleChange}
          className="flex-1 bg-black/50 border border-gray-700/50 rounded-md px-3 py-2 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono text-xs text-cyan-100"
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} {model.vram_required_MB && `(${Math.round(model.vram_required_MB / 1024)}GB VRAM)`}
            </option>
          ))}
        </select>
        {!isRemote && (
          <button
            onClick={handleVerify}
            disabled={verifying !== null}
            className="px-3 py-2 bg-cyan-600/20 border border-cyan-500/30 rounded-md text-xs font-mono text-cyan-100 hover:bg-cyan-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {verifying === currentModel ? 'Checking...' : 'Verify'}
          </button>
        )}
      </div>
      
      {/* Device Info */}
      {deviceInfo && !isRemote && (
        <div className="text-xs font-mono text-gray-400">
          GPU: {deviceInfo.gpu_name} • VRAM: ~{Math.round(deviceInfo.vram_estimate_MB / 1024)}GB {deviceInfo.is_integrated ? '(Integrated)' : '(Dedicated)'}
        </div>
      )}
      
      {/* Verification Result */}
      {verificationResult && (
        <div className={`p-2 rounded-md text-xs font-mono ${verificationResult.compatible ? 'bg-green-900/20 border border-green-500/30' : 'bg-red-900/20 border border-red-500/30'}`}>
          <div className="font-bold mb-1">
            {verificationResult.compatible ? '✓ Compatible' : '✗ Not Compatible'}
          </div>
          <div className="space-y-1">
            <div>VRAM Required: {Math.round(verificationResult.vram_required_MB / 1024)}GB</div>
            <div>Est. Load Time: {verificationResult.estimated_load_time}</div>
            {verificationResult.warnings.length > 0 && (
              <div className="text-yellow-500 mt-1">
                {verificationResult.warnings.map((w, i) => (
                  <div key={i}>⚠ {w}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-1 text-xs text-red-500 font-mono">
          {error}
        </div>
      )}
    </div>
  );
};