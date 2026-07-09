/**
 * Database file icon — Access / SQLite / generic DB (maroon document style).
 */
export default function DbIcon({ ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 56 56"
      fill="none"
      {...props}
    >
      <path
        fill="#A4373A"
        d="M14.336 0h18.742l15.866 16.545v32.174c0 4.017-3.263 7.281-7.292 7.281H14.336a7.286 7.286 0 0 1-7.281-7.281V7.28A7.286 7.286 0 0 1 14.336 0Z"
      />
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M33.059 0v16.416h15.887L33.06 0Z"
        clipRule="evenodd"
        opacity={0.302}
      />
      <ellipse fill="#fff" cx="28" cy="30" rx="10" ry="3.5" />
      <path
        fill="#fff"
        d="M18 30v8c0 1.93 4.477 3.5 10 3.5s10-1.57 10-3.5v-8c0 1.93-4.477 3.5-10 3.5s-10-1.57-10-3.5Z"
      />
      <path
        fill="#fff"
        d="M18 34v4c0 1.93 4.477 3.5 10 3.5s10-1.57 10-3.5v-4c0 1.93-4.477 3.5-10 3.5S18 35.93 18 34Z"
      />
    </svg>
  );
}
