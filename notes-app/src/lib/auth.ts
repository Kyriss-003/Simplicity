import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';

/**
 * OAuth via the native system browser (Android Chrome Custom Tabs / iOS
 * ASWebAuthenticationSession), redirecting back to the app with a
 * `supabase.auth.code` exchange handled by `supabase-js` + the web browser.
 *
 * The redirect URI must be registered in Supabase's Auth > URL Configuration.
 * For Expo, this resolves to:
 *   - Web:  `window.location.origin`
 *   - iOS/Android: the `scheme://` deep link from app.json.
 */
export async function getOAuthRedirectUri(): Promise<string> {
  return makeRedirectUri({
    scheme: 'notesapp', // keep in sync with app.json "scheme"
    path: 'auth/callback',
  });
}

/** Sign in with a provider using the system browser. */
export async function signInWithProvider(
  provider: 'google',
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  const redirectTo = await getOAuthRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  if (error) return { error: error.message };
  if (!data.url) return { error: 'OAuth did not return a redirect URL.' };

  // Native: open the system browser; the deep link returns here.
  if (Platform.OS !== 'web') {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') {
      return { error: 'Sign in was cancelled or did not complete.' };
    }
    // supabase-js picks up the code via detectSessionInUrl on web; on native we
    // let the in-app URL handler finish the exchange.
    return { error: null };
  }

  // Web: rely on detectSessionInUrl to pick up the code from the redirect.
  return { error: null };
}
