import { describeNews, getNewsFeed, type NewsItem, newsBook, newsShelfTag, newsStory } from '@booksyde/shared';
import { radii, spacing } from '@booksyde/theme';
import { useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Grid } from '@/components/grid';
import { ChromeMaxScale, DisplayFonts, DisplayMaxScale } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/**
 * "This week in books", as on the web: moves on the bestseller lists, and new
 * books from the authors on the reader's shelves (theirs first). Nothing at
 * all until the daily news job has written something.
 */
export function NewsSection({ readerId }: { readerId: string | null }) {
  const theme = useTheme();
  const { md } = useBreakpoint();
  // Reloads on sign-in and out (readerId), since the reader's own stories come first.
  const { data } = useAsync(supabase ? () => getNewsFeed(supabase!, 6) : null, [readerId]);
  const items = (data ?? []).slice(0, md ? 6 : 4);
  if (!items.length) return null;
  const now = new Date();
  return (
    <View style={styles.section}>
      <View style={[styles.heading, { borderBottomColor: theme.border }]}>
        <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.kicker, { color: theme.accent }]}>
          IN THE NEWS
        </Text>
        <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.title, { color: theme.text }]}>
          This week in <Text style={{ fontFamily: DisplayFonts.italic, color: theme.accent }}>books</Text>
        </Text>
      </View>
      <Grid columns={md ? 2 : 1} gap={spacing[3]}>
        {items.map((item) => (
          <NewsCard key={item.id} item={item} now={now} />
        ))}
      </Grid>
    </View>
  );
}

function NewsCard({ item, now }: { item: NewsItem; now: Date }) {
  const theme = useTheme();
  const router = useRouter();
  const { badge, title, line, coverTitle } = describeNews(item, now);
  const book = newsBook(item);
  const story = newsStory(item);
  const shelf = newsShelfTag(item);
  // Two ways in: the card opens the book, and only the story line at the bottom opens the story where it lives.
  const openBook = book
    ? () => {
        if ('workId' in book) router.push({ pathname: '/book/[id]', params: { id: book.workId } });
        // A book that isn't in the catalogue yet goes to search, where it can be found and added.
        else router.push({ pathname: '/search', params: { q: book.search } });
      }
    : null;
  const openStory = story ? () => Linking.openURL(story.url) : null;
  const storyLine = (
    <>
      <Text style={[styles.line, { color: theme.text }]} numberOfLines={2}>
        {line}
      </Text>
      {item.source ? (
        <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.source, { color: openStory ? theme.accent : theme.textSecondary }]} numberOfLines={1}>
          {item.source}
          {openStory ? ' ↗' : ''}
        </Text>
      ) : null}
    </>
  );
  const heading = (
    <Text maxFontSizeMultiplier={DisplayMaxScale} style={[styles.bookTitle, { color: theme.text }]} numberOfLines={2}>
      {title}
    </Text>
  );
  return (
    <Pressable
      onPress={openBook ?? openStory ?? undefined}
      disabled={!openBook && !openStory}
      accessibilityRole={openBook ? 'button' : 'link'}
      accessibilityLabel={`${badge ? `${badge}: ` : ''}${title}${item.author_name ? ` by ${item.author_name}` : ''}. ${line}${shelf ? `. ${shelf.text}` : ''}`}
      accessibilityHint={openBook ? 'Opens the book' : 'Opens the story'}
      // The card reads as one element to a screen reader, so the story link inside it is offered as an action.
      accessibilityActions={openBook && openStory ? [{ name: 'openStory', label: 'Open the story' }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'openStory') openStory?.();
      }}
      style={{ flex: 1 }}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.card,
            { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement, borderColor: pressed ? theme.accent : theme.border },
          ]}
        >
          <BookCover title={coverTitle} author={item.author_name ?? ''} src={item.cover_url} color={item.cover_color} width={64} />
          <View style={styles.body}>
            <View style={styles.badges}>
              {badge ? (
                <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.badge, { color: theme.accent }]}>
                  {badge.toUpperCase()}
                </Text>
              ) : null}
              {shelf ? (
                <Text
                  maxFontSizeMultiplier={ChromeMaxScale}
                  style={[
                    styles.forYou,
                    shelf.onShelf
                      ? { color: theme.background, backgroundColor: theme.accent, borderColor: theme.accent }
                      : { color: theme.accent, borderColor: theme.accent },
                  ]}
                >
                  {shelf.text}
                </Text>
              ) : null}
            </View>
            {heading}
            {item.author_name ? (
              <Text style={[styles.byline, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.author_name}
              </Text>
            ) : null}
            {openStory && openBook ? (
              <Pressable
                onPress={openStory}
                accessibilityRole="link"
                accessibilityLabel={`${line}. ${item.source ?? ''}`}
                accessibilityHint="Opens the story"
                hitSlop={6}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                {storyLine}
              </Pressable>
            ) : (
              storyLine
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  heading: { gap: spacing[2], paddingBottom: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: spacing[1] },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 2.4 },
  title: { fontFamily: DisplayFonts.regular, fontSize: 34, lineHeight: 38 },
  card: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[4], borderWidth: 1, borderRadius: radii.lg, padding: spacing[4] },
  body: { flex: 1, minWidth: 0, gap: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2] },
  badge: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  forYou: { fontSize: 10, fontWeight: '700', borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  bookTitle: { fontFamily: DisplayFonts.regular, fontSize: 20, lineHeight: 24, marginTop: spacing[1] },
  byline: { fontSize: 14 },
  line: { fontSize: 14, fontWeight: '600', marginTop: spacing[1] },
  source: { fontSize: 12 },
});
