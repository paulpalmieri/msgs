import React from 'react';

/**
 * Comparison Bar Component
 * ========================
 * Shows two values as horizontal bars for comparison.
 * 
 * @param {Object} props
 * @param {number} props.you - Your value
 * @param {number} props.average - Average/comparison value
 * @param {string} props.youLabel - Label for your value
 * @param {string} props.avgLabel - Label for average value
 * @param {number} props.delay - Animation delay
 */
export default function ComparisonBar({ you, average, youLabel = 'You', avgLabel = 'Average', delay = 0 }) {
    const max = Math.max(you, average);
    const youPercent = (you / max) * 100;
    const avgPercent = (average / max) * 100;
    
    return (
        <div className={`wrapped-animate-up wrapped-delay-${delay + 1} w-full max-w-md space-y-4`}>
            <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                    <span className="wrapped-label">{youLabel}</span>
                    <span className="wrapped-medium-stat text-2xl wrapped-accent-text">
                        {typeof you === 'number' ? you.toLocaleString() : you}
                    </span>
                </div>
                <div className="wrapped-comparison-bar">
                    <div 
                        className="wrapped-comparison-fill" 
                        style={{ width: `${youPercent}%`, transition: 'width 0.8s ease-out' }}
                    />
                </div>
            </div>
            <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                    <span className="wrapped-label">{avgLabel}</span>
                    <span className="wrapped-medium-stat text-2xl" style={{ color: 'var(--wrapped-muted)' }}>
                        {typeof average === 'number' ? average.toLocaleString() : average}
                    </span>
                </div>
                <div className="wrapped-comparison-bar">
                    <div 
                        className="wrapped-comparison-fill wrapped-comparison-fill-secondary" 
                        style={{ width: `${avgPercent}%`, transition: 'width 0.8s ease-out 0.2s' }}
                    />
                </div>
            </div>
        </div>
    );
}


