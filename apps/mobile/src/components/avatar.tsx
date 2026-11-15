import { palette } from '@booksyde/theme';
import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { DisplayFonts } from '@/constants/theme';

/** A reader's photo, or the first letter of their name on their ink. Matches apps/web/src/components/avatar.tsx. */
export function Avatar({
  name,
  src,
  ink,
  size,
  style,
}: {
  name: string;
  /** profiles.avatar_url */
  src?: string | null;
  ink?: string | null;
  size: number;
  /** Extra frame, e.g. a gilt border. */
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: ink ?? palette.green }, style]}
    >
      {src ? (
        <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" />
      ) : (
        <Text style={{ color: palette.paper, fontFamily: DisplayFonts.regular, fontSize: size * 0.5 }}>{(name.trim() || '?').charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
