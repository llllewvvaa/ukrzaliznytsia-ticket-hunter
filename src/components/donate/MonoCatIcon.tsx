// monobank-style cat head — react-icons has nothing close, so a tiny custom glyph.
export function MonoCatIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 21c-4.4 0-8-3.2-8-7.2V6.4c0-.5.55-.76.9-.45l3.4 2.6A9.6 9.6 0 0 1 12 7.2c1.4 0 2.7.3 3.7 1.35l3.4-2.6c.35-.31.9-.05.9.45v7.4c0 4-3.6 7.2-8 7.2z" />
    </svg>
  );
}
