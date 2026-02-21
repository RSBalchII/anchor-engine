import React from 'react';

interface GlassPanelProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '', style, onClick }) => {
    return (
        <div
            className={`glass-panel ${className}`}
            style={style}
            onClick={onClick}
        >
            {children}
        </div>
    );
};
