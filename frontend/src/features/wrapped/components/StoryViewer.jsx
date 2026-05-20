import React, { useCallback } from 'react';

/**
 * Story Viewer Component
 * ======================
 * Displays story content with progress bar and navigation.
 * 
 * @param {Object} props
 * @param {Array} props.stories - Array of story objects with render function
 * @param {number} props.storyIndex - Current story index
 * @param {number} props.progress - Progress percentage (0-100)
 * @param {function} props.onNext - Go to next story
 * @param {function} props.onPrev - Go to previous story
 * @param {function} props.onPause - Pause progress
 * @param {function} props.onResume - Resume progress
 * @param {function} props.onClose - Close wrapped and return to modal
 */
export default function StoryViewer({
    stories,
    storyIndex,
    progress,
    onNext,
    onPrev,
    onPause,
    onResume,
    onClose,
}) {
    const currentStory = stories[storyIndex];

    const handlePointerDown = useCallback(() => {
        onPause();
    }, [onPause]);

    const handlePointerUp = useCallback(() => {
        onResume();
    }, [onResume]);

    return (
        <div className="wrapped-container">
            {/* Progress Bar */}
            <div className="wrapped-progress-container">
                {stories.map((_, idx) => (
                    <div key={idx} className="wrapped-progress-segment">
                        <div 
                            className={`wrapped-progress-fill ${
                                idx < storyIndex ? 'complete' : 
                                idx === storyIndex ? 'active' : ''
                            }`}
                            style={{ 
                                width: idx < storyIndex ? '100%' : 
                                       idx === storyIndex ? `${progress}%` : '0%'
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* Close Button */}
            {onClose && (
                <button
                    onClick={onClose}
                    className="wrapped-close-btn"
                    aria-label="Close wrapped"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}

            {/* Navigation Areas */}
            <div 
                className="absolute inset-0 flex z-10" 
                onPointerDown={handlePointerDown} 
                onPointerUp={handlePointerUp} 
                onPointerLeave={handlePointerUp}
            >
                <div className="w-1/3 h-full cursor-pointer" onClick={onPrev} />
                <div className="w-2/3 h-full cursor-pointer" onClick={onNext} />
            </div>

            {/* Story Content */}
            <div key={storyIndex} className="absolute inset-0 z-0">
                {currentStory.render()}
            </div>

            {/* Navigation Hint */}
            {storyIndex === 0 && (
                <div className="wrapped-nav-hint">
                    Tap to continue
                </div>
            )}
        </div>
    );
}
