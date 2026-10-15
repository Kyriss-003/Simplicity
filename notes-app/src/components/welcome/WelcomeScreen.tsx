import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '../shared/icons';
import { GlobeView } from './GlobeView';

/**
 * Google "G" in the four brand palette colors, built from one bold G glyph
 * shown through four clipped quadrants (no new icon dependency).
 */
function GoogleG() {
  const quadrants = [
    { color: '#4285F4', left: 0, top: 0, ix: 0, iy: 0 },
    { color: '#EA4335', left: 10, top: 0, ix: -10, iy: 0 },
    { color: '#FBBC05', left: 0, top: 10, ix: 0, iy: -10 },
    { color: '#34A853', left: 10, top: 10, ix: -10, iy: -10 },
  ];
  return (
    <View style={styles.gBox} accessibilityLabel="Google logo">
      {quadrants.map((q) => (
        <View key={q.color} style={[styles.gClip, { left: q.left, top: q.top }]}>
          <Text style={[styles.gGlyph, { color: q.color, left: q.ix, top: q.iy }]}>G</Text>
        </View>
      ))}
    </View>
  );
}

export interface WelcomeScreenProps {
  onContinueWithEmail: () => void;
  onContinueWithGoogle: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function WelcomeScreen({
  onContinueWithEmail,
  onContinueWithGoogle,
  isLoading = false,
  error = null,
}: WelcomeScreenProps) {
  return (
    <View style={styles.shell}>
      <View style={styles.globeWrap}>
        <GlobeView />
      </View>
      <Text style={styles.headline} numberOfLines={1} adjustsFontSizeToFit>
        Ready to be productive?
      </Text>
      <Text style={styles.subtitle}>Your journey starts from here</Text>
      <View style={styles.buttons}>
        <Pressable
          style={[styles.btn, styles.btnEmail]}
          onPress={onContinueWithEmail}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Continue with Email"
        >
          <MaterialCommunityIcons name="email-outline" size={20} color="#0a0a0a" />
          <Text style={styles.btnEmailText}>Continue with Email</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnGoogle]}
          onPress={onContinueWithGoogle}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          {isLoading ? <ActivityIndicator color="#ffffff" /> : <GoogleG />}
          <Text style={styles.btnGoogleText}>Continue with Google</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <View style={styles.legal}>
        <Pressable accessibilityRole="link" accessibilityLabel="Privacy Policy">
          <Text style={styles.legalText}>Privacy Policy</Text>
        </Pressable>
        <Text style={styles.legalDot}>·</Text>
        <Pressable accessibilityRole="link" accessibilityLabel="Terms of Service">
          <Text style={styles.legalText}>Terms of Service</Text>
        </Pressable>
      </View>
      <View style={styles.homeBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  globeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  headline: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 42,
  },
  subtitle: {
    color: '#8e8e8e',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttons: {
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  btn: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnEmail: {
    backgroundColor: '#f5f5f5',
  },
  btnGoogle: {
    backgroundColor: '#262626',
  },
  btnEmailText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: '600',
  },
  btnGoogleText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  gBox: {
    width: 20,
    height: 20,
    position: 'relative',
  },
  gClip: {
    position: 'absolute',
    width: 10,
    height: 10,
    overflow: 'hidden',
  },
  gGlyph: {
    position: 'absolute',
    width: 20,
    height: 20,
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  error: {
    color: '#e5786a',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  legal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  legalText: {
    color: '#8e8e8e',
    fontSize: 12,
    fontWeight: '400',
    textDecorationLine: 'underline',
  },
  legalDot: {
    color: '#8e8e8e',
    fontSize: 12,
  },
  homeBar: {
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    marginTop: 16,
    opacity: 0.9,
  },
});
