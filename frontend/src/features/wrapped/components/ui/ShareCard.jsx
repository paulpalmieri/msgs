import React from 'react';

/**
 * Share Card Component
 * ====================
 * Summary card for sharing wrapped results.
 * 
 * @param {Object} props
 * @param {string} props.userName - User's name
 * @param {number} props.year - Year being wrapped
 * @param {Array} props.stats - Array of stat objects
 * @param {function} props.onRestart - Callback to restart wrapped
 */
export default function ShareCard({ userName, year, stats, onRestart }) {
    return (
        <div className="wrapped-share-card-container">
            <div className="wrapped-share-card wrapped-animate-scale">
                <div className="wrapped-share-card-header text-center">
                    <div className="wrapped-label mb-2">{year} Wrapped</div>
                    <div className="wrapped-medium-stat text-2xl">{userName}</div>
                </div>
                <div className="wrapped-share-card-grid">
                    {stats.map((stat, i) => (
                        <div key={i} className="wrapped-share-card-stat">
                            {stat.emoji ? (
                                <span className="wrapped-share-card-stat-emoji">{stat.emoji}</span>
                            ) : (
                                <span className={`wrapped-share-card-stat-value ${stat.isName ? 'name' : ''}`}>
                                    {stat.value}
                                </span>
                            )}
                            <span className="wrapped-label">{stat.label}</span>
                        </div>
                    ))}
                </div>
                <div className="wrapped-share-card-footer text-center">
                    <div className="wrapped-label opacity-50">MSGS // Your Year in Data</div>
                </div>
            </div>
            
            {/* Actions */}
            <div className="wrapped-share-actions wrapped-animate-up wrapped-delay-3">
                <button
                    onClick={onRestart}
                    className="wrapped-restart-btn"
                >
                    Start Over
                </button>
                <a 
                    href="https://msgs.live" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="wrapped-website-link"
                >
                    Create your own at <span className="wrapped-accent-text">msgs.live</span>
                </a>
            </div>
        </div>
    );
}


