import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPreviewBuffers,
  exactU64,
  footStatus,
  imuPoints,
  ingestSample,
  latestPressure,
  liveRate,
  parseSample,
  PREVIEW_CAPACITY,
  PREVIEW_WINDOW_MS,
  PreviewBuffer,
  previewKind,
  previewKinds,
  previewStatus,
  relativeMs,
  STALE_AFTER_MS,
  windowPeak,
} from '@prostriveorg/ui/dynamic/data';

import { sampleFrame } from './helpers/sampleFrame.ts';

test('validates preview fields without rounding unsafe counters', () => {
  const input = sampleFrame('Left', 1);
  assert.ok(parseSample(input, 0));
  assert.equal(parseSample(null, 0), null);
  assert.equal(parseSample({ ...input, foot: 'Both' }, 0), null);
  assert.equal(parseSample({ ...input, sample: { ...input.sample, pressure: [1] } }, 0), null);
  assert.equal(
    parseSample({ ...input, sample: { ...input.sample, pressure: Array(64).fill(Infinity) } }, 0),
    null,
  );
  assert.equal(
    parseSample({ ...input, sample: { ...input.sample, tick: Number.MAX_SAFE_INTEGER + 1 } }, 0),
    null,
  );
  assert.equal(
    parseSample({ ...input, sample: { ...input.sample, tick: '18446744073709551615' } }, 0)?.tick,
    '18446744073709551615',
  );
  assert.equal(
    parseSample({ ...input, sample: { ...input.sample, tick: '18446744073709551616' } }, 0),
    null,
  );
});

test('original channel values are copied unchanged and in electrical order', () => {
  const input = sampleFrame('Right', 7);
  const point = parseSample(input, 5)!;
  assert.deepEqual(point.pressure, input.sample.pressure);
  assert.notEqual(point.pressure, input.sample.pressure);
  assert.equal(point.peak, Math.max(...input.sample.pressure));
});

test('exact nanosecond strings survive; only bounded differences become numbers', () => {
  const ts = '1763846400123456789';
  const point = parseSample(
    { foot: 'Left', sample: { pressure: Array(64).fill(1), tick: 3, timestampNsExact: ts } },
    0,
  )!;
  assert.equal(point.timestampNs, ts);
  // A Number would have rounded this timestamp; the string is kept exactly.
  assert.notEqual(String(Number(ts)), ts);
  assert.equal(relativeMs('1763846400123456789', '1763846400000000000'), 123.456);
  assert.equal(relativeMs('18446744073709551615', '18446744073709550615'), 0.001);
  assert.equal(relativeMs('5000000', '0'), 5);
  assert.equal(exactU64(-1), null);
  assert.equal(exactU64('01'), null);
  assert.equal(exactU64(1.5), null);
});

test('bounded buffers retain chronological recent samples and expire old points', () => {
  const buffer = new PreviewBuffer();
  for (let i = 0; i < 5000; i++) buffer.push(parseSample(sampleFrame('Left', i), i)!);
  assert.equal(buffer.count, 5000);
  const points = buffer.points(5000);
  assert.equal(points.length, PREVIEW_CAPACITY);
  assert.equal(points[0].tick, String(5000 - PREVIEW_CAPACITY));
  assert.equal(points[points.length - 1].tick, '4999');
  assert.equal(buffer.points(5000 + PREVIEW_WINDOW_MS + 1).length, 0);
  buffer.clear();
  assert.equal(buffer.latest, null);
  assert.equal(buffer.count, 0);
});

test('duplicates do not refresh freshness; gaps and source resets break traces', () => {
  const buffer = new PreviewBuffer();
  buffer.push(parseSample(sampleFrame('Right', 10), 0)!);
  assert.equal(buffer.push(parseSample(sampleFrame('Right', 10), 900)!), false);
  assert.equal(previewStatus(buffer, 1100, true, true), 'Stale');
  buffer.push(parseSample(sampleFrame('Right', 11), 1200)!);
  assert.equal(buffer.latest?.breakBefore, true);
  buffer.push(parseSample(sampleFrame('Right', 12), 1220)!);
  assert.equal(buffer.latest?.breakBefore, false);
  // A source reset (counter back to 0) is a continuity break, never a continuation.
  buffer.push(parseSample(sampleFrame('Right', 0), 1240)!);
  assert.equal(buffer.latest?.breakBefore, true);
  assert.equal(buffer.gaps, 2);
  // A skipped box timestamp (> 30 ms) breaks the trace even when arrival is on time.
  buffer.push(parseSample(sampleFrame('Right', 5), 1260)!);
  assert.equal(buffer.latest?.breakBefore, true);
  assert.equal(previewStatus(buffer, 1240, false, true), 'Disconnected');
  assert.equal(previewStatus(buffer, 1240, true, false), 'Preview off');
});

test('per-foot missing, stale and disconnected states stay separate', () => {
  const buffers = createPreviewBuffers();
  const preview = { buffers, connected: true };
  assert.equal(ingestSample(buffers, sampleFrame('Left', 1), 0), 'accepted');
  assert.equal(ingestSample(buffers, sampleFrame('Left', 1), 10), 'duplicate');
  assert.equal(ingestSample(buffers, { foot: 'Left', sample: {} }, 10), 'rejected');
  // Right never sent anything: missing, not stale and not disconnected.
  assert.equal(footStatus(preview, 'Left', 100), 'Receiving');
  assert.equal(footStatus(preview, 'Right', 100), 'Waiting for samples');
  assert.deepEqual(previewKinds(preview, 100), { Left: 'receiving', Right: 'waiting' });
  assert.deepEqual(previewKinds(preview, STALE_AFTER_MS + 1), {
    Left: 'interrupted',
    Right: 'waiting',
  });
  assert.deepEqual(previewKinds({ ...preview, connected: false }, 100), {
    Left: 'disconnected',
    Right: 'disconnected',
  });
  assert.equal(footStatus({ ...preview, subscribed: false }, 'Left', 100), 'Preview off');
  assert.equal(previewKind('Preview off'), 'waiting');
  // Only a receiving foot contributes values; a stale foot shows no channel values.
  assert.ok(latestPressure(preview, 'Left', 100));
  assert.equal(latestPressure(preview, 'Left', STALE_AFTER_MS + 1), null);
  assert.equal(latestPressure(preview, 'Right', 100), null);
  assert.equal(windowPeak(preview, STALE_AFTER_MS + 1), 0);
  assert.equal(imuPoints(preview, 100).Right.length, 0);
});

test('live rate and movement points come from box timestamps, not arrival times', () => {
  const buffers = createPreviewBuffers();
  // Arrival bunched into 1 ms steps; box timestamps 20 ms apart → 50 Hz.
  for (let i = 0; i < 11; i++) ingestSample(buffers, sampleFrame('Left', i), i);
  assert.equal(liveRate(buffers.Left, 20), 50);
  const points = imuPoints({ buffers, connected: true }, 20, '20000000').Left;
  assert.equal(points.length, 11);
  assert.equal(points[0].tMs, -20);
  assert.equal(points[10].tMs, 180);
  assert.deepEqual(points[0].imus, [{ status: 'missing' }, { status: 'missing' }]);
});
