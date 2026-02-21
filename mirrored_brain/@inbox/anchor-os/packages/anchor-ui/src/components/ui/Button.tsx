import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'ghost' | 'icon';
    active?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    active = false,
    className = '',
    style,
    ...props
}) => {
    let baseClass = '';
    const customStyles: React.CSSProperties = { ...style };

    if (variant === 'primary') {
        baseClass = 'btn-primary';
        if (active) {
            // Manual override for 'active' state if needed, or rely on external CSS
            customStyles.filter = 'brightness(1.2)';
        }
    } else if (variant === 'ghost') {
        // Transparent button, often used for toggles or secondary actions
        customStyles.background = active ? 'rgba(255,255,255,0.1)' : 'transparent';
        customStyles.border = active ? '1px solid var(--border-subtle)' : 'none';
        customStyles.cursor = 'pointer';
        customStyles.color = 'var(--text-dim)';
    } else if (variant === 'icon') {
        // Pure icon button (like the close 'X')
        customStyles.background = 'transparent';
        customStyles.border = 'none';
        customStyles.cursor = 'pointer';
        customStyles.padding = 0;
        customStyles.color = 'var(--text-dim)';
    }

    return (
        <button
            className={`${baseClass} ${className}`}
            style={customStyles}
            {...props}
        >
            {children}
        </button>
    );
};
