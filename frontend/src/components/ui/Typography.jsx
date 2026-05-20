import React from 'react';
import { STYLES } from '../../design';

/**
 * Section header with title, subtitle, and optional right-side content
 * 
 * @example
 * <SectionHeader
 *   title="Activity"
 *   subtitle="When does the group chat?"
 *   right={<ModeToggle ... />}
 * />
 */
export function SectionHeader({ title, subtitle, right, className = '' }) {
    return (
        <div className={`mb-6 flex items-start justify-between gap-4 ${className}`}>
            <div>
                <h3 className={STYLES.sectionTitle + ' mb-1'}>
                    {title}
                </h3>
                {subtitle && (
                    <p className={STYLES.sectionSubtitle}>
                        {subtitle}
                    </p>
                )}
            </div>
            {right && <div className="flex-shrink-0">{right}</div>}
        </div>
    );
}

/**
 * Micro label for metadata/captions
 * 
 * @example
 * <DataLabel>Average</DataLabel>
 * <DataLabel strong>Important Label</DataLabel>
 */
export function DataLabel({ children, strong = false, className = '' }) {
    return (
        <div className={`${strong ? STYLES.dataLabelStrong : STYLES.dataLabel} ${className}`}>
            {children}
        </div>
    );
}

/**
 * Display a numeric value with consistent formatting
 * 
 * @param {string} size - 'default' | 'large' | 'small'
 * @param {string} unit - Optional unit suffix (e.g., 'msgs', 'days')
 * 
 * @example
 * <DataValue>1,234</DataValue>
 * <DataValue size="large" unit="msgs">5,678</DataValue>
 */
export function DataValue({ children, size = 'default', unit, className = '' }) {
    const sizeClass = {
        large: STYLES.dataValueLarge,
        small: STYLES.dataValueSmall,
        default: STYLES.dataValue,
    }[size];
    
    return (
        <div className={`${sizeClass} ${className}`}>
            {children}
            {unit && <span className="text-neutral-400 text-sm ml-1">{unit}</span>}
        </div>
    );
}

/**
 * Displays a key statistic with label and optional context
 * 
 * @example
 * <KeyStat value="2,345" context="Jan '23" />
 * <KeyStat label="Average" value="1,234" />
 */
export function KeyStat({ label = 'Peak', value, context, className = '' }) {
    return (
        <div className={`mt-3 ${STYLES.peakLabel} ${className}`}>
            {label}: <span className={STYLES.peakValue}>{value}</span>
            {context && <span className={STYLES.peakContext}>{context}</span>}
        </div>
    );
}


