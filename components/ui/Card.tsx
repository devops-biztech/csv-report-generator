import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Standard surface: the brand's 2px keyline and tin radius. */
export default function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-surface rounded-[var(--radius-tin)] border-2 border-border shadow-sm', className)} {...props} />;
}
