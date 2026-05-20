import { useState, useRef, useCallback, useEffect } from 'react';

const STORY_DURATION = 8000; // ms per story

/**
 * Hook for managing story navigation and progress
 * 
 * @param {number} totalStories - Total number of stories
 * @param {boolean} isActive - Whether story mode is active
 * @returns {Object} Navigation state and controls
 */
export function useStoryNavigation(totalStories, isActive = false) {
    const [storyIndex, setStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    
    const progressStartTime = useRef(Date.now());
    const progressAnimationFrame = useRef(null);

    /**
     * Go to next story
     */
    const next = useCallback(() => {
        if (storyIndex < totalStories - 1) {
            setStoryIndex(prev => prev + 1);
            setProgress(0);
            progressStartTime.current = Date.now();
        }
    }, [storyIndex, totalStories]);

    /**
     * Go to previous story
     */
    const prev = useCallback(() => {
        if (storyIndex > 0) {
            setStoryIndex(prev => prev - 1);
            setProgress(0);
            progressStartTime.current = Date.now();
        } else {
            // Reset current story
            setProgress(0);
            progressStartTime.current = Date.now();
        }
    }, [storyIndex]);

    /**
     * Reset to first story
     */
    const reset = useCallback(() => {
        setStoryIndex(0);
        setProgress(0);
        progressStartTime.current = Date.now();
    }, []);

    /**
     * Pause progress (for holding)
     */
    const pause = useCallback(() => {
        setIsPaused(true);
    }, []);

    /**
     * Resume progress from where it was paused
     */
    const resume = useCallback(() => {
        setIsPaused(false);
        const remainingTime = ((100 - progress) / 100) * STORY_DURATION;
        progressStartTime.current = Date.now() - (STORY_DURATION - remainingTime);
    }, [progress]);

    // Progress animation
    useEffect(() => {
        if (!isActive || isPaused) {
            if (progressAnimationFrame.current) {
                cancelAnimationFrame(progressAnimationFrame.current);
            }
            return;
        }
        
        const animate = () => {
            const elapsed = Date.now() - progressStartTime.current;
            const newProgress = Math.min((elapsed / STORY_DURATION) * 100, 100);
            setProgress(newProgress);
            
            if (newProgress >= 100 && storyIndex < totalStories - 1) {
                setStoryIndex(prev => prev + 1);
                setProgress(0);
                progressStartTime.current = Date.now();
            }
            
            progressAnimationFrame.current = requestAnimationFrame(animate);
        };
        
        progressAnimationFrame.current = requestAnimationFrame(animate);
        
        return () => {
            if (progressAnimationFrame.current) {
                cancelAnimationFrame(progressAnimationFrame.current);
            }
        };
    }, [isActive, storyIndex, isPaused, totalStories]);

    // Reset progress when story index changes
    useEffect(() => {
        setProgress(0);
        progressStartTime.current = Date.now();
    }, [storyIndex]);

    return {
        storyIndex,
        progress,
        isPaused,
        isFirstStory: storyIndex === 0,
        isLastStory: storyIndex === totalStories - 1,
        next,
        prev,
        reset,
        pause,
        resume,
    };
}

export default useStoryNavigation;


