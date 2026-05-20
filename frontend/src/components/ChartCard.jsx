import React from 'react';
import { STYLES } from '../design';

/**
 * Chart card container with consistent header styling
 * Uses design system tokens for typography
 */
export default function ChartCard({ title, subtitle, children, icon, explanation, className = "h-[400px]", minWidth, headerRight }) {
    return (
        <div className={`flex flex-col relative ${className}`}>
            {/* Header - Minimal Swiss Typographic */}
            <div className="mb-6">
                <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="flex items-center gap-3">
                        <h3 className={STYLES.sectionTitle}>{title}</h3>
                        {explanation && (
                            <div className="group relative">
                                <span className="font-mono text-[12px] text-neutral-400 cursor-help hover:text-accent">?</span>
                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-4 bg-white border border-neutral-200 text-neutral-600 z-50 whitespace-normal leading-relaxed font-mono text-[12px] shadow-subtle">
                                    {explanation}
                                </div>
                            </div>
                        )}
                    </div>
                    {headerRight && (
                        <div>{headerRight}</div>
                    )}
                </div>
                {subtitle && (
                    <p className={STYLES.sectionSubtitle}>{subtitle}</p>
                )}
            </div>

            {/* Chart Container - Clean */}
            <div className="flex-1 w-full min-h-0 relative overflow-hidden">
                {minWidth ? (
                    <div className="w-full h-full overflow-x-auto scrollbar-hide pb-2">
                        <div style={{ minWidth: minWidth, height: '100%' }}>
                            {children}
                        </div>
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>
    )
}
