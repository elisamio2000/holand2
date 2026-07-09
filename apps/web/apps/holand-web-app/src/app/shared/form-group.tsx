import cn from '@core/utils/class-names';

interface FormGroupProps {
  title: React.ReactNode;
  className?: string;
  description?: string;
  children?: React.ReactNode;
  /** split = label column + field column (default); stacked = compact header above full-width content */
  layout?: 'split' | 'stacked';
}

export default function FormGroup({
  title,
  className,
  description,
  children,
  layout = 'split',
}: FormGroupProps) {
  if (layout === 'stacked') {
    return (
      <div className={cn('grid gap-4', className)}>
        <div className="border-b border-gray-100 pb-3 dark:border-gray-200">
          <h4 className="text-base font-medium">{title}</h4>
          {description ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-5 @3xl:grid-cols-12', className)}>
      <div className="col-span-full @4xl:col-span-4">
        <h4 className="text-base font-medium">{title}</h4>
        {description && <p className="mt-2">{description}</p>}
      </div>
      {children && (
        <div className="col-span-full grid gap-4 @2xl:grid-cols-2 @4xl:col-span-8 @4xl:gap-5 xl:gap-7">
          {children}
        </div>
      )}
    </div>
  );
}
