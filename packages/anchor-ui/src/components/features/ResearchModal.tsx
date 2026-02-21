
import React, { useState } from 'react';
import { api } from '../../services/api';
import { GlassPanel } from '../ui/GlassPanel';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import TurndownService from 'turndown';

interface ResearchModalProps {
    onClose: () => void;
}

export const ResearchModal: React.FC<ResearchModalProps> = ({ onClose }) => {
    const [tab, setTab] = useState<'search' | 'direct' | 'file'>('search');
    const [webQuery, setWebQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // File Parsing State
    const [parsedContent, setParsedContent] = useState('');
    const [originalFileName, setOriginalFileName] = useState('');

    const handleWebSearch = async () => {
        if (!webQuery.trim()) return;
        setLoading(true);
        try {
            const data = await api.research(webQuery);
            setResults(Array.isArray(data) ? data : []);
        } catch { alert('Search Failed'); }
        finally { setLoading(false); }
    };

    const handleSave = async (url: string) => {
        try {
            const res = await api.scrape(url, 'article');
            if (res.success) alert("Saved!"); else alert("Error: " + (res.error || "Unknown error"));
        } catch (e: any) { alert(e.message); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        console.log(`[Research] File selected: ${file.name} (${file.size} bytes)`);
        setOriginalFileName(file.name.replace(/\.[^/.]+$/, ""));

        const text = await file.text();
        console.log(`[Research] File loaded. Size: ${text.length} chars`);

        // Robust HTML Parsing: Extract main bodies
        let contentToConvert = text;
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            // Minimal cleaning - only remove dangerous/noisy logic, keep structure
            const toRemove = ['script', 'style', 'noscript', 'iframe', 'svg'];
            toRemove.forEach(tag => {
                const elements = doc.querySelectorAll(tag);
                if (elements.length > 0) console.log(`[Research] Removing ${elements.length} <${tag}> tags`);
                elements.forEach(el => el.remove());
            });

            // Get body content or fallback to full doc
            if (doc.body) {
                contentToConvert = doc.body.innerHTML;
                console.log(`[Research] Extracted body content. Size: ${contentToConvert.length}`);
            } else {
                contentToConvert = doc.documentElement.innerHTML;
                console.log(`[Research] Extracted documentElement content. Size: ${contentToConvert.length}`);
            }
        } catch (e) {
            console.warn("[Research] DOM Parser warning:", e);
        }

        // Convert HTML to Markdown
        const turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
            emDelimiter: '*'
        });

        turndownService.remove(['script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'header']);

        // Turndown settings to keep more content
        turndownService.keep(['table', 'div', 'span', 'p']);

        let md = turndownService.turndown(contentToConvert);
        console.log(`[Research] Turndown output size: ${md.length}`);

        // Fallback if MD is empty (e.g. maybe it was just text?)
        // Explicitly check for empty or just whitespace
        if (!md || md.trim().length === 0) {
            console.warn("[Research] Empty markdown detected. Falling back to raw text.");
            md = `> **Note**: Content conversion resulted in empty output. Showing raw text.\n\n${text}`;
        }

        const cleanMd = `# ${file.name}\n\n${md}`;
        setParsedContent(cleanMd);
    };

    const handleSaveParsed = async () => {
        if (!parsedContent) return;
        try {
            const filename = `${originalFileName}_parsed_${Date.now()}.md`;
            await api.uploadRaw(parsedContent, filename);
            alert(`Saved as ${filename}`);
            setParsedContent('');
        } catch (e: any) {
            alert('Upload failed: ' + e.message);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <GlassPanel style={{ width: '800px', height: '700px', padding: '1.5rem', background: '#1a1a1a', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h3>Research Station</h3>
                    <Button variant="icon" onClick={onClose} style={{ fontSize: '1.2rem', color: 'white' }}>✕</Button>
                </div>
                <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #333' }}>
                    <Button variant="ghost" onClick={() => setTab('search')} style={{ borderBottom: tab === 'search' ? '2px solid white' : 'none', borderRadius: 0, color: 'white' }}>Web Search</Button>
                    <Button variant="ghost" onClick={() => setTab('direct')} style={{ borderBottom: tab === 'direct' ? '2px solid white' : 'none', borderRadius: 0, color: 'white' }}>Direct URL</Button>
                    <Button variant="ghost" onClick={() => setTab('file')} style={{ borderBottom: tab === 'file' ? '2px solid white' : 'none', borderRadius: 0, color: 'white' }}>Parse File</Button>
                </div>

                {tab === 'search' && (
                    <>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Input value={webQuery} onChange={e => setWebQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleWebSearch()} placeholder="Query..." />
                            <Button onClick={handleWebSearch} disabled={loading}>{loading ? '...' : 'Go'}</Button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {results.map((r, i) => (
                                <div key={i} style={{ padding: '0.8rem', background: '#222', borderRadius: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ color: '#8b5cf6', fontWeight: 'bold' }}>{r.title}</a>
                                        <Button variant="ghost" onClick={() => handleSave(r.link)} style={{ fontSize: '0.7rem' }}>💾</Button>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{r.snippet}</div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {tab === 'direct' && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <Input id="direct-url" placeholder="https://..." />
                        <Button onClick={() => {
                            const val = (document.getElementById('direct-url') as HTMLInputElement).value;
                            if (val) handleSave(val);
                        }}>Scrape & Save</Button>
                    </div>
                )}

                {tab === 'file' && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                        <div style={{ padding: '1rem', border: '1px dashed #444', borderRadius: '4px', textAlign: 'center' }}>
                            <input
                                type="file"
                                accept=".html,.htm,.txt"
                                onChange={handleFileUpload}
                                style={{ display: 'block', margin: '0 auto' }}
                            />
                            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#888' }}>
                                Select an HTML file to clean and convert to Markdown
                            </div>
                        </div>

                        {parsedContent && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Preview ({parsedContent.length} chars)</span>
                                    <Button onClick={handleSaveParsed}>Save to Context</Button>
                                </div>
                                <textarea
                                    style={{
                                        flex: 1,
                                        background: '#111',
                                        color: '#eee',
                                        padding: '1rem',
                                        border: '1px solid #333',
                                        fontFamily: 'monospace',
                                        resize: 'none'
                                    }}
                                    value={parsedContent}
                                    onChange={(e) => setParsedContent(e.target.value)}
                                />
                            </>
                        )}
                    </div>
                )}
            </GlassPanel>
        </div>
    );
};
