import { useEffect, useState } from 'react';
import { Button, Section, Toggle } from '@/components/ui';
import { DebugPanel } from '@/components/DebugPanel';
import { HuntIcon, SidebarIcon } from '@/components/icons';
import {
  applySidePanelBehavior,
  getSidePanelOnClick,
  openSidePanelAndClosePopup,
  setSidePanelOnClick,
  sidePanelSupported,
} from '@/lib/ui/sidepanel';
import { openOnboarding } from '@/lib/ui/onboarding';

export function SettingsView({ surface }: { surface: 'popup' | 'sidepanel' }) {
  const [onClick, setOnClick] = useState(false);
  const supported = sidePanelSupported();

  useEffect(() => {
    void getSidePanelOnClick().then(setOnClick);
  }, []);

  const toggle = async (v: boolean): Promise<void> => {
    setOnClick(v);
    await setSidePanelOnClick(v);
    await applySidePanelBehavior(v);
  };

  const handleToggleChange = (v: boolean): void => void toggle(v);

  const handleOpenSidePanel = (): void => openSidePanelAndClosePopup();

  const handleOpenOnboarding = (): void => void openOnboarding();

  return (
    <div className="space-y-4">
      {supported ? (
        <Section title="Бічна панель">
          <Toggle
            checked={onClick}
            onChange={handleToggleChange}
            label="Відкривати бічну панель за кліком на іконку"
            hint="Замість спливаючого вікна. Панель не закривається, коли клікаєш повз неї."
          />
          {surface === 'popup' ? (
            <Button size="sm" onClick={handleOpenSidePanel}>
              <SidebarIcon className="h-4 w-4" /> Відкрити зараз у бічній панелі
            </Button>
          ) : (
            <p className="text-xs text-gray-500">Ви вже в бічній панелі.</p>
          )}
        </Section>
      ) : null}

      <Section title="Довідка">
        <p className="text-xs text-gray-500">
          Покрокове знайомство з розширенням — що воно вміє й як ним користуватись.
        </p>
        <Button size="sm" onClick={handleOpenOnboarding}>
          <HuntIcon className="h-4 w-4" /> Показати знайомство
        </Button>
      </Section>

      <DebugPanel />
    </div>
  );
}
