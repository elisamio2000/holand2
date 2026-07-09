import { Button } from 'rizzui';
import cn from '../utils/class-names';

interface FormFooterProps {
  className?: string;
  altBtnText?: string;
  submitBtnText?: string;
  isLoading?: boolean;
  handleAltBtn?: () => void;
  /** Default true — long forms. Profile settings uses false to avoid overlay on avatar builder. */
  sticky?: boolean;
}

export const negMargin = '-mx-4 md:-mx-5 lg:-mx-6 3xl:-mx-8 4xl:-mx-10';

export const profileFormFooterClassName = '-mb-6 lg:-mb-8 4xl:-mb-9';

export default function FormFooter({
  isLoading,
  altBtnText = 'Save as Draft',
  submitBtnText = 'Submit',
  className,
  handleAltBtn,
  sticky = true,
}: FormFooterProps) {
  return (
    <div
      className={cn(
        'left-0 right-0 flex items-center justify-end gap-4 border-t bg-white px-4 py-4 md:px-5 lg:px-6 3xl:px-8 4xl:px-10 dark:bg-gray-50',
        sticky && 'sticky bottom-0 z-10 -mb-8',
        className,
        negMargin
      )}
    >
      <Button
        variant="outline"
        className="w-full @xl:w-auto"
        onClick={handleAltBtn}
      >
        {altBtnText}
      </Button>
      <Button type="submit" isLoading={isLoading} className="w-full @xl:w-auto">
        {submitBtnText}
      </Button>
    </div>
  );
}
