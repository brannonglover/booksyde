import type { ClubCard as Club } from '@booksyde/shared';
import { radii, spacing } from '@booksyde/theme';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { DEFAULT_INK } from '@/constants/inks';
import { DisplayFonts, DisplayMaxScale } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A club as a cloth-bound card: its colour, its name, what it's reading and how many are in it. */
export function ClubCard({ club, role }: { club: Club; role?: string }) {
  const read = club.currentRead;
  return (
    <Link href={{ pathname: '/clubs/[slug]', params: { slug: club.slug } }} asChild>
      {/* Grows to fill its grid cell on iPad, so cards side by side match heights. */}
      <Pressable style={styles.fill}>
        <ClubCardFace
          ink={club.cover_color ?? DEFAULT_INK}
          name={club.name}
          description={club.description}
          memberCount={club.memberCount}
          isPrivate={club.is_private}
          role={role}
          read={read ? read.work : null}
        />
      </Pressable>
    </Link>
  );
}

/** The card itself, also used as the live preview when starting a club. */
export function ClubCardFace({
  ink,
  name,
  description,
  memberCount,
  isPrivate,
  role,
  read,
}: {
  ink: string;
  name: string;
  description: string | null;
  memberCount: number;
  isPrivate: boolean;
  role?: string;
  read: { title: string; author: string; cover_url: string | null; cover_color: string | null } | null;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={[styles.cloth, { backgroundColor: ink }]} />
      <View style={styles.body}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            {memberCount} {memberCount === 1 ? 'READER' : 'READERS'}
            {isPrivate ? ' · 🔒 PRIVATE' : ''}
            {role && role !== 'member' ? <Text style={{ color: theme.accent }}> · {role.toUpperCase()}</Text> : null}
          </Text>
          <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.name, { color: theme.text }]}>{name}</Text>
          {description ? (
            <Text numberOfLines={2} style={{ color: theme.textSecondary, fontSize: 14, marginTop: spacing[1] }}>
              {description}
            </Text>
          ) : null}
          <Text style={{ color: theme.textSecondary, fontSize: 14, marginTop: spacing[3] }}>
            {read ? (
              <>
                Reading <Text style={[styles.title, { color: theme.text }]}>{read.title}</Text>
              </>
            ) : (
              <Text style={{ fontStyle: 'italic' }}>Choosing its first book</Text>
            )}
          </Text>
        </View>
        {read ? <BookCover title={read.title} author={read.author} src={read.cover_url} color={read.cover_color} width={60} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1 },
  card: { flexGrow: 1, flexDirection: 'row', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.lg },
  cloth: { width: 10 },
  body: { flex: 1, flexDirection: 'row', gap: spacing[4], padding: spacing[4] },
  meta: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  name: { fontFamily: DisplayFonts.regular, fontSize: 28, lineHeight: 30, marginTop: spacing[2] },
  title: { fontFamily: DisplayFonts.italic, fontSize: 17 },
});
