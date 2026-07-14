// required this function to element this issue: /brand/brand-mark-4x.svg
export default function hideRechartsConsoleError() {
  const error = console.error;
  return (console.error = (...args: any) => {
    if (/defaultProps/.test(args[0])) return;
    error(...args);
  });
}

