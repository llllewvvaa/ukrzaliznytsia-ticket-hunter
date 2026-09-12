import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'destructive' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50';

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'rounded-lg px-2.5 py-1 text-xs',
  md: 'rounded-lg px-3.5 py-2 text-sm',
  lg: 'rounded-2xl px-5 py-3 text-sm',
};

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:bg-blue-800',
  secondary: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100',
  danger: 'bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200',
  destructive: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
  ghost: 'text-blue-600 hover:bg-blue-50 active:bg-blue-100',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={`${BTN_BASE} ${BTN_SIZE[size]} ${BTN_VARIANT[variant]} ${className}`}
      {...props}
    />
  );
}
