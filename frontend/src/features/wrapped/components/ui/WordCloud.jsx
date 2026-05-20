import React from 'react';

/**
 * Word Cloud Component
 * ====================
 * Displays top words in a tag cloud layout.
 * 
 * @param {Object} props
 * @param {Array} props.words - Array of {word, count} objects
 * @param {number} props.delay - Animation delay
 */
export default function WordCloud({ words, delay = 0 }) {
    // Group words into rows of 3-4 for better visual balance
    const rows = [];
    const wordsToShow = words.slice(0, 20);
    const rowSizes = [3, 4, 4, 4, 3, 2]; // Varied row sizes for visual interest
    let idx = 0;
    for (const size of rowSizes) {
        if (idx >= wordsToShow.length) break;
        rows.push(wordsToShow.slice(idx, idx + size));
        idx += size;
    }
    
    return (
        <div className={`wrapped-word-cloud wrapped-animate-up wrapped-delay-${delay + 1}`}>
            {rows.map((row, rowIdx) => (
                <div key={rowIdx} className="wrapped-word-row">
                    {row.map((item, i) => (
                        <div key={i} className="wrapped-word-tag">
                            <span className="word">{item.word}</span>
                            <span className="count">{item.count}</span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}


