/**
 * PPT/PowerPoint file icon — Orange document style.
 * Follows the same design pattern as pdf-solid.tsx and doc-solid.tsx.
 */
export default function PPTIcon({ ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 56 56"
      fill="none"
      {...props}
    >
      {/* Document background */}
      <path
        fill="#D24726"
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
      {/* Presentation slide icon */}
      <path
        fill="#fff"
        d="M18 28h20v14H18V28Zm2 2v10h16V30H20Zm8 2a4 4 0 1 0 0 6 4 4 0 0 0 0-6Z"
      />
      {/* Presenter bar */}
      <rect fill="#fff" x="22" y="44" width="12" height="2" rx="1" />
    </svg>
  );
}
