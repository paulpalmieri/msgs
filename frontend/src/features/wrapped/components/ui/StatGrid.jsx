import React from 'react';

/**
 * Stat Grid Component
 * ===================
 * Grid layout for multiple stats.
 * 
 * @param {Object} props
 * @param {Array} props.stats - Array of stat objects with value, label, emoji
 * @param {number} props.columns - Number of columns (2 or 3)
 * @param {string} props.variant - Style variant ('default' | 'borderless')
 */
export default function StatGrid({ stats, columns = 2, variant = 'default' }) {
    const gridClass = columns === 3 ? 'wrapped-stat-grid-3' : 'wrapped-stat-grid-2x2';
    const variantClass = variant === 'borderless' ? 'wrapped-stat-grid-borderless' : '';
    
    return (
        <div className={`wrapped-stat-grid ${gridClass} ${variantClass} w-full max-w-lg`}>
            {stats.map((stat, i) => (
                <div 
                    key={i} 
                    className={`wrapped-stat-cell wrapped-animate-up wrapped-delay-${i + 1}`}
                >
                    {stat.emoji ? (
                        <span className="text-3xl emoji">{stat.emoji}</span>
                    ) : (
                        <span className="wrapped-large-stat text-4xl md:text-5xl">
                            {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                        </span>
                    )}
                    <span className="wrapped-label">{stat.label}</span>
                </div>
            ))}
        </div>
    );
}


