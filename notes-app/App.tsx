import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import { AuthGate } from './src/components/AuthGate';

/**
 * Web-only: react-native-web renders every scroll container as an
 * `overflow: auto` div, so Chromium falls back to its default framed scrollbar
 * with arrow buttons. Swap it for a frameless 4px thumb (the same 4pt unit the
 * app lays out in) while leaving the containers fully scrollable.
 *
 * The thumb is a single neutral grey on purpose: it is the one piece of chrome
 * that has to stay legible on the Light, Dark *and* OLED canvases at once, so
 * it is not tied to a single theme token. Everything else keeps using
 * `theme.*` and `Radius.*` per the design system.
 */
const SCROLLBAR_CSS = `
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(128, 128, 128, 0.4) transparent;
}
*::-webkit-scrollbar { width: 4px; height: 4px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-corner { background: transparent; }
*::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.4); border-radius: 9999px; }
*::-webkit-scrollbar-thumb:hover { background: rgba(128, 128, 128, 0.6); }
*::-webkit-scrollbar-button { display: none; width: 0; height: 0; }

/*
 * Focus rings. Chromium draws its own white 2px outline on a focused element,
 * which on a dark canvas reads as a hard white box around whatever was last
 * clicked — it looked like a rendering bug, and it ignored the theme entirely.
 * Suppress the default and re-draw it in the app's accent, which \`HomeScreen\`
 * keeps in sync via the --app-accent custom property.
 *
 * :focus-visible only, so pointer clicks stay ring-free while keyboard and
 * assistive-tech focus still gets one.
 */
*:focus { outline: none; }
*:focus-visible {
  outline: 2px solid var(--app-accent, #f76f53);
  outline-offset: 1px;
}
[aria-label="Event title"]:focus-visible {
  outline: none;
}
`;

const SCROLLBAR_STYLE_ID = 'zen-frameless-scrollbars';

function injectWebScrollbarStyles() {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  if (document.getElementById(SCROLLBAR_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SCROLLBAR_STYLE_ID;
  style.textContent = SCROLLBAR_CSS;
  document.head.appendChild(style);
}

injectWebScrollbarStyles();

export default function App() {
  return (
    <View style={styles.container}>
      <AuthGate>
        <HomeScreen />
      </AuthGate>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
