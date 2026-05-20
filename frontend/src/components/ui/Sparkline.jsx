import React, { useMemo } from 'react';

/**
 * Sparkline - Minimal SVG line chart for showing trends
 * 
 * @param {number[]} data - Array of numeric values to plot
 * @param {string} color - Stroke color (default: accent color)
 * @param {number} width - SVG width in pixels (default: 56)
 * @param {number} height - SVG height in pixels (default: 16)
 * @param {number} strokeWidth - Line thickness (default: 1.5)
 * @param {number} sampleSize - Max points to render for performance (default: 20)
 */
export default function Sparkline({ 
    data, 
    color = 'var(--accent-primary)', 
    width = 56, 
    height = 16,
    strokeWidth = 1.5,
    sampleSize = 20,
    className = ''
}) {
    const points = useMemo(() => {
        if (!data || data.length < 2) return null;
        
        // Sample data for performance with large datasets
        const targetSampleSize = Math.min(sampleSize, data.length);
        const step = Math.max(1, Math.floor(data.length / targetSampleSize));
        const sampledData = [];
        
        for (let i = 0; i < data.length; i += step) {
            sampledData.push(data[i]);
        }
        
        // Always include the last point for accurate end value
        if (sampledData[sampledData.length - 1] !== data[data.length - 1]) {
            sampledData.push(data[data.length - 1]);
        }
        
        // Calculate bounds
        const max = Math.max(...sampledData);
        const min = Math.min(...sampledData);
        const range = max - min || 1;
        
        // Build SVG polyline points
        return sampledData.map((value, i) => {
            const x = (i / (sampledData.length - 1)) * width;
            const y = height - 2 - ((value - min) / range) * (height - 4);
            return `${x},${y}`;
        }).join(' ');
    }, [data, width, height, sampleSize]);
    
    if (!points) return null;
    
    return (
        <svg 
            width={width} 
            height={height} 
            className={`inline-block flex-shrink-0 ${className}`}
        >
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}


