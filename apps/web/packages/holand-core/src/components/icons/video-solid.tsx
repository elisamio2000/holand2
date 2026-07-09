/**
 * Video file icon — red document + white camera (matches doc/pdf/xls family).
 *
 * Layout: [rounded body + lens hole] [viewfinder trapezoid]
 *   - Lens circle inside the body (left)
 *   - Viewfinder: narrow on the left (toward the lens), wide on the right (camera hood)
 */
export default function VideoIcon({ ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 56 56"
      fill="none"
      {...props}
    >
      <path
        fill="#E23E3E"
        d="M14.336 0h18.742l15.866 16.545v32.174c0 4.017-3.263 7.281-7.292 7.281H14.336a7.286 7.286 0 0 1-7.281-7.281V7.28A7.286 7.286 0 0 1 14.336 0Z"
      />
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M33.059 0v16.416h15.887L33.06 0Z"
        clipRule="evenodd"
        opacity={0.302}
      />
      {/* Camera body */}
      <rect x="15" y="27" width="13" height="12" rx="2.5" fill="#fff" />
      <circle cx="21.5" cy="33" r="2.8" fill="#E23E3E" />
      {/* Viewfinder trapezoid: tip/narrow edge at body (x=28), wide edge on the right (x=38) */}
      <polygon fill="#fff" points="28,31.5 28,34.5 33,36.5 33,29" />
    </svg>
  );
}
