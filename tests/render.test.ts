import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { MantineProvider } from '@mantine/core';
import {
  createPreviewBuffers,
  ImuSignals,
  LiveSignalPlot,
  LiveWorkspace,
  PressureField,
  RecordingStrip,
  resolveSource,
  SYNTHETIC_INSOLE_LAYOUT,
} from '@prostriveorg/ui/dynamic';
import type { ResolvedSource } from '@prostriveorg/ui/dynamic';
import { resolveSource as resolveFromData } from '@prostriveorg/ui/dynamic/data';
import { prostriveTheme } from '@prostriveorg/ui/theme';
import { createElement } from 'react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const descriptor = JSON.parse(
  readFileSync(new URL('./fixtures/simulation-descriptor.json', import.meta.url), 'utf8'),
).descriptor;
const html = (element: ReactElement) =>
  renderToStaticMarkup(createElement(MantineProvider, { theme: prostriveTheme }, element));
const channels = Array.from({ length: 64 }, (_, i) => i * 10);
const field = (source: ResolvedSource | null) =>
  html(
    createElement(PressureField, {
      live: true,
      left: channels,
      right: null,
      units: 'unknown units',
      source,
    }),
  );

test('without a resolved source the field keeps raw electrical-order channels', () => {
  const markup = field(null);
  assert.match(markup, /data-mode="raw"/);
  assert.match(markup, /Live sensor channels/);
  assert.match(markup, /Electrical order, not foot position/);
  assert.doesNotMatch(markup, /Pressure map view/);
  assert.match(markup, /Signal: units not recorded/);
});

test('a resolved simulator source opens the mapped field, labelled as generated', () => {
  const markup = field(resolveSource({ acquisitionMode: 'mock-ble', simulation: descriptor }));
  assert.match(markup, /data-mode="smooth"/);
  assert.match(markup, /Live pressure field/);
  assert.match(markup, /synthetic layout v1, not the hardware mapping/);
});

test('the data entry and the component entry share one source registry', () => {
  const markup = field(resolveFromData({ acquisitionMode: 'mock-ble', simulation: descriptor }));
  assert.match(markup, /data-mode="smooth"/);
});

test('a forged or cast binding for real hardware data still shows raw channels', () => {
  const real = resolveSource({ acquisitionMode: 'bluez', simulation: descriptor });
  assert.equal(real, null);
  const forged = {
    layout: SYNTHETIC_INSOLE_LAYOUT,
    reference: { id: SYNTHETIC_INSOLE_LAYOUT.id, version: SYNTHETIC_INSOLE_LAYOUT.version },
    simulation: {},
  } as unknown as ResolvedSource;
  const markup = field(forged);
  assert.match(markup, /data-mode="raw"/);
  assert.doesNotMatch(markup, /synthetic layout/);
});

test('movement sensors claim neither physical units nor placement by default', () => {
  const markup = html(
    createElement(ImuSignals, { getPoints: () => ({ Left: [], Right: [] }), live: true }),
  );
  assert.match(markup, /Placement not recorded/);
  assert.match(markup, /Movement sensor signals/);
});

test('live workspace, plot and strip render with waiting and disconnected inputs', () => {
  const preview = { buffers: createPreviewBuffers(), connected: false };
  const workspace = html(createElement(LiveWorkspace, { preview, units: 'unknown units' }));
  assert.match(workspace, /Overview/);
  assert.match(workspace, /No marked moments yet/);
  assert.match(workspace, /Recording details/);
  const plot = html(createElement(LiveSignalPlot, { preview: preview.buffers, units: 'kPa' }));
  assert.match(plot, /Mean of 64 channels · kPa · preview, last 10 s/);
  const strip = html(
    createElement(RecordingStrip, {
      recorder: { headline: 'Recording', detail: 'Conditions not entered', tone: 'live' },
      clock: null,
      limitMs: 300_000,
      running: false,
      preview: { Left: 'receiving', Right: 'disconnected' },
      previewDetail: 'The preview reconnects on its own.',
    }),
  );
  assert.match(strip, /Stops at 5:00/);
  assert.match(strip, /Left · Receiving/);
  assert.match(strip, /Right · Preview disconnected/);
  assert.match(strip, /data-kind="disconnected"/);
});
