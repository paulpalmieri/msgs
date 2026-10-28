export function Soon({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div>
        <div className="text-[15px] font-semibold">{label}</div>
        <div className="mt-1 text-ink-3">This section comes in a later step.</div>
      </div>
    </div>
  );
}
