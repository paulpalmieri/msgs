import React from 'react';
import { STYLES, COLORS } from '../../design';

/**
 * Display a rank number with consistent formatting
 * 
 * @param {number} rank - The rank number
 * @param {boolean} accent - Use accent color styling
 * 
 * @example
 * <RankBadge rank={1} />
 * <RankBadge rank={1} accent />
 */
export function RankBadge({ rank, accent = false, className = '' }) {
    const formattedRank = String(rank).padStart(2, '0');
    return (
        <span className={`${accent ? STYLES.rankAccent : STYLES.rank} ${className}`}>
            {formattedRank}
        </span>
    );
}

/**
 * Vertical color indicator for user rows
 * Changes to accent color on hover
 * 
 * @param {string} color - Base color
 * @param {boolean} isHovered - Whether parent row is hovered
 * 
 * @example
 * <UserColorBar color="#D95218" isHovered={isHovered} />
 */
export function UserColorBar({ color, isHovered = false, className = '' }) {
    return (
        <div 
            className={`w-1 self-stretch flex-shrink-0 ${className}`}
            style={{ 
                backgroundColor: isHovered ? COLORS.accent : color,
                minHeight: '20px'
            }} 
        />
    );
}

