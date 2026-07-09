/**
 * ZIP/Archive file icon — Amber document style.
 * Follows the same design pattern as pdf-solid.tsx and doc-solid.tsx.
 */
export default function ZIPIcon({ ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 56 56"
      fill="none"
      {...props}
    >
      {/* Document background */}
      <path
        fill="#F59E0B"
        d="M14.336 0h18.742l15.866 16.545v32.174c0 4.017-3.263 7.281-7.292 7.281H14.336a7.286 7.286 0 0 1-7.281-7.281V7.28A7.286 7.286 0 0 1 14.336 0Z"
      />
      {/* Folded corner */}
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M33.059 0v16.416h15.887L33.06 0Z"
        clipRule="evenodd"
        opacity={0.302}
      />
      {/* Zipper pattern */}
      <rect fill="#fff" x="25" y="24" width="6" height="3" />
      <rect fill="#F59E0B" x="25" y="27" width="6" height="3" />
      <rect fill="#fff" x="25" y="30" width="6" height="3" />
      <rect fill="#F59E0B" x="25" y="33" width="6" height="3" />
      <rect fill="#fff" x="25" y="36" width="6" height="3" />
      {/* Zipper pull */}
      <rect fill="#fff" x="26" y="40" width="4" height="5" rx="1" />
    </svg>
  );
}
