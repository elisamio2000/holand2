/**
 * Audio file icon — Amber document style (matches doc/pdf/xls family).
 */
export default function MusicIcon({ ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 56 56"
      fill="none"
      {...props}
    >
      <path
        fill="#E8A317"
        d="M14.336 0h18.742l15.866 16.545v32.174c0 4.017-3.263 7.281-7.292 7.281H14.336a7.286 7.286 0 0 1-7.281-7.281V7.28A7.286 7.286 0 0 1 14.336 0Z"
      />
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M33.059 0v16.416h15.887L33.06 0Z"
        clipRule="evenodd"
        opacity={0.302}
      />
      <path
        fill="#fff"
        d="M32 26.5V38a3 3 0 1 1-2-2.83V28.5l-8 2v9.17a3 3 0 1 1-2-2.83V27.5l12-3Z"
      />
    </svg>
  );
}
