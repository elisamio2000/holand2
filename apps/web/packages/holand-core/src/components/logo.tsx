interface IconProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  iconOnly?: boolean;
  /** Skip the automatic dark:invert filter (e.g. when the logo sits on a known-light surface). */
  noDarkInvert?: boolean;
}

/** Full wordmark — ERMINE logo with text (public as `brand-wordmark.svg`). */
export const BRAND_LOGO_SRC = '/brand/brand-wordmark.svg';
/** Compact square mark — ERMINE icon (public as `brand-mark-4x.png` / `ai-assistant-mark.svg`). */
export const BRAND_MARK_SRC = '/brand/ai-assistant-mark.svg';
export const BRAND_MARK_ON_DARK_SRC = '/brand/ai-assistant-mark-on-dark.svg';

/** Layout sizes: wordmark viewBox 278.01×174.86; mark is 1:1 square (viewBox 391×391). */
export const BRAND_LOGO_WIDTH = 278;
export const BRAND_LOGO_HEIGHT = 175;
export const BRAND_MARK_WIDTH = 80;
export const BRAND_MARK_HEIGHT = 80;

export default function Logo({
  iconOnly = false,
  noDarkInvert = false,
  alt = 'ERMINE',
  className,
  ...props
}: IconProps) {
  const src = iconOnly ? BRAND_MARK_SRC : BRAND_LOGO_SRC;
  const width = iconOnly ? BRAND_MARK_WIDTH : BRAND_LOGO_WIDTH;
  const height = iconOnly ? BRAND_MARK_HEIGHT : BRAND_LOGO_HEIGHT;

  const darkClass = noDarkInvert ? '' : 'dark:invert';
  const merged = [darkClass, className].filter(Boolean).join(' ');

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={merged || undefined}
      decoding="async"
      loading="lazy"
      draggable={false}
      {...props}
    />
  );
}
