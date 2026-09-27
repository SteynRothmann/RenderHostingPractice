// Canonical Wavelength logo mark - the hand-drawn overlapping wave-strand
// illustration supplied by the team, replacing the old placeholder
// `OceanWaveIcon` glyph as the app's brand mark. Served as a plain <img>
// (it's line art on a transparent background) with a small drop-shadow glow
// so it reads consistently against the app's dark ocean panels; the source
// blue is already close enough to the cyan/teal palette that no hue-shift
// filter was needed.
interface BrandLogoProps {
  className?: string;
  withWordmark?: boolean;
}

export default function BrandLogo({ className = 'h-8 w-8', withWordmark = false }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <img
        src="/brand/wavelength-logo-source.png"
        alt="Wavelength"
        className={`${className} object-contain drop-shadow-[0_0_6px_rgba(34,211,238,0.45)]`}
      />
      {withWordmark && (
        <span className="text-lg font-semibold tracking-tight text-cyan-50">Wavelength</span>
      )}
    </span>
  );
}
