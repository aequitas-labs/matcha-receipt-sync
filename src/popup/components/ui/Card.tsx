import React from 'react';

interface CardProps {
  variant?: 'default' | 'raised';
  className?: string;
  children: React.ReactNode;
}

const variantClasses = {
  default: 'bg-card border border-border',
  raised: 'bg-card shadow-sm',
};

export function Card({
  variant = 'default',
  className = '',
  children,
}: CardProps) {
  return (
    <div className={`rounded-lg p-3 ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
