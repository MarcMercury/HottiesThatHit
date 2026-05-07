export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-ink-line">
      <div className="absolute inset-0 bg-neon-radial pointer-events-none" />
      <div className="relative mx-auto max-w-6xl px-4 py-14 md:py-20">
        {eyebrow && <p className="chip mb-4">{eyebrow}</p>}
        <h1 className="font-display text-5xl md:text-6xl text-white neon-text">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 max-w-2xl text-white/70 text-lg">{subtitle}</p>
        )}
      </div>
    </section>
  );
}
