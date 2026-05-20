import React from 'react';
import Drawer from '../../../components/Drawer';
import { STYLES, COLORS, formatName } from '../../../design';

/**
 * Detail Drawer Component
 * Reusable right panel for showing message samples and details
 * Used across content analysis sections when clicking on items
 */
export default function DetailDrawer({
    isOpen,
    onClose,
    title,
    subtitle,
    stats = [],
    onJumpToMessage = () => { },
    samples = [],
    children,
}) {
    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const handleJumpResult = (id) => {
        onJumpToMessage(id);
        onClose(); // Close drawer so user can see where they jumped
    };

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            position="right"
            width="420px"
            className="w-full max-w-[420px] md:w-[420px]"
        >
            <div className="h-full bg-[#FAFAFA] flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-neutral-100">
                    <div>
                        <h3 className="font-display text-xl font-semibold text-neutral-900 mb-1">
                            {title}
                        </h3>
                        {subtitle && (
                            <p className="font-mono text-[11px] text-neutral-400 uppercase tracking-wider">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -m-2 text-neutral-400 hover:text-neutral-900 transition-colors"
                        aria-label="Close panel"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Stats */}
                    {stats.length > 0 && (
                        <div className="grid grid-cols-2 gap-4">
                            {stats.map(({ label, value, color }) => (
                                <div key={label}>
                                    <p className={STYLES.dataLabel}>{label}</p>
                                    <p
                                        className="font-display text-2xl font-semibold"
                                        style={{ color: color || COLORS.text.primary }}
                                    >
                                        {value}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Custom Content */}
                    {children}

                    {/* Message Samples */}
                    {samples.length > 0 && (
                        <div>
                            <h4 className={`${STYLES.dataLabel} mb-4`}>
                                Example Messages ({samples.length})
                            </h4>
                            <div className="space-y-3">
                                {samples.map((sample, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleJumpResult(sample.id)}
                                        className="w-full text-left p-4 bg-white border-l-2 border-accent hover:bg-neutral-50 transition-all group"
                                    >
                                        <p className="font-display text-[14px] text-neutral-800 leading-relaxed mb-3">
                                            "{sample.content}"
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <span className={`${STYLES.userNameSmall} group-hover:text-accent transition-colors`}>
                                                {formatName(sample.sender)}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                {sample.timestamp_ms && (
                                                    <span className="font-mono text-[10px] text-neutral-400">
                                                        {formatDate(sample.timestamp_ms)}
                                                    </span>
                                                )}
                                                <span className="font-mono text-[9px] uppercase tracking-wider text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Jump →
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {samples.length === 0 && !children && stats.length === 0 && (
                        <div className="text-center py-8">
                            <p className={STYLES.emptyState}>No details available</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-neutral-100">
                    <button
                        onClick={onClose}
                        className="w-full py-3 font-mono text-[12px] uppercase tracking-widest text-neutral-500 hover:text-accent hover:bg-neutral-100 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Drawer>
    );
}
