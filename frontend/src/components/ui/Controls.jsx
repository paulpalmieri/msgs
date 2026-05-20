import React from 'react';
import { STYLES } from '../../design';

/**
 * Toggle button group for switching between modes/views
 * 
 * @param {Array} options - Array of { key, label } objects
 * @param {string} value - Currently selected key
 * @param {function} onChange - Callback when selection changes
 * 
 * @example
 * <ModeToggle
 *   options={[
 *     { key: 'hour', label: 'Hour' },
 *     { key: 'day', label: 'Day' },
 *   ]}
 *   value={mode}
 *   onChange={setMode}
 * />
 */
export function ModeToggle({ options, value, onChange }) {
    return (
        <div className="flex gap-1">
            {options.map(({ key, label }) => (
                <button
                    key={key}
                    onClick={() => onChange(key)}
                    className={`${STYLES.modeButton} ${
                        value === key ? STYLES.modeButtonActive : STYLES.modeButtonInactive
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}


