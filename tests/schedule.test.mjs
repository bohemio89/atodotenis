import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isoWeekKey, rankingWindowStart, isRankingWindowOpen,
  forecastRuns, forecastCalendarCalls
} from '../scripts/lib/schedule.mjs';

test('la semana ISO cambia el lunes y conserva el año ISO', () => {
  assert.equal(isoWeekKey(new Date('2026-11-15T23:59:00Z')), '2026-W46');
  assert.equal(isoWeekKey(new Date('2026-11-16T00:00:00Z')), '2026-W47');
  assert.equal(isoWeekKey(new Date('2021-01-01T12:00:00Z')), '2020-W53');
});

test('la ventana semanal comienza el lunes a las 18:00 UTC', () => {
  assert.equal(rankingWindowStart(new Date('2026-11-15T16:00:00Z')).toISOString(), '2026-11-09T18:00:00.000Z');
  assert.equal(isRankingWindowOpen(new Date('2026-11-16T17:59:59Z')), false);
  assert.equal(isRankingWindowOpen(new Date('2026-11-16T18:00:00Z')), true);
  assert.equal(isRankingWindowOpen(new Date('2026-11-17T08:00:00Z')), true);
});

test('el pronóstico de corridas y calendario redondea de forma conservadora', () => {
  assert.equal(forecastRuns(2, 30), 4);
  assert.equal(forecastRuns(0, 30), 0);
  assert.equal(forecastCalendarCalls(5, 6, 3), 3);
  assert.equal(forecastCalendarCalls(6, 6, 3), 3);
  assert.equal(forecastCalendarCalls(6.1, 6, 3), 6);
});
