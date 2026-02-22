import { useState, useEffect, useCallback, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './App.css';
import PerformanceMonitor from './components/PerformanceMonitor';
import { api } from './services/api';
import { GlassPanel } from './components/ui/GlassPanel';
import { Button } from './components/ui/Button';
import { SearchColumn } from './components/features/SearchColumn';
import { ResearchModal } from './components/features/ResearchModal';
import { QuarantinePage } from './components/features/QuarantinePage';
import { ChatInterface } from './components/Chat/ChatInterface';
import { ModelSelector } from './components/Chat/ModelSelector';
import { PathManager } from './components/features/PathManager';

// Simple Router
const Dashboard = () => (
  <div className="flex-col-center" style={{ height: '100%', justifyContent: 'center', alignItems: 'center', gap: '2rem' }}>
    <h1 style={{ fontSize: '3rem', background: 'linear-gradient(to right, #fff, var(--accent-primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
      Sovereign Context Engine
    </h1>
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      <Button onClick={() => window.location.hash = '#search'}>
        Search Memories
      </Button>
      <Button onClick={() => window.location.hash = '#chat'}>
        Launch Chat
      </Button>

      <Button onClick={() => window.location.hash = '#quarantine'}>
        Infection Center
      </Button>
      <Button onClick={() => window.location.hash = '#taxonomy'}>
        Cortex UI
      </Button>
      <Button onClick={() => window.location.hash = '#paths'}>
        Manage Paths
      </Button>
    </div>
  </div>
);

// --- SEARCH PAGE CONTAINER ---
const SearchPage = ({ isInitializing }: { isInitializing?: boolean }) => {
  const [columns, setColumns] = useState<{ id: number; query?: string }[]>([{ id: 1 }]);

  // Global State
  const [backupStatus, setBackupStatus] = useState('');
  const [showResearch, setShowResearch] = useState(false);
  const [availableBuckets, setAvailableBuckets] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    if (isInitializing) return; // Wait for backend
    Promise.all([
      api.getBuckets().catch(() => []),
      api.getTags().catch(() => [])
    ]).then(([buckets, tags]) => {
      setAvailableBuckets(Array.isArray(buckets) ? buckets : []);
      setAvailableTags(Array.isArray(tags) ? tags : []);
    });
  }, [isInitializing]);

  const addColumn = useCallback((initialQuery?: string) => {
    setColumns(prev => {
      if (prev.length >= 8) return prev;
      const newId = (prev.length > 0 ? Math.max(...prev.map(c => c.id)) : 0) + 1;
      return [...prev, { id: newId, query: initialQuery }];
    });
  }, []);

  const removeColumn = useCallback((id: number) => {
    console.log('[SearchPage] removeColumn called for ID:', id);
    setColumns(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleContextUpdate = useCallback((_id: number, _ctx: string) => {
    // Handle context updates if needed
  }, []);

  const handleFullUpdate = useCallback((_id: number, _full: string) => {
    // Handle full text updates if needed
  }, []);

  const handleBackup = async () => {
    setBackupStatus('Saving...');
    try {
      const data = await api.backup();
      setBackupStatus(`Saved: ${data.filename}`);
      setTimeout(() => setBackupStatus(''), 3000);
    } catch { setBackupStatus('Failed'); }
  };

  return (
    <GlassPanel className="search-page-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

      {/* GLOBAL HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', width: '100%' }}>
        <h2 style={{ margin: 0, minWidth: 'min-content' }}>Memory Command</h2>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 0%', minWidth: 0 }}>
          <Button onClick={() => window.location.hash = '#dashboard'} style={{ fontSize: '0.8rem', padding: '0.4rem', border: '1px solid var(--border-subtle)' }}>
            🏠 Home
          </Button>
          <Button onClick={() => window.location.hash = '#quarantine'} style={{ fontSize: '0.8rem', padding: '0.4rem', border: '1px solid var(--border-subtle)' }}>
            ☣️ Infection
          </Button>

          <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)', margin: '0 0.5rem' }} />

          <Button onClick={handleBackup} style={{ fontSize: '0.8rem', padding: '0.4rem' }}>
            💾 {backupStatus || 'Backup'}
          </Button>
          <Button onClick={() => setShowResearch(true)} style={{ fontSize: '0.8rem', padding: '0.4rem' }}>
            🕵️ Research
          </Button>
          <Button onClick={async () => {
            const d = await api.dream();
            alert(`Dream Analyzed: ${d.analyzed}`);
          }} style={{ background: 'rgba(100, 108, 255, 0.1)', fontSize: '0.8rem', padding: '0.4rem' }}>
            🌙 Dream
          </Button>

          <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)', margin: '0 0.5rem' }} />

          <Button onClick={() => addColumn()} disabled={columns.length >= 8} style={{ fontSize: '1rem', padding: '0.2rem 0.8rem', background: 'var(--accent-primary)', color: 'white' }}>
            +
          </Button>
        </div>
      </div>

      {/* COLUMNS CONTAINER */}
      <div className="search-grid">
        {columns.map(col => (
          <SearchColumn
            key={col.id}
            id={col.id}
            availableBuckets={availableBuckets}
            availableTags={availableTags}
            onContextUpdate={handleContextUpdate}
            onFullUpdate={handleFullUpdate}
            onRemove={removeColumn}
            onAddColumn={addColumn}
            isOnly={columns.length === 1}
            initialQuery={col.query}
          />
        ))}
      </div>

      {/* Research Modal */}
      {showResearch && <ResearchModal onClose={() => setShowResearch(false)} />}
    </GlassPanel>
  );
};

function App() {
  const [hash, setHash] = useState(window.location.hash);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initMessage, setInitMessage] = useState('Connecting to Engine...');

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Poll backend health during startup
  useEffect(() => {
    let pollingInterval: number;
    const checkHealth = async () => {
      try {
        const res = await fetch('/health');
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'starting') {
          setIsInitializing(true);
          setInitMessage(data.message || 'Initializing database...');
        } else {
          setIsInitializing(false);
          clearInterval(pollingInterval);
        }
      } catch (err) {
        setInitMessage('Waiting for connection...');
      }
    };
    checkHealth();
    pollingInterval = window.setInterval(checkHealth, 2000);
    return () => clearInterval(pollingInterval);
  }, []);

  // Persist model and backend choice in localStorage
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('anchor-chat-model') || 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC'; // Best reasoning model
  });
  const [useInferenceServer, setUseInferenceServer] = useState<boolean>(() => {
    const saved = localStorage.getItem('anchor-chat-backend');
    return saved === 'remote'; // Default to false (WebLLM) if not saved
  });

  // Save preferences when they change
  useEffect(() => {
    localStorage.setItem('anchor-chat-model', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('anchor-chat-backend', useInferenceServer ? 'remote' : 'webllm');
  }, [useInferenceServer]);

  if (!hash || hash === '#dashboard') return <Dashboard />;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#050507] overflow-hidden text-gray-300">
      <PerformanceMonitor />

      {isInitializing && (
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          background: 'rgba(5, 5, 7, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-subtle)',
          padding: '0.8rem 1.2rem',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
        }}>
          <div className="animate-spin text-cyan-400" style={{ fontSize: '1.5rem', animationDuration: '3s' }}>⏳</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, color: 'white', fontSize: '0.9rem' }}>Server Starting</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{initMessage}</span>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 1000 }}>
        <Button onClick={() => window.location.hash = '#dashboard'} style={{ fontSize: '1.2rem', padding: '0.4rem 0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
          ←
        </Button>
      </div>

      {hash === '#chat' ? (
        <GlassPanel className="chat-page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', width: '100%' }}>
            <h2 style={{ margin: 0, minWidth: 'min-content' }}>Sovereign Agent Chat</h2>
            <div style={{ width: '300px' }}>
              <ModelSelector
                onModelChange={setSelectedModel}
                currentModel={selectedModel}
                isRemote={useInferenceServer}
              />
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ChatInterface
              model={selectedModel}
              useInferenceServer={useInferenceServer}
              setUseInferenceServer={setUseInferenceServer}
            />
          </div>
        </GlassPanel>
      ) : (
        <>
          {hash === '#search' ? <SearchPage isInitializing={isInitializing} /> :
            hash === '#quarantine' ? <QuarantinePage /> :
              hash === '#paths' ? <PathManager /> :
                <div style={{ padding: '4rem 2rem' }}>🚧 Module "{hash}" Under Construction</div>}
        </>
      )}
    </div>
  );
}

export default App;

// Mount the App since index.html points directly to this file
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);