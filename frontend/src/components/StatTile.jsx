import React from 'react';

/**
 * Swiss Brutalist Stat Tile - Hero vs Secondary sizing
 * Used for displaying key metrics with animation
 */
export default function StatTile({ label, rawValue, delay = 0, isDecimal = false, unit = '', size = 'default' }) {
    const fullValue = isDecimal ? rawValue : rawValue.toLocaleString();
    
    // Convert label to uppercase with spaces (no underscores)
    const displayLabel = label.toUpperCase();
    
    // Size classes: hero (massive), secondary (medium), default (original)
    const sizeClass = {
        hero: 'stat-tile-hero',
        secondary: 'stat-tile-secondary',
        default: ''
    }[size] || '';
    
    return (
        <div 
            className={`stat-tile ${sizeClass} animate-fade-in-up`}
            style={{ animationDelay: `${delay * 80}ms` }}
        >
            <div className="stat-label">{displayLabel}</div>
            <div className="stat-value">{fullValue}</div>
            {unit && <div className="stat-subtext">{unit}</div>}
        </div>
    );
}


