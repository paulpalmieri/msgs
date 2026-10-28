import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Click-to-open dropdown anchored under its trigger; closes on outside click or Esc. */
export function Popover({ trigger, children, width = 280, align = 'left' }: {
  trigger: (open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  width?: number;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div
          className={`absolute top-full z-30 mt-1 rounded-lg border border-line bg-surface shadow-[0_8px_30px_rgba(0,0,0,0.14)] ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{ width }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
