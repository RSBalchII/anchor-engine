
import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassPanel } from '../ui/GlassPanel';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface QuarantinedAtom {
    id: string;
    content: string;
    source: string;
    timestamp: number;
    tags: string[];
    provenance: string;
}

export const QuarantinePage = () => {
    const [atoms, setAtoms] = useState<QuarantinedAtom[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadQuarantined();
    }, []);

    const loadQuarantined = async () => {
        setLoading(true);
        try {
            const data = await api.getQuarantined();
            setAtoms(data || []);
        } catch (e) {
            console.error(e);
            alert('Failed to load quarantined items.');
        } finally {
            setLoading(false);
        }
    };

    const handleCure = async (id: string) => {
        if (!confirm('Restore this atom to the active graph?')) return;
        try {
            await api.cureAtom(id);
            setAtoms(prev => prev.filter(a => a.id !== id));
        } catch (e) {
            console.error(e);
            alert('Failed to restore atom.');
        }
    };



    return (
        <GlassPanel style={{ margin: '1rem', padding: '1rem', height: 'calc(100% - 2rem)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>☣️ Infection Center</h2>
                <Button onClick={loadQuarantined}>Refresh</Button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-dim)' }}>Scanning for infections...</div>
                ) : atoms.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                        <h3>No Active Infections</h3>
                        <p>The graph is healthy. No atoms are currently in quarantine.</p>
                    </div>
                ) : (
                    atoms.map(atom => (
                        <GlassPanel key={atom.id} style={{ padding: '1rem', background: 'rgba(255, 50, 50, 0.05)', border: '1px solid rgba(255, 50, 50, 0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <Badge label="QUARANTINED" style={{ background: 'var(--accent-danger)', color: 'white' }} />
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{atom.source}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <Button onClick={() => handleCure(atom.id)} style={{ fontSize: '0.8rem', background: 'var(--accent-success)', color: 'white', border: 'none' }}>
                                        💉 CURE
                                    </Button>
                                    {/* <Button onClick={() => handleDelete(atom.id)} variant="ghost" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>CMD.DEL</Button> */}
                                </div>
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', maxHeight: '200px', overflowY: 'auto' }}>
                                {atom.content}
                            </div>
                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                {atom.tags.map(t => (
                                    <Badge key={t} label={t} style={{ opacity: 0.7 }} />
                                ))}
                            </div>
                        </GlassPanel>
                    ))
                )}
            </div>
        </GlassPanel>
    );
};
