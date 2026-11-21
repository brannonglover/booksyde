import { palette } from '@booksyde/theme';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Polygon, RadialGradient, Stop } from 'react-native-svg';

/*
 * A cover drawn as a physical book lying on the page, as on the web home page
 * (apps/web/src/components/book-object): a crease down the spine, a sliver of
 * page edges along the fore-edge and foot, and a soft shadow underneath. With
 * `ribbon`, a bookmark ribbon hangs out of the bottom: the book you're partway
 * through.
 */

const PAGE = '#EFE6D2';
const PAGE_SHADE = '#D9CCB2';
const EDGE_LINE = 'rgba(31,27,22,0.28)';

/** Alternating 1pt lines of paper, like the edges of a stack of pages. */
function PageLines({ count, direction }: { count: number; direction: 'row' | 'column' }) {
  return (
    <View style={{ flex: 1, flexDirection: direction, overflow: 'hidden' }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? PAGE_SHADE : PAGE }} />
      ))}
    </View>
  );
}

export function BookObject({
  cover,
  width,
  ribbon = false,
}: {
  /** A BookCover `width` wide. */
  cover: ReactNode;
  width: number;
  ribbon?: boolean;
}) {
  const height = (width * 3) / 2;
  const ribbonWidth = Math.max(12, width * 0.07);
  const ribbonHeight = height * 0.22;
  return (
    <View style={{ width, height }}>
      {/* Shadow on the table, wider than the book and offset toward the page edges. The web blurs a
          dark ellipse; a view can't be blurred here, so it's an ellipse that fades out from its centre. */}
      <View style={[styles.shadow, { left: -width * 0.06, right: -width * 0.16 }]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="tableShadow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={palette.ink} stopOpacity={0.45} />
              <Stop offset="0.55" stopColor={palette.ink} stopOpacity={0.3} />
              <Stop offset="1" stopColor={palette.ink} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50" cy="50" rx="50" ry="50" fill="url(#tableShadow)" />
        </Svg>
      </View>

      {/* Page edges, peeking out past the cover along the fore-edge and the foot. */}
      <View style={[styles.edge, { top: 5, right: -7, bottom: 2, width: 9, borderTopRightRadius: 2, borderBottomRightRadius: 2 }]}>
        <PageLines count={9} direction="row" />
      </View>
      <View style={[styles.edge, { right: -5, bottom: -6, left: 5, height: 8, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }]}>
        <PageLines count={8} direction="column" />
      </View>

      {ribbon ? (
        // Tucked under the cover, so it seems to come from between the pages.
        <View
          style={[
            styles.ribbon,
            { top: height - 10, left: width * 0.66, width: ribbonWidth, height: ribbonHeight },
          ]}
        >
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="ribbonSheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#000" stopOpacity={0.18} />
                <Stop offset="0.45" stopColor="#fff" stopOpacity={0.12} />
                <Stop offset="1" stopColor="#000" stopOpacity={0.12} />
              </LinearGradient>
            </Defs>
            <Polygon points="0,0 100,0 100,100 50,84 0,100" fill={palette.oxblood} />
            <Polygon points="0,0 100,0 100,100 50,84 0,100" fill="url(#ribbonSheen)" />
          </Svg>
        </View>
      ) : null}

      <View>
        {cover}
        {/* The hinge: a crease a little way in from the spine. */}
        <View pointerEvents="none" style={[styles.hinge, { width: width * 0.09 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', bottom: -36, height: 72 },
  edge: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: EDGE_LINE,
  },
  ribbon: {
    position: 'absolute',
    transformOrigin: 'top',
    transform: [{ rotate: '5deg' }],
  },
  hinge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    experimental_backgroundImage:
      'linear-gradient(90deg, rgba(0,0,0,0.28), rgba(255,255,255,0.14) 30%, rgba(0,0,0,0.22) 55%, rgba(255,255,255,0.06) 75%, transparent)',
  },
});
