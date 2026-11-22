import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FOOT_COLORS,
  FOOT_DASH,
  formatClock,
  formatLimit,
  formatSignal,
  unitsCaption,
} from '@prostriveorg/ui';
import {
  clockReading,
  DISPLAY_SIGNAL_MAX,
  readImus,
  signalColor,
  signalSummary,
} from '@prostriveorg/ui/dynamic/data';

test('format helpers', () => {
  assert.equal(formatClock(-5), '0:00.0');
  assert.equal(formatClock(61_250), '1:01.2');
  assert.equal(formatLimit(300_000), '5:00');
  assert.equal(formatSignal(null), '—');
  assert.equal(formatSignal(1234.6), '1235');
  assert.equal(formatSignal(0.012345), '0.0123');
  // Units are shown as recorded and never invented.
  assert.equal(unitsCaption('unknown units'), 'units not recorded');
  assert.equal(unitsCaption(''), 'units not recorded');
  assert.equal(unitsCaption('relative signal'), 'relative signal');
  assert.equal(unitsCaption('kPa'), 'kPa');
});

test('foot tokens never rely on colour alone', () => {
  assert.notEqual(FOOT_COLORS.Left, FOOT_COLORS.Right);
  assert.deepEqual(FOOT_DASH.Left, []);
  assert.ok(FOOT_DASH.Right.length > 0);
});

test('signal readout preserves raw amplitudes, zero readings and missing data', () => {
  assert.equal(signalSummary(null), null);
  assert.deepEqual(signalSummary(new Uint16Array(64)), { mean: 0, peak: 0, total: 0 });
  assert.deepEqual(signalSummary([100, 200, 5000, 0]), { mean: 1325, peak: 5000, total: 5300 });
  assert.deepEqual(signalSummary([-5, -1]), { mean: -3, peak: -1, total: -6 });
  assert.equal(signalColor(0), 'rgb(233,240,245)');
  assert.equal(signalColor(DISPLAY_SIGNAL_MAX), 'rgb(120,12,30)');
  assert.equal(signalColor(DISPLAY_SIGNAL_MAX * 10), signalColor(DISPLAY_SIGNAL_MAX));
});

test('elapsed and remaining derive from one box-clock anchor, not preview samples', () => {
  const reading = clockReading({
    anchorMs: 12_000,
    observedAt: 1000,
    now: 3500,
    maxDurationMs: 300_000,
    running: true,
  });
  assert.equal(reading.elapsedMs, 14_500);
  assert.equal(reading.elapsedMs + reading.remainingMs, 300_000);
  const held = clockReading({
    anchorMs: 12_000,
    observedAt: 1000,
    now: 50_000,
    maxDurationMs: 300_000,
    running: false,
  });
  assert.equal(held.elapsedMs, 12_000);
  const capped = clockReading({
    anchorMs: 299_000,
    observedAt: 0,
    now: 10_000,
    maxDurationMs: 300_000,
    running: true,
  });
  assert.equal(capped.elapsedMs, 300_000);
  assert.equal(capped.fraction, 1);
});

test('a malformed IMU never discards the pressure sample and is never treated as valid', () => {
  assert.deepEqual(readImus(undefined), [{ status: 'missing' }, { status: 'missing' }]);
  assert.deepEqual(readImus([1]), [{ status: 'invalid' }, { status: 'invalid' }]);
  const raw = { accel: [0, 0, 9.8], gyro: [0, 0, 0], mag: [1, 2, 3] };
  assert.equal(readImus([{ raw }, null])[0].status, 'valid');
  assert.equal(readImus([{ raw }, null])[1].status, 'missing');
  assert.equal(readImus([{ raw: { ...raw, gyro: [0, NaN, 0] } }, null])[0].status, 'invalid');
  assert.equal(readImus([{ raw, orientation: [0, 0, 0, 2] }, null])[0].status, 'invalid');
});
