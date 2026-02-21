import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassPanel } from '../ui/GlassPanel';
import { Button } from '../ui/Button';

export const PathManager = () => {
    const [paths, setPaths] = useState<string[]>([]);
    const [newPath, setNewPath] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPaths = async () => {
        try {
            const response = await api.getPaths();
            if (response.paths) {
                setPaths(response.paths);
            }
        } catch (err) {
            console.error('Failed to fetch paths', err);
        }
    };

    useEffect(() => {
        fetchPaths();
    }, []);

    const handleAddPath = async () => {
        if (!newPath.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.addPath(newPath);
            if (res.status === 'success') {
                setNewPath('');
                fetchPaths();
            } else {
                setError(res.message || 'Failed to add path');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to add path');
        } finally {
            setLoading(false);
        }
    };

    const handleRemovePath = async (pathToRemove: string) => {
        if (!confirm(`Are you sure you want to stop watching this path?\n\n${pathToRemove}\n\nNote: Existing data will remain in the database.`)) return;

        setLoading(true);
        setError(null);
        try {
            const res = await api.removePath(pathToRemove);
            if (res.status === 'success') {
                fetchPaths();
            } else {
                setError(res.message || 'Failed to remove path');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to remove path');
        } finally {
            setLoading(false);
        }
    };

    return (
        <GlassPanel className="path-manager-container" style={{ margin: '1rem', padding: '1rem', height: 'calc(100% - 2rem)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>Corpus Ingestion Paths</h2>
                <Button onClick={() => window.location.hash = '#dashboard'} style={{ fontSize: '0.8rem', padding: '0.4rem', border: '1px solid var(--border-subtle)' }}>
                    ⬅ Back to Dashboard
                </Button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                    type="text"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="Enter absolute path to watch (e.g. C:\Users\Name\Docs)"
                    style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border-subtle)',
                        color: 'white',
                        borderRadius: '4px'
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPath()}
                />
                <Button onClick={handleAddPath} disabled={loading || !newPath}>
                    {loading ? 'Adding...' : 'Add Path'}
                </Button>
            </div>

            {error && <div style={{ color: '#ff6b6b', padding: '0.5rem', background: 'rgba(255,0,0,0.1)', borderRadius: '4px' }}>{error}</div>}

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h3 style={{ margin: '0.5rem 0', color: 'var(--text-secondary)' }}>Active Watchers</h3>
                {paths.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'gray' }}>No paths configured. Defaulting to Internal Notebook.</div>
                ) : (
                    paths.map((path, idx) => (
                        <div key={idx} style={{
                            padding: '0.8rem',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                📁 <span style={{ fontFamily: 'monospace' }}>{path}</span>
                            </div>

                            {path.includes('notebook') ? (
                                <span style={{ fontSize: '0.7rem', background: 'var(--accent-primary)', padding: '0.2rem 0.4rem', borderRadius: '4px', opacity: 0.8 }}>SYSTEM</span>
                            ) : (
                                <Button
                                    onClick={() => handleRemovePath(path)}
                                    disabled={loading}
                                    style={{
                                        fontSize: '0.7rem',
                                        padding: '0.2rem 0.5rem',
                                        background: 'rgba(255, 100, 100, 0.2)',
                                        border: '1px solid rgba(255, 100, 100, 0.4)',
                                        color: '#ffaaaa'
                                    }}
                                >
                                    Remove
                                </Button>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(255,255,0,0.05)', borderRadius: '4px', fontSize: '0.9rem', color: '#ccc' }}>
                ℹ️ <strong>Note:</strong> Adding a path will trigger the Watchdog to scan recursively.
                Files in these directories will be atomized and ingested into the Knowledge Graph.
                The system watches for changes in real-time.
            </div>
        </GlassPanel>
    );
};
