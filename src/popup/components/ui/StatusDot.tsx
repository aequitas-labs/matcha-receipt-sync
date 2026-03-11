import React from 'react';

type StatusDotVariant = 'success' | 'error' | 'idle';

interface StatusDotProps {
  variant?: StatusDotVariant;
  className?: string;
}

const variantClasses: Record<StatusDotVariant, string> = {
  success: 'bg-success',
  error: 'bg-destructive',
  idle: 'bg-muted-foreground/40',
};

export function StatusDot({
  variant = 'idle',
  className = '',
}: StatusDotProps) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full shrink-0 ${variantClasses[variant]} ${className}`}
    />
  );
}
