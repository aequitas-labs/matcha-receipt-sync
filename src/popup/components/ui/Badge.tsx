import React from 'react';

type BadgeVariant = 'success' | 'error' | 'warning' | 'muted';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-success-bg text-success',
  error: 'bg-destructive-bg text-destructive',
  warning: 'bg-warning-bg text-warning-foreground',
  muted: 'bg-muted text-muted-foreground',
};

export function Badge({
  variant = 'muted',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
