import { bowArt, christmas, garlandArt, hollyArt } from '@booksyde/theme';
import { type StyleProp, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';

/** How wide one swag of the garland is drawn, in points. */
const SWAG_WIDTH = 200;

/** A small sprig of holly: two leaves in `color` and three red berries. Same art as the web (apps/web/src/components/holly.tsx). */
export function HollySprig({ color, height = 16 }: { color: string; height?: number }) {
  return (
    <Svg width={height * 1.75} height={height} viewBox={hollyArt.viewBox}>
      <G fill={color}>
        {hollyArt.leaves.map((d) => (
          <Path key={d} d={d} />
        ))}
      </G>
      <G fill={christmas.berry}>
        {hollyArt.berries.map((b) => (
          <Circle key={`${b.cx}-${b.cy}`} {...b} />
        ))}
      </G>
    </Svg>
  );
}

/**
 * Today's pick, gift-wrapped (as on the web): a satin ribbon down the cover
 * with a bow where it crosses the top edge. Lies over a cover `width` wide.
 */
export function GiftWrap({ width }: { width: number }) {
  const bowWidth = width * 0.62;
  const bowHeight = (bowWidth * 72) / 100;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.band, { left: width * 0.67, width: width * 0.07 }]}>
        <Svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="bandSheen" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#000" stopOpacity={0.25} />
              <Stop offset="0.35" stopColor="#fff" stopOpacity={0.22} />
              <Stop offset="0.55" stopColor="#fff" stopOpacity={0.05} />
              <Stop offset="1" stopColor="#000" stopOpacity={0.22} />
            </LinearGradient>
          </Defs>
          <Path d="M0 0H10V10H0Z" fill={christmas.ribbon} />
          <Path d="M0 0H10V10H0Z" fill="url(#bandSheen)" />
        </Svg>
      </View>
      <View style={{ position: 'absolute', top: -width * 0.15, left: width * 0.705 - bowWidth / 2, width: bowWidth, height: bowHeight }}>
        <Svg width="100%" height="100%" viewBox={bowArt.viewBox}>
          <Defs>
            <LinearGradient id="bowSheen" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#fff" stopOpacity={0.28} />
              <Stop offset="0.5" stopColor="#fff" stopOpacity={0} />
              <Stop offset="1" stopColor="#000" stopOpacity={0.15} />
            </LinearGradient>
          </Defs>
          {bowArt.fill.map((d) => (
            <Path key={d} d={d} fill={christmas.ribbon} />
          ))}
          {bowArt.shade.map((d) => (
            <Path key={d} d={d} fill={christmas.ribbonShade} opacity={0.75} />
          ))}
          {bowArt.fill.map((d) => (
            <Path key={`s${d}`} d={d} fill="url(#bowSheen)" />
          ))}
          <Ellipse {...bowArt.knot} fill={christmas.ribbon} />
          <Ellipse {...bowArt.knot} fill="url(#bowSheen)" />
        </Svg>
      </View>
    </View>
  );
}

/**
 * An evergreen garland swagged between little red bows, across the screen (the
 * same art as the web's: garlandArt in @booksyde/theme). Position it with `style`.
 */
export function Garland({ style }: { style?: StyleProp<ViewStyle> }) {
  const { width } = useWindowDimensions();
  const g = garlandArt;
  const height = (SWAG_WIDTH * g.height) / g.width;
  // Centred like the web's (background-position: center), with a swag to spare at each end.
  const tiles = Math.ceil(width / SWAG_WIDTH) + 2;
  const offset = (width - tiles * SWAG_WIDTH) / 2;
  return (
    <View pointerEvents="none" style={[{ height, overflow: 'hidden' }, style]}>
      <Svg width={tiles * SWAG_WIDTH} height={height} viewBox={`0 0 ${tiles * g.width} ${g.height}`} style={{ marginLeft: offset }}>
        {Array.from({ length: tiles }, (_, i) => (
          <G key={i} transform={`translate(${i * g.width} 0)`}>
            {g.needles.map((n) => (
              <Path key={n.color} d={n.d} stroke={n.color} strokeWidth={1.7} strokeLinecap="round" fill="none" />
            ))}
            {g.berries.map((b) => (
              <Circle key={`${b.cx}-${b.cy}`} cx={b.cx} cy={b.cy} r={b.r} fill={g.berry} />
            ))}
            <Circle cx={g.bead.cx} cy={g.bead.cy} r={g.bead.r} fill={g.bead.color} />
            {/* One bow per post: the left one of each tile (the last tile's right post is off screen). */}
            <G transform={g.bows[0]}>
              {bowArt.fill.map((d) => (
                <Path key={d} d={d} fill={christmas.ribbon} />
              ))}
              {bowArt.shade.map((d) => (
                <Path key={d} d={d} fill={christmas.ribbonShade} opacity={0.75} />
              ))}
              <Ellipse {...bowArt.knot} fill={christmas.ribbon} />
            </G>
          </G>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    shadowColor: '#1F1B16',
    shadowOpacity: 0.35,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 0 },
  },
});
