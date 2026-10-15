import { NativeTabs } from 'expo-router/unstable-native-tabs';

type Role = 'handler' | 'supervisor';

type AppTabsProps = {
  role: Role;
};

export default function AppTabs({ role }: AppTabsProps) {
  const isHandler = role === 'handler';

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>
          {isHandler ? 'Home' : 'Operations'}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {isHandler && (
        <NativeTabs.Trigger name="explore">
          <NativeTabs.Trigger.Label>My Tasks</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require('@/assets/images/tabIcons/explore.png')}
            renderingMode="template"
          />
        </NativeTabs.Trigger>
      )}

      {isHandler && (
        <NativeTabs.Trigger name="scan-qr">
          <NativeTabs.Trigger.Label>Scan QR</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{
              default: 'qrcode.viewfinder',
              selected: 'qrcode.viewfinder',
            }}
          />
        </NativeTabs.Trigger>
      )}

      {isHandler && (
        <NativeTabs.Trigger name="incidents">
          <NativeTabs.Trigger.Label>Incidents</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{
              default: 'exclamationmark.triangle',
              selected: 'exclamationmark.triangle',
            }}
          />
        </NativeTabs.Trigger>
      )}

      {!isHandler && (
        <NativeTabs.Trigger name="baggage">
          <NativeTabs.Trigger.Label>Baggage</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require('@/assets/images/tabIcons/explore.png')}
            renderingMode="template"
          />
        </NativeTabs.Trigger>
      )}

      {!isHandler && (
        <NativeTabs.Trigger name="crew">
          <NativeTabs.Trigger.Label>Crew</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require('@/assets/images/tabIcons/home.png')}
            renderingMode="template"
          />
        </NativeTabs.Trigger>
      )}

      {!isHandler && (
        <NativeTabs.Trigger name="delay-risk">
          <NativeTabs.Trigger.Label>Delay Risk</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{
              default: 'chart.bar',
              selected: 'chart.bar',
            }}
          />
        </NativeTabs.Trigger>
      )}

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: 'person.crop.circle',
            selected: 'person.crop.circle',
          }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}