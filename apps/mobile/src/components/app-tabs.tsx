import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // Image icons render as templates (tinted to the tab colors) on SDK 54.
  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <Label>Home</Label>
        <Icon src={require('@/assets/images/tabIcons/home.png')} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Label>Search</Label>
        <Icon src={require('@/assets/images/tabIcons/search.png')} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="discover">
        <Label>Discover</Label>
        <Icon sf="safari" androidSrc={<VectorIcon family={MaterialIcons} name="explore" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="clubs">
        <Label>Clubs</Label>
        <Icon sf="person.3" androidSrc={<VectorIcon family={MaterialIcons} name="groups" />} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
