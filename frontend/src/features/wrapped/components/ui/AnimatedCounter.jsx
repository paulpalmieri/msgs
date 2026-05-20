import React, { useState, useEffect } from 'react';

/**
 * Animated Counter Component
 * ==========================
 * Animates a number from 0 to target value.
 * 
 * @param {Object} props
 * @param {number|string} props.value - Target value to animate to
 * @param {number} props.duration - Animation duration in ms
 * @param {string} props.className - Additional CSS classes
 */
export default function AnimatedCounter({ value, duration = 1000, className = '' }) {
    const [displayValue, setDisplayValue] = useState(0);
    const numericValue = typeof value === 'string' ? parseInt(value.replace(/,/g, '')) : value;
    
    useEffect(() => {
        if (isNaN(numericValue)) {
            setDisplayValue(value);
            return;
        }
        
        let startTime;
        let animationFrame;
        
        const animate = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(easeOutQuart * numericValue);
            setDisplayValue(current.toLocaleString());
            
            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            }
        };
        
        animationFrame = requestAnimationFrame(animate);
        return () => { 
            if (animationFrame) cancelAnimationFrame(animationFrame); 
        };
    }, [numericValue, duration, value]);
    
    return <span className={className}>{displayValue}</span>;
}


