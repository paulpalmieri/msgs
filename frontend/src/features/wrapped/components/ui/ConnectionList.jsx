import React from 'react';

/**
 * Connection List Component
 * =========================
 * List of connections with names and values.
 * 
 * @param {Object} props
 * @param {Array} props.connections - Array of {name, value} objects
 * @param {number} props.delay - Animation delay
 */
export default function ConnectionList({ connections, delay = 0 }) {
    return (
        <div className={`w-full max-w-md wrapped-animate-up wrapped-delay-${delay + 1}`}>
            {connections.map((conn, i) => (
                <div key={i} className="wrapped-connection">
                    <span className="wrapped-connection-name">{conn.name}</span>
                    <span className="wrapped-connection-value">{conn.value}</span>
                </div>
            ))}
        </div>
    );
}


