function tierClass(tier, height) {
  if (tier <= height) {
    return 'bg-muted opacity-70';
  }
  if (tier === height + 1) {
    return 'bg-accent';
  }
  return 'bg-tile';
}

export function StackIndicator({ height, maxTier, label }) {
  const tiers = Array.from({ length: maxTier }, (_, index) => maxTier - index);
  return (
    <span
      role="img"
      aria-label={label ?? `Tier ${height + 1} of ${maxTier}`}
      className="inline-flex w-6 flex-col gap-1"
    >
      {tiers.map((tier) => (
        <span key={tier} className={`h-2.5 rounded-sm ${tierClass(tier, height)}`} />
      ))}
    </span>
  );
}
