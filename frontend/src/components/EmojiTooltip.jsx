import { useRef, useState, useEffect } from 'react';
import { formatName } from '../utils/formatters';
import { COLORS } from '../design';

/**
 * Mini sparkline for emoji evolution
 * Shows trend over time with an end dot
 */
const EmojiSparkline = ({ data, color = COLORS.accent, width = 120, height = 40 }) => {
    if (!data || data.length < 2) return null;
    
    const max = Math.max(...data.map(d => d.count)) || 1;
    const min = Math.min(...data.map(d => d.count));
    const range = max - min || 1;
    
    // Build SVG path
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - 4 - ((d.count - min) / range) * (height - 8);
        return `${x},${y}`;
    }).join(' ');
    
    return (
        <svg width={width} height={height} className="flex-shrink-0">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* End dot */}
            {data.length > 0 && (() => {
                const lastPoint = data[data.length - 1];
                const x = width;
                const y = height - 4 - ((lastPoint.count - min) / range) * (height - 8);
                return <circle cx={x} cy={y} r="3" fill={color} />;
            })()}
        </svg>
    );
};

/**
 * Emoji Tooltip Component
 * Shows emoji details with evolution sparkline and user leaderboard
 */
export const EmojiTooltip = ({ emoji, count, isVisible, anchorRect, evolution, leaderboard, onClose }) => {
    const tooltipRef = useRef(null);
    const [position, setPosition] = useState({ x: 0, y: 0, placement: 'below' });
    
    // Dynamically calculate best position based on viewport and anchor
    useEffect(() => {
        if (!tooltipRef.current || !isVisible || !anchorRect) return;
        
        const tooltip = tooltipRef.current;
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 16;
        const tooltipWidth = Math.min(300, viewportWidth - padding * 2);
        const tooltipHeight = tooltipRect.height;
        
        let x, y, placement = 'below';
        
        // Calculate horizontal position - center on anchor, but clamp to viewport
        x = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2;
        x = Math.max(padding, Math.min(x, viewportWidth - tooltipWidth - padding));
        
        // Calculate vertical position - prefer below, flip above if needed
        const spaceBelow = viewportHeight - anchorRect.bottom - padding;
        const spaceAbove = anchorRect.top - padding;
        
        if (spaceBelow >= tooltipHeight || spaceBelow >= spaceAbove) {
            // Show below
            y = anchorRect.bottom + 12;
            placement = 'below';
            
            // If still overflows bottom, clamp it
            if (y + tooltipHeight > viewportHeight - padding) {
                y = viewportHeight - tooltipHeight - padding;
            }
        } else {
            // Show above
            y = anchorRect.top - tooltipHeight - 12;
            placement = 'above';
            
            // If overflows top, clamp it
            if (y < padding) {
                y = padding;
            }
        }
        
        setPosition({ x, y, placement });
    }, [anchorRect, isVisible]);
    
    if (!isVisible) return null;
    
    const totalFromLeaderboard = leaderboard?.reduce((sum, u) => sum + u.count, 0) || 0;
    
    return (
        <>
            {/* Backdrop for touch devices to close tooltip */}
            <div 
                className="fixed inset-0 z-[99] bg-transparent md:hidden"
                onClick={onClose}
            />
            <div
                ref={tooltipRef}
                className="fixed z-[100] bg-white shadow-[0_12px_48px_rgba(0,0,0,0.18)] animate-fade-in md:pointer-events-none"
                style={{
                    left: position.x,
                    top: position.y,
                    width: Math.min(300, window.innerWidth - 32),
                    maxWidth: 300,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with emoji and total */}
                <div className="px-4 py-3 border-b border-neutral-100">
                    <div className="flex items-center gap-3">
                        <span 
                            className="text-3xl"
                            style={{ fontFamily: "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Twemoji Mozilla', sans-serif" }}
                        >
                            {emoji}
                        </span>
                        <div className="flex-1">
                            <div className="font-mono text-xl font-bold text-neutral-900 tabular-nums">
                                {count.toLocaleString()}
                            </div>
                            <div className="font-mono text-[8px] uppercase tracking-widest text-neutral-400">
                                Total Reactions
                            </div>
                        </div>
                        {/* Close button for touch */}
                        <button 
                            onClick={onClose}
                            className="md:hidden w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900"
                        >
                            ×
                        </button>
                    </div>
                </div>
                
                {/* Evolution Section - Trendline only */}
                {evolution && evolution.length > 1 && (
                    <div className="px-4 py-3 border-b border-neutral-100">
                        <div className="flex items-center justify-between mb-2">
                            <div className="font-mono text-[8px] uppercase tracking-[0.15em] text-neutral-400">
                                Evolution
                            </div>
                            <div className="font-mono text-[12px] text-neutral-500">
                                {evolution[0].year} → {evolution[evolution.length - 1].year}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <EmojiSparkline data={evolution} color={COLORS.accent} width={180} height={36} />
                            <div className="text-right flex-shrink-0">
                                <div className="font-mono text-sm font-bold text-neutral-900 tabular-nums">
                                    {evolution[evolution.length - 1].count.toLocaleString()}
                                </div>
                                <div className="font-mono text-[8px] text-neutral-400">
                                    '{String(evolution[evolution.length - 1].year).slice(-2)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Leaderboard Section */}
                {leaderboard && leaderboard.length > 0 && (
                    <div className="px-4 py-3">
                        <div className="font-mono text-[8px] uppercase tracking-[0.15em] text-neutral-400 mb-2">
                            Top Users
                        </div>
                        <div className="space-y-1.5">
                            {leaderboard.slice(0, 5).map((user, idx) => {
                                const percentage = totalFromLeaderboard > 0 
                                    ? Math.round((user.count / totalFromLeaderboard) * 100) 
                                    : 0;
                                return (
                                    <div key={user.name} className="flex items-center gap-2">
                                        <span className={`font-mono text-[12px] w-3 ${idx === 0 ? 'text-accent font-bold' : 'text-neutral-300'}`}>
                                            {idx + 1}
                                        </span>
                                        <span className={`font-mono text-[12px] uppercase tracking-wide flex-1 truncate ${idx === 0 ? 'font-semibold text-neutral-900' : 'text-neutral-600'}`}>
                                            {formatName(user.name)}
                                        </span>
                                        {/* Progress bar */}
                                        <div className="w-10 h-1 bg-neutral-100 flex-shrink-0">
                                            <div 
                                                className="h-full" 
                                                style={{ 
                                                    width: `${percentage}%`,
                                                    backgroundColor: idx === 0 ? COLORS.accent : COLORS.text.muted
                                                }} 
                                            />
                                        </div>
                                        <span className={`font-mono text-[12px] tabular-nums w-8 text-right ${idx === 0 ? 'text-accent font-medium' : 'text-neutral-500'}`}>
                                            {user.count}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default EmojiTooltip;

