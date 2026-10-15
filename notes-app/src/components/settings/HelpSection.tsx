import { useState } from 'react';
import { Platform } from 'react-native';
import { MaterialCommunityIcons } from '../shared/icons';
import { surfaceTheme, type Theme } from '../../theme';
import { copyToClipboard } from '../shared/utils';
import { SettingsGroup, SettingsRow } from './SettingsRow';

interface KnownIssue {
  title: string;
  detail: string;
}

/**
 * The limitations a user could actually trip over, written plainly.
 *
 * This is a list of things that are genuinely true of the build rather than a
 * placeholder, because a help page full of invented entries is worse than an
 * honest one. See `AGENTS.md` → Known Gaps for the engineering version.
 */
const KNOWN_ISSUES: KnownIssue[] = [
  {
    title: 'Search only covers the open folder',
    detail: 'Results come from the notes currently loaded, so selecting a folder first changes what search finds.',
  },
  {
    title: 'Tasks and events are not kept between launches',
    detail: 'They are held in memory for the session; notes and folders are the only things that persist.',
  },
  {
    title: 'Notes cannot be pinned yet',
    detail: 'Favouriting a note needs a database migration, so the action is absent rather than broken.',
  },
];

/**
 * Diagnostics worth having in a bug report.
 */
function diagnostics(): string {
  return [
    'Simplicity — diagnostics',
    `platform: ${Platform.OS}`,
    `version: ${Platform.Version}`,
    `react-native: ${Platform.constants?.reactNativeVersion?.major ?? 'unknown'}`,
  ].join('\n');
}

export function HelpSection({ theme }: { theme: Theme }) {
  const [copied, setCopied] = useState(false);

  const copyDiagnostics = () => {
    // Best-effort, and the row reports the last attempt either way rather than
    // pretending a denied clipboard permission is a success.
    void copyToClipboard(diagnostics()).then((ok) => {
      setCopied(ok);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <SettingsGroup theme={theme} title="Troubleshooting">
        {KNOWN_ISSUES.map((issue, index) => (
          <SettingsRow
            key={issue.title}
            theme={theme}
            title={issue.title}
            description={issue.detail}
            isLast={index === KNOWN_ISSUES.length - 1}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup theme={theme} title="Diagnostics">
        <SettingsRow
          theme={theme}
          title={copied ? 'Copied to clipboard' : 'Copy diagnostics'}
          description="Platform and version, for a bug report."
          tone={copied ? 'accent' : 'default'}
          onPress={copyDiagnostics}
          isLast
          control={
            <MaterialCommunityIcons
              name={copied ? 'check' : 'clipboard-text-outline'}
              size={16}
              color={copied ? theme.accent : surfaceTheme(theme).textMuted}
            />
          }
        />
      </SettingsGroup>
    </>
  );
}
