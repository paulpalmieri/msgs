import React from 'react';
import ContentAnalysis from '../../../components/ContentAnalysis';

/**
 * Content Section
 * ===============
 * Displays content analysis (words, sentiment, media).
 * 
 * @param {Object} props
 * @param {Object} props.creative - Creative analysis data
 * @param {Object[]} props.messages - Filtered messages array
 * @param {Object} props.users - User stats object
 */
export default function ContentSection({ creative, messages, users }) {
    return (
        <section className="mb-14 lg:mb-18">
            <div className="section-divider">
                <div className="section-divider-label">04</div>
                <h2 className="section-divider-title">CONTENT</h2>
            </div>
            
            <ContentAnalysis
                creative={creative}
                messages={messages}
                users={users}
            />
        </section>
    );
}

