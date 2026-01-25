import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    variant?: 'glass' | 'range' | 'checkbox';
    label?: string; // Optional label for checkboxes/ranges
}

export const Input: React.FC<InputProps> = ({
    variant = 'glass',
    className = '',
    label,
    style,
    ...props
}) => {
    if (variant === 'range') {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                {label && <span style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{label}</span>}
                <input
                    type="range"
                    className={className}
                    style={{ flex: 1, minWidth: '50px', ...style }}
                    {...props}
                />
            </div>
        );
    }

    if (variant === 'checkbox') {
        return (
            <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', cursor: 'pointer', ...style }}>
                <input type="checkbox" className={className} {...props} />
                {label && <span style={{ fontSize: '0.8rem', fontWeight: props.checked ? 'bold' : 'normal', color: props.checked ? 'var(--accent-primary)' : 'var(--text-dim)' }}>{label}</span>}
            </label>
        );
    }

    // Default 'glass' text input
    return (
        <input
            className={`input-glass ${className}`}
            style={style}
            {...props}
        />
    );
};
