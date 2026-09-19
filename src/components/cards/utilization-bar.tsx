function toneFor(percent: number): { color: string; label: string } {
  if (percent >= 75) return { color: "var(--status-critical)", label: "High usage" };
  if (percent >= 30) return { color: "var(--status-warning)", label: "Moderate usage" };
  return { color: "var(--status-good)", label: "Low usage" };
}

export function UtilizationBar({ percent }: { percent: number | null }) {
  if (percent === null) {
    return <p className="text-xs text-muted-foreground">No credit limit on file yet.</p>;
  }
  const { color, label } = toneFor(percent);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium" style={{ color }}>
          {label}
        </span>
        <span className="tabular-nums text-muted-foreground">{percent.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
