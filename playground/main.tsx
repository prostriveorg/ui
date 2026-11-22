import '@mantine/core/styles.css';
import '@prostriveorg/ui/fonts.css';
import '@prostriveorg/ui/styles.css';
import { Alert, Button, Container, MantineProvider, Stack, Tabs, Text, Title } from '@mantine/core';
import {
  LiveChannels,
  LiveMovement,
  LiveResponse,
  LiveSignalPlot,
  LiveWorkspace,
  previewKinds,
  RecordingStrip,
  StripLabel,
  useRecordingClock,
  useTick,
} from '@prostriveorg/ui/dynamic';
import type { LiveMarker, LivePreview, LiveView } from '@prostriveorg/ui/dynamic';
import { prostriveTheme } from '@prostriveorg/ui/theme';
import { Profiler, StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { mappedSource, SCENARIOS, startFeed } from './fixtures';
import type { Feed, Scenario } from './fixtures';

declare global {
  interface Window {
    /** Read by scripts/browser-check.mjs. */
    psuiPlayground?: {
      workspaceCommits: number;
      samples: () => number;
      buffered: () => { Left: number; Right: number };
      scenario: Scenario;
    };
  }
}

const params = new URLSearchParams(location.search);
const initialScenario = (params.get('scenario') as Scenario | null) ?? 'receiving';
const initialView = (params.get('view') as LiveView | null) ?? 'overview';
const initialTab = params.get('tab') ?? 'workspace';

/** The strip re-renders on its own 4 Hz tick, so the workspace below is not re-rendered by it. */
function StripDemo({ preview, startedAt }: { preview: LivePreview; startedAt: number }) {
  const now = useTick(4);
  const running = preview.connected;
  const clock = useRecordingClock({
    anchorMs: 0,
    observedAt: startedAt,
    maxDurationMs: 300_000,
    running,
  });
  return (
    <RecordingStrip
      sticky={false}
      recorder={{
        headline: running ? 'Recording (generated)' : 'Recording status unavailable',
        detail: 'Playground · generated data, no box connected',
        tone: running ? 'live' : 'attention',
      }}
      clock={clock}
      limitMs={300_000}
      running={running}
      preview={previewKinds(preview, now)}
      previewDetail="Preview only. It does not confirm the recording state."
      actions={
        <>
          <StripLabel style={{ flex: '1 1 160px', alignSelf: 'center' }}>
            Actions belong to the consuming application.
          </StripLabel>
          <Button size="md" color="red" disabled>
            Stop recording
          </Button>
        </>
      }
    />
  );
}

function App() {
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [markers, setMarkers] = useState<LiveMarker[]>([]);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [startedAt, setStartedAt] = useState(() => performance.now());
  useEffect(() => {
    const next = startFeed(scenario, setMarkers);
    setFeed(next);
    setMarkers([]);
    setStartedAt(performance.now());
    window.psuiPlayground = {
      workspaceCommits: 0,
      samples: () => next.accepted,
      buffered: () => ({
        Left: next.buffers.Left.points(performance.now()).length,
        Right: next.buffers.Right.points(performance.now()).length,
      }),
      scenario,
    };
    return () => next.stop();
  }, [scenario]);
  const preview = useMemo<LivePreview | null>(
    () => (feed ? { buffers: feed.buffers, connected: feed.connected } : null),
    [feed],
  );
  const source = useMemo(() => (scenario === 'mapped' ? mappedSource() : null), [scenario]);
  const units = 'relative signal';
  const description = SCENARIOS.find((s) => s.value === scenario)?.description;
  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={1}>ProStrive UI playground</Title>
          <Text size="sm" c="dimmed">
            @prostriveorg/ui/dynamic with generated data only. No box, recording or upload.
          </Text>
        </Stack>
        <Tabs value={scenario} onChange={(value) => value && setScenario(value as Scenario)}>
          <Tabs.List aria-label="Scenario">
            {SCENARIOS.map((s) => (
              <Tabs.Tab key={s.value} value={s.value}>
                {s.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
        <Alert variant="light" color="gray" title="Scenario">
          {description}
        </Alert>
        {preview && feed && (
          <>
            <StripDemo key={scenario} preview={preview} startedAt={startedAt} />
            <Tabs defaultValue={initialTab} keepMounted={false}>
              <Tabs.List aria-label="Component group">
                <Tabs.Tab value="workspace">Recording workspace</Tabs.Tab>
                <Tabs.Tab value="prepare">Prepare response</Tabs.Tab>
                <Tabs.Tab value="bench">Bench view</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="workspace" pt="md">
                <Profiler
                  id="workspace"
                  onRender={() => {
                    if (window.psuiPlayground) window.psuiPlayground.workspaceCommits++;
                  }}
                >
                  <LiveWorkspace
                    key={scenario}
                    preview={preview}
                    units={units}
                    source={source}
                    markers={markers}
                    recording={{ id: `playground-${scenario}`, startedTsNs: feed.startedTsNs }}
                    defaultView={initialView}
                  />
                </Profiler>
              </Tabs.Panel>
              <Tabs.Panel value="prepare" pt="md">
                <LiveResponse preview={preview} units={units} source={source} />
              </Tabs.Panel>
              <Tabs.Panel value="bench" pt="md">
                <Stack gap="sm">
                  <LiveChannels preview={preview} units={units} source={source} />
                  <LiveSignalPlot preview={preview.buffers} units={units} markers={markers} />
                  <LiveMovement preview={preview} source={source} originNs={feed.startedTsNs} />
                </Stack>
              </Tabs.Panel>
            </Tabs>
          </>
        )}
      </Stack>
    </Container>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={prostriveTheme}>
      <App />
    </MantineProvider>
  </StrictMode>,
);
