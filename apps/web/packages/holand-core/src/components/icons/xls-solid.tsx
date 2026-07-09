/**
 * XLS/Excel file icon — Green document style.
 * Follows the same design pattern as pdf-solid.tsx and doc-solid.tsx.
 */
export default function XLSIcon({ ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 56 56"
      fill="none"
      {...props}
    >
      {/* Document background */}
      <path
        fill="#217346"
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
      {/* Grid cells representing spreadsheet */}
      <path
        fill="#fff"
        d="M18 27h8v5h-8v-5Zm10 0h10v5H28v-5Zm-10 7h8v5h-8v-5Zm10 0h10v5H28v-5Zm-10 7h8v5h-8v-5Zm10 0h10v5H28v-5Z"
      />
    </svg>
  );
}
