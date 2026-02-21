import React from 'react';

interface BadgeProps {
    label: string;
    variant?: 'sovereign' | 'external' | 'bucket' | 'tag';
    onClick?: () => void;
    className?: string;
    active?: boolean;
    style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
    label,
    variant = 'external',
    onClick,
    className = '',
    active = false,
    style: customStyle = {}
}) => {
    let baseClass = 'badge';
    let style: React.CSSProperties = { cursor: onClick ? 'pointer' : 'default', ...customStyle };

    if (variant === 'sovereign') {
        baseClass += ' badge-sovereign';
    } else if (variant === 'external') {
        baseClass += ' badge-external';
    } else if (variant === 'bucket') {
        // Custom style for buckets from App.tsx
        style = {
            ...style,
            background: active
                ? 'rgba(100, 108, 255, 0.4)'
                : 'rgba(100, 108, 255, 0.2)',
            color: active ? '#c7d2fe' : '#a5b4fc',
            fontSize: '0.65rem',
            padding: '0.1rem 0.4rem',
            borderRadius: '8px'
        };
    } else if (variant === 'tag') {
        // Custom style for tags from App.tsx
        style = {
            ...style,
            background: active
                ? 'rgba(236, 72, 153, 0.3)'
                : 'rgba(236, 72, 153, 0.15)',
            color: active ? '#fbcfe8' : '#f9a8d4',
            fontSize: '0.65rem',
            padding: '0.1rem 0.4rem',
            borderRadius: '8px'
        };
    }

    return (
        <span
            className={`${baseClass} ${active ? 'active' : ''} ${className}`}
            onClick={onClick}
            style={style}
        >
            {variant === 'bucket' || variant === 'tag' ? `#${label}` : label}
        </span>
    );
};
