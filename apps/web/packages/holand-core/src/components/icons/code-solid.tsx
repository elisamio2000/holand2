/**
 * Code file icon — Cyan/teal document style.
 * Follows the same design pattern as pdf-solid.tsx and doc-solid.tsx.
 */
export default function CodeIcon({ ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 56 56"
      fill="none"
      {...props}
    >
      {/* Document background */}
      <path
        fill="#14B8A6"
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
      {/* Code brackets < /> */}
      <path
        fill="#fff"
        d="M22 35l-6-5 6-5 2 2-4 3 4 3-2 2Zm12 0l6-5-6-5-2 2 4 3-4 3 2 2Zm-8 4l4-18 2 .5-4 18-2-.5Z"
      />
    </svg>
  );
}
