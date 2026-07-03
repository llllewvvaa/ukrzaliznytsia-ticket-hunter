import { useEffect, useState } from 'react';
import { Button, Section, Toggle } from '@/components/ui';
import { DebugPanel } from '@/components/DebugPanel';
import { HuntIcon, SidebarIcon } from '@/components/icons';
import {
  applySidePanelBehavior,
  getSidePanelOnClick,
  openSidePanel,
  setSidePanelOnClick,
  sidePanelSupported,
} from '@/lib/sidepanel';
import { openOnboarding } from '@/lib/onboarding';

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

  return (
    <div className="space-y-4">
      {supported ? (
        <Section title="Бічна панель">
          <Toggle
            checked={onClick}
            onChange={(v) => void toggle(v)}
            label="Відкривати бічну панель за кліком на іконку"
            hint="Замість спливаючого вікна. Панель не закривається, коли клікаєш повз неї."
          />
          {surface === 'popup' ? (
            <Button
              size="sm"
              onClick={() => {
                void openSidePanel().then((ok) => {
                  if (ok) window.close();
                });
              }}
            >
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
        <Button size="sm" onClick={() => void openOnboarding()}>
          <HuntIcon className="h-4 w-4" /> Показати знайомство
        </Button>
      </Section>

      <DebugPanel />
    </div>
  );
}
