import React from 'react';

/**
 * Story Panel Component
 * =====================
 * Wrapper for story content with layout options.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Panel content
 * @param {string} props.layout - Layout type ('center' | 'start' | 'end' | 'split')
 * @param {string} props.className - Additional CSS classes
 */
export default function StoryPanel({ children, layout = 'center', className = '' }) {
    const layoutClass = {
        'center': 'wrapped-layout-center',
        'start': 'wrapped-layout-start',
        'end': 'wrapped-layout-end',
        'split': 'wrapped-layout-split'
    }[layout];
    
    return (
        <div className={`wrapped-panel ${layoutClass} ${className}`}>
            {children}
        </div>
    );
}


