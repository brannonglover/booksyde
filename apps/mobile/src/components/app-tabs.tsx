import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSegments } from 'expo-router';
import { TabList, type TabListProps, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { type ComponentProps, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChromeMaxScale, TabBarHeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/*
 * The app's own tab bar: a plain full-width bar in the Booksyde colours,
 * slightly see-through so pages show faintly as they scroll underneath, with
 * a single hairline on top. The current tab turns library green and a short
 * bar slides along the top edge to it.
 */

type Icon = {
  ios: SymbolViewProps['name'];
  selected: SymbolViewProps['name'];
  material: ComponentProps<typeof MaterialIcons>['name'];
  /** Wide symbols (three people) draw small at the same point size. */
  size?: number;
};

const tabs: { name: string; href: '/' | '/search' | '/shelves' | '/discover' | '/clubs'; label: string; icon: Icon }[] = [
  { name: 'index', href: '/', label: 'Home', icon: { ios: 'house', selected: 'house.fill', material: 'home' } },
  { name: 'search', href: '/search', label: 'Search', icon: { ios: 'magnifyingglass', selected: 'magnifyingglass', material: 'search' } },
  { name: 'shelves', href: '/shelves', label: 'Shelves', icon: { ios: 'books.vertical', selected: 'books.vertical.fill', material: 'collections-bookmark' } },
  { name: 'discover', href: '/discover', label: 'Discover', icon: { ios: 'safari', selected: 'safari.fill', material: 'explore' } },
  { name: 'clubs', href: '/clubs', label: 'Clubs', icon: { ios: 'person.3', selected: 'person.3.fill', material: 'groups', size: 27 } },
];

/** How much of the page shows through the bar (0 = solid). */
const SEE_THROUGH = 0.12;
const INDICATOR = 28;

/** "#F3ECE0" + 0.88 → "rgba(243,236,224,0.88)". */
function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <TabBar>
          {tabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton label={tab.label} icon={tab.icon} />
            </TabTrigger>
          ))}
        </TabBar>
      </TabList>
    </Tabs>
  );
}

// TabList passes a row layout in `style`; the bar lays out its own row, so that style is dropped.
function TabBar({ children, style: _style, ...props }: TabListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const [width, setWidth] = useState(0);

  // Which tab is showing: the route after the (tabs) group, or Home.
  const current = segments[0] === '(tabs)' ? (segments[1] ?? 'index') : 'index';
  const index = Math.max(0, tabs.findIndex((t) => t.name === current));
  const slot = width / tabs.length;
  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(index * slot + (slot - INDICATOR) / 2, { damping: 20, stiffness: 220 }) }],
  }));

  return (
    <View
      {...props}
      style={[
        styles.bar,
        { paddingBottom: insets.bottom, backgroundColor: withAlpha(theme.background, 1 - SEE_THROUGH), borderTopColor: theme.border },
      ]}
    >
      <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? <Animated.View style={[styles.indicator, { backgroundColor: theme.primary }, indicator]} /> : null}
        {children}
      </View>
    </View>
  );
}

function TabButton({ label, icon, isFocused, ...props }: TabTriggerSlotProps & { label: string; icon: Icon }) {
  const theme = useTheme();
  const color = isFocused ? theme.primary : theme.textSecondary;
  return (
    // expo-router types the slot ref as a component ref; Pressable wants an element ref.
    <Pressable
      {...(props as PressableProps)}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.icon}>
        <SymbolView
          name={isFocused ? icon.selected : icon.ios}
          tintColor={color}
          size={icon.size ?? 22}
          fallback={<MaterialIcons name={icon.material} size={24} color={color} />}
        />
      </View>
      <Text maxFontSizeMultiplier={ChromeMaxScale} style={[styles.label, { color, fontWeight: isFocused ? '600' : '500' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth },
  // On iPad the bar spans a wide screen; the five tabs keep to a phone-width row in its middle.
  row: { height: TabBarHeight, width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row' },
  indicator: { position: 'absolute', top: 0, left: 0, width: INDICATOR, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 2 },
  icon: { height: 28, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 11 },
});
