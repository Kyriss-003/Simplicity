import type { CSSProperties, ReactNode } from 'react';
import { Radius, type Theme } from '../../theme';

export function Card({
  theme,
  children,
  style,
}: {
  theme: Theme;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        backgroundColor: theme.surface,
        borderRadius: Radius.card,
        padding: 16,
        boxShadow: `0 2px 12px ${theme.cardShadow}`,
        transition: 'background-color 150ms ease, box-shadow 150ms ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
