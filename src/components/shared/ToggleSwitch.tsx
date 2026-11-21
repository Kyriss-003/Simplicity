import { Radius, type Theme } from '../../theme';

export function ToggleSwitch({
  theme,
  value,
  onValueChange,
  accessibilityLabel,
}: {
  theme: Theme;
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={accessibilityLabel}
      onClick={() => onValueChange(!value)}
      style={{
        width: 44,
        height: 26,
        borderRadius: Radius.full,
        border: `1px solid ${value ? theme.accent : theme.border}`,
        backgroundColor: value ? theme.accent : theme.pillBg,
        padding: 2,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: value ? 'flex-end' : 'flex-start',
        transition: 'background-color 150ms ease, border-color 150ms ease',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: Radius.full,
          backgroundColor: value ? theme.accentText : theme.textMuted,
          transition: 'transform 150ms ease, background-color 150ms ease',
          display: 'block',
        }}
      />
    </button>
  );
}
