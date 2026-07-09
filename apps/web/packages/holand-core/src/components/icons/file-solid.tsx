/**
 * Generic file icon — Gray document style.
 * Follows the same design pattern as pdf-solid.tsx and doc-solid.tsx.
 * Used as fallback when no specific icon is available.
 */
export default function FileIcon({ ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 56 56"
      fill="none"
      {...props}
    >
      {/* Document background */}
      <path
        fill="#6B7280"
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
      {/* Document lines */}
      <path
        fill="#fff"
        d="M35.385 29.137H20.618c-.679 0-1.24-.55-1.24-1.228 0-.679.561-1.228 1.24-1.228h14.767a1.227 1.227 0 1 1 0 2.456Zm-4.922 14.767h-9.845c-.679 0-1.24-.55-1.24-1.228 0-.678.561-1.228 1.24-1.228h9.845a1.227 1.227 0 1 1 0 2.456Zm4.922-4.923H20.618c-.679 0-1.24-.549-1.24-1.227 0-.679.561-1.228 1.24-1.228h14.767a1.227 1.227 0 1 1 0 2.455Zm0-4.922H20.618c-.679 0-1.24-.55-1.24-1.228 0-.678.561-1.228 1.24-1.228h14.767a1.227 1.227 0 1 1 0 2.456Z"
      />
    </svg>
  );
}
