import { AVATAR_SIZE, removeMyAvatar, setMyAvatar } from '@booksyde/shared';
import { radii, spacing } from '@booksyde/theme';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/*
 * Your photo: take a selfie or pick one from your library, square it up in
 * the system cropper, and it's saved straight away (apart from the rest of
 * the bookplate form). Mirrors apps/web/src/app/settings/profile/avatar-picker.tsx.
 */

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 1,
};

/** Square it (in case the cropper was skipped), shrink it, and get the JPEG bytes. */
async function prepare(asset: ImagePicker.ImagePickerAsset) {
  const side = Math.min(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  if (side > 0 && asset.width !== asset.height) {
    context.crop({ originX: (asset.width - side) / 2, originY: (asset.height - side) / 2, width: side, height: side });
  }
  context.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return (await fetch(saved.uri)).arrayBuffer();
}

function explain(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message, [
    { text: 'Not now', style: 'cancel' },
    { text: 'Open Settings', onPress: () => Linking.openSettings() },
  ]);
}

export function AvatarPicker({ hasPhoto, onChange }: { hasPhoto: boolean; onChange: (url: string | null) => void }) {
  const theme = useTheme();
  const [busy, setBusy] = useState<'saving' | 'removing' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(source: 'camera' | 'library') {
    if (!supabase || busy) return;
    setError(null);
    let result: ImagePicker.ImagePickerResult;
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          explain('Booksyde can’t use your camera', 'To take a selfie for your bookplate, allow camera access for Booksyde in Settings.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ ...pickerOptions, cameraType: ImagePicker.CameraType.front });
      } else {
        result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      }
    } catch {
      setError(source === 'camera' ? 'We couldn’t open your camera.' : 'We couldn’t open your photos.');
      return;
    }
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;

    setBusy('saving');
    try {
      const url = await setMyAvatar(supabase, await prepare(asset), 'image/jpeg');
      onChange(url);
      // Nudges every screen's session listener, so the new photo shows up everywhere.
      await supabase.auth.refreshSession().catch(() => {});
    } catch {
      setError('We couldn’t save your photo. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!supabase || busy) return;
    setError(null);
    setBusy('removing');
    try {
      await removeMyAvatar(supabase);
      onChange(null);
      await supabase.auth.refreshSession().catch(() => {});
    } catch {
      setError('We couldn’t remove your photo. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  const chip = [styles.chip, { borderColor: theme.border, opacity: busy ? 0.6 : 1 }];
  return (
    <View style={{ gap: spacing[3] }}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => pick('camera')} style={chip}>
          <Text style={[styles.chipLabel, { color: theme.text }]}>Take a selfie</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => pick('library')} style={chip}>
          <Text style={[styles.chipLabel, { color: theme.text }]}>{hasPhoto ? 'Choose a new photo' : 'Choose a photo'}</Text>
        </Pressable>
        {hasPhoto ? (
          <Pressable accessibilityRole="button" disabled={!!busy} onPress={remove} style={chip}>
            <Text style={[styles.chipLabel, { color: theme.accent }]}>{busy === 'removing' ? 'Removing…' : 'Remove'}</Text>
          </Pressable>
        ) : null}
        {busy === 'saving' ? <ActivityIndicator color={theme.textSecondary} accessibilityLabel="Saving your photo" /> : null}
      </View>
      {error ? <Text style={{ color: theme.accent, fontSize: 14 }}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2] },
  chip: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  chipLabel: { fontSize: 14, fontWeight: '700' },
});
