import { getMoodTags, getMoodVotes, MAX_MOOD_VOTES, type MoodTag, setMoodVote } from '@booksyde/shared';
import { genreColor, radii, spacing } from '@booksyde/theme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type Votes = { counts: Record<string, number>; mine: string[] };

/** "How did it feel to you?": readers pick up to three moods for a book. */
export function MoodVote({ workId }: { workId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const [moods, setMoods] = useState<MoodTag[]>([]);
  const [votes, setVotes] = useState<Votes | null>(null);
  const [note, setNote] = useState<'full' | 'error' | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;
    getMoodTags(client)
      .then(async (tags) => {
        if (cancelled) return;
        setMoods(tags);
        const v = await getMoodVotes(client, workId, tags);
        if (!cancelled) setVotes(v);
      })
      .catch(() => !cancelled && setVotes({ counts: {}, mine: [] }));
    return () => {
      cancelled = true;
    };
  }, [workId, session]);

  const toggle = async (mood: MoodTag) => {
    if (!supabase || !votes) return;
    if (!session) return router.push('/sign-in');
    const on = !votes.mine.includes(mood.id);
    if (on && votes.mine.length >= MAX_MOOD_VOTES) return setNote('full');
    setNote(null);

    // Show it at once; put it back if the save fails.
    const before = votes;
    setVotes({
      mine: on ? [...votes.mine, mood.id] : votes.mine.filter((id) => id !== mood.id),
      counts: { ...votes.counts, [mood.id]: Math.max(0, (votes.counts[mood.id] ?? 0) + (on ? 1 : -1)) },
    });
    try {
      await setMoodVote(supabase, workId, mood.id, on);
    } catch {
      setVotes(before);
      setNote('error');
    }
  };

  if (moods.length === 0) return null;
  const mine = votes?.mine ?? [];
  const full = mine.length >= MAX_MOOD_VOTES;
  return (
    <View style={{ gap: spacing[1] }}>
      <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>How did it feel to you?</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
        {!session
          ? 'Sign in to add your vote.'
          : mine.length
            ? `${mine.length} of ${MAX_MOOD_VOTES} picked. Tap one again to take it back.`
            : `Pick up to ${MAX_MOOD_VOTES}.`}
      </Text>
      <View style={styles.chips}>
        {moods.map((m) => {
          const picked = mine.includes(m.id);
          const count = votes?.counts[m.id] ?? 0;
          const tint = genreColor(m.slug).dot;
          return (
            <Pressable
              key={m.id}
              disabled={votes === null}
              onPress={() => toggle(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: picked, disabled: votes === null }}
              accessibilityLabel={`${m.name}${count ? `, ${count} ${count === 1 ? 'vote' : 'votes'}` : ''}`}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: picked ? tint : theme.backgroundElement,
                  borderColor: picked || pressed ? tint : theme.border,
                  opacity: votes === null || (full && !picked) ? 0.6 : 1,
                },
              ]}
            >
              {picked ? (
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>✓</Text>
              ) : (
                <View style={[styles.dot, { backgroundColor: tint }]} />
              )}
              <Text style={{ color: picked ? '#FFFFFF' : theme.text, fontSize: 14, fontWeight: '500' }}>{m.name}</Text>
              {count > 0 ? (
                <Text style={{ color: picked ? 'rgba(255,255,255,0.8)' : theme.textSecondary, fontSize: 13 }}>{count}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {note ? (
        <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: spacing[1] }}>
          {note === 'full' ? `You’ve picked ${MAX_MOOD_VOTES}. Take one back to choose another.` : 'That didn’t save. Try again in a moment.'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
