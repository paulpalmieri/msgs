import React from 'react';
import AnimatedCounter from './AnimatedCounter';

/**
 * Hero Stat Component
 * ===================
 * Large stat display with animated counter and optional label.
 * 
 * @param {Object} props
 * @param {number|string} props.value - Stat value
 * @param {string} props.label - Label below value
 * @param {string} props.sublabel - Secondary label
 * @param {number} props.delay - Animation delay (1-5)
 * @param {string} props.size - Size variant ('hero' | 'large' | 'medium')
 */
export default function HeroStat({ value, label, sublabel, delay = 0, size = 'hero' }) {
    const sizeClass = {
        'hero': 'wrapped-hero-stat',
        'large': 'wrapped-large-stat',
        'medium': 'wrapped-medium-stat'
    }[size];
    
    return (
        <div className={`wrapped-animate-count wrapped-delay-${delay + 1}`}>
            <div className={sizeClass}>
                {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
            </div>
            {label && (
                <div className="wrapped-label mt-3">{label}</div>
            )}
            {sublabel && (
                <div className="wrapped-body mt-2 max-w-md">{sublabel}</div>
            )}
        </div>
    );
}


