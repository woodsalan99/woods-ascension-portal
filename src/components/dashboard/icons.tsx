export function Check({ size = 11, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 6.5L4.8 9.2 10 3.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Play() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M6 4.5v11l9-5.5-9-5.5z" fill="#101E2E" />
    </svg>
  );
}
