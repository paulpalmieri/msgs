import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Unified Drawer Component
 * Handles slide-in/out animation properly for both open and close
 * Uses React Portal to render at document body level (avoids parent container issues)
 * 
 * Props:
 * - isOpen: boolean - controlled open state
 * - onClose: function - callback when drawer should close
 * - position: 'right' | 'left' - slide direction (default: 'right')
 * - width: string - CSS width (default: '100%' for mobile, '45vw' for desktop)
 * - className: string - additional classes for the drawer content
 * - overlayClassName: string - additional classes for the overlay
 * - showOverlay: boolean - whether to show backdrop overlay (default: true)
 * - zIndex: number - z-index for the drawer (default: 60)
 * - children: ReactNode - drawer content
 */
export default function Drawer({ 
    isOpen, 
    onClose, 
    position = 'right',
    width,
    className = '',
    overlayClassName = '',
    showOverlay = true,
    zIndex = 60,
    children 
}) {
    // Track animation state separately from open state
    const [isVisible, setIsVisible] = useState(false);
    const [isAnimatingIn, setIsAnimatingIn] = useState(false);

    useEffect(() => {
        if (isOpen && !isVisible) {
            // Opening: first mount the component
            setIsVisible(true);
        } else if (!isOpen && isVisible) {
            // Closing: trigger animation first, then unmount after animation completes
            setIsAnimatingIn(false);
            document.body.style.overflow = '';
            const timer = setTimeout(() => {
                setIsVisible(false);
            }, 200); // Match CSS transition duration
            return () => clearTimeout(timer);
        }
    }, [isOpen, isVisible]);

    // Separate effect to trigger animation after mount
    useEffect(() => {
        if (isVisible && isOpen && !isAnimatingIn) {
            // Small delay to ensure the element is painted in its initial position
            const timer = setTimeout(() => {
                setIsAnimatingIn(true);
                document.body.style.overflow = 'hidden';
            }, 10);
            return () => clearTimeout(timer);
        }
    }, [isVisible, isOpen, isAnimatingIn]);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    const handleClose = useCallback(() => {
        onClose?.();
    }, [onClose]);

    // Don't render anything if not visible
    if (!isVisible) return null;

    // Transform classes based on position and animation state
    const translateClass = position === 'right'
        ? (isAnimatingIn ? 'translate-x-0' : 'translate-x-full')
        : (isAnimatingIn ? 'translate-x-0' : '-translate-x-full');

    const positionClass = position === 'right' ? 'right-0' : 'left-0';

    // Use portal to render at document body level - ensures fixed positioning works correctly
    return createPortal(
        <>
            {/* Overlay backdrop */}
            {showOverlay && (
                <div 
                    className={`fixed inset-0 bg-black/40 transition-opacity duration-200 ${
                        isAnimatingIn ? 'opacity-100' : 'opacity-0'
                    } ${overlayClassName}`}
                    style={{ zIndex: zIndex - 1 }}
                    onClick={handleClose}
                    aria-hidden="true"
                />
            )}
            
            {/* Drawer panel */}
            <div 
                className={`fixed inset-y-0 ${positionClass} transform transition-transform duration-200 ease-out ${translateClass} ${className}`}
                style={{ 
                    zIndex,
                    ...(width ? { width } : {})
                }}
                role="dialog"
                aria-modal="true"
            >
                {children}
            </div>
        </>,
        document.body
    );
}

/**
 * Hook for managing drawer state
 * Returns [isOpen, open, close] tuple
 */
export function useDrawer(initialState = false) {
    const [isOpen, setIsOpen] = useState(initialState);
    
    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen(prev => !prev), []);
    
    return { isOpen, open, close, toggle };
}

