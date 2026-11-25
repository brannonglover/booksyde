import { Children, type ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

/**
 * Lays children out in equal columns, row by row, like a CSS grid. With one
 * column it is a plain stack, so phones look as before; iPad passes more
 * (see useColumns). Cells in a row share its height, and a short last row
 * keeps its cells the same width as the rest.
 */
export function Grid({
  columns,
  gap,
  rowGap = gap,
  style,
  children,
}: {
  columns: number;
  gap: number;
  rowGap?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const items = Children.toArray(children);
  if (columns <= 1) return <View style={[{ gap: rowGap }, style]}>{items}</View>;
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={[{ gap: rowGap }, style]}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap }}>
          {row.map((item, c) => (
            <View key={c} style={{ flex: 1, minWidth: 0 }}>
              {item}
            </View>
          ))}
          {/* Empty cells hold the last row's columns at full-row width. */}
          {Array.from({ length: columns - row.length }, (_, c) => (
            <View key={`pad-${c}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}
