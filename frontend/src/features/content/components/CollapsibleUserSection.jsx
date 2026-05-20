import React, { useState } from 'react';
import { STYLES, COLORS, formatName } from '../../../design';

/**
 * Collapsible User Section
 * A simple expandable/collapsible container for per-user content
 */
export default function CollapsibleUserSection({
    user,
    subtitle,
    defaultOpen = false,
    children,
    accentColor = COLORS.accent,
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-neutral-200 bg-white">
            {/* Header - Always visible */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-3 p-4 hover:bg-neutral-50 transition-colors text-left"
            >
                {/* Expand/Collapse Icon */}
                <svg
                    className={`w-4 h-4 text-neutral-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>

                {/* User Avatar */}
                <div
                    className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: accentColor }}
                >
                    <span className="font-mono text-[11px] font-bold text-white">
                        {formatName(user, true)}
                    </span>
                </div>

                {/* User Name */}
                <div className="flex-1 min-w-0">
                    <span className={STYLES.userName}>{formatName(user)}</span>
                    {subtitle && (
                        <p className="font-mono text-[11px] text-neutral-400 truncate">
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* Open/Close indicator */}
                <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                    {isOpen ? 'Hide' : 'Show'}
                </span>
            </button>

            {/* Content - Collapsible */}
            {isOpen && (
                <div className="px-4 pb-4 pt-2 border-t border-neutral-100">
                    {children}
                </div>
            )}
        </div>
    );
}
