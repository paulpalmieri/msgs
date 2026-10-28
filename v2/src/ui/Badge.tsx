import { useConversation } from '../app/ConversationProvider';
import { initials, inkOn } from '../charts/palette';

/** A person's colour with their initials, so people stay distinguishable past the palette. */
export function Badge({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  const { colorOf } = useConversation();
  const bg = colorOf(name);
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none ${className}`}
      style={{ width: size, height: size, background: bg, color: inkOn(bg), fontSize: Math.round(size * 0.42), letterSpacing: '-0.02em' }}
    >
      {initials(name)}
    </span>
  );
}
