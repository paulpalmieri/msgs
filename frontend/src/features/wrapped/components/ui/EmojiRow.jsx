import React from 'react';

/**
 * Emoji Row Component
 * ===================
 * Row of emoji items with counts.
 * 
 * @param {Object} props
 * @param {Array} props.emojis - Array of {emoji, count} objects
 * @param {number} props.delay - Animation delay
 */
export default function EmojiRow({ emojis, delay = 0 }) {
    return (
        <div className={`wrapped-emoji-row flex-wrap wrapped-animate-up wrapped-delay-${delay + 1}`}>
            {emojis.map((item, i) => (
                <div key={i} className="wrapped-emoji-item">
                    <span className="emoji">{item.emoji}</span>
                    <span className="wrapped-label">{item.count}</span>
                </div>
            ))}
        </div>
    );
}


