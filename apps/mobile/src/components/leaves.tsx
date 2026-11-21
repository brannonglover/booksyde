import { leafArt, leafTransform, leavesArt } from '@booksyde/theme';
import { type StyleProp, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

/** A maple leaf in `color`, `size` points square. Same art as the web (apps/web/src/components/leaves.tsx). */
export function MapleLeaf({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox={leafArt.viewBox}>
      <Path d={leafArt.maple} fill={color} />
    </Svg>
  );
}

/**
 * Fallen autumn leaves scattered across the screen (leavesArt in
 * @booksyde/theme, as on the web). Takes its own height, so lay it out where
 * nothing else sits.
 */
export function LeafStrip({ style }: { style?: StyleProp<ViewStyle> }) {
  const { width } = useWindowDimensions();
  const a = leavesArt;
  const tiles = Math.ceil(width / a.width) + 1;
  const offset = (width - tiles * a.width) / 2;
  return (
    <View pointerEvents="none" style={[{ height: a.height, overflow: 'hidden' }, style]}>
      <Svg width={tiles * a.width} height={a.height} viewBox={`0 0 ${tiles * a.width} ${a.height}`} style={{ marginLeft: offset }}>
        {Array.from({ length: tiles }, (_, i) => (
          <G key={i} transform={`translate(${i * a.width} 0)`}>
            {a.leaves.map((leaf) => (
              <G key={`${leaf.x}-${leaf.y}`} transform={leafTransform(leaf)}>
                {leaf.shape === 'maple' ? (
                  <Path d={leafArt.maple} fill={leaf.color} />
                ) : (
                  <>
                    <Path d={leafArt.oval} fill={leaf.color} />
                    <Path d={leafArt.ovalVein} stroke="#000" strokeOpacity={0.25} strokeWidth={0.8} fill="none" />
                  </>
                )}
              </G>
            ))}
          </G>
        ))}
      </Svg>
    </View>
  );
}
