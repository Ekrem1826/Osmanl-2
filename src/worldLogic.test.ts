import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSeededRandom,
  getPeninsulaElevation,
  isPeninsulaLand,
  SEVEN_HILLS,
  LANDMARKS,
  GUIDED_TOUR_KEYFRAMES,
  evaluateTourAtTime,
  HISTORICAL_REGIONS,
  findRegionAtPoint,
  resolveNpcCollision,
  HISTORICAL_QUESTS,
} from './worldLogic';

test('seeded PRNG produces identical deterministic sequence', () => {
  const rng1 = createSeededRandom(1453);
  const rng2 = createSeededRandom(1453);
  for (let i = 0; i < 20; i++) {
    assert.equal(rng1(), rng2());
  }
});

test('Seven Hills (Yedi Tepe) stand elevated above sea level and water is negative', () => {
  assert.equal(SEVEN_HILLS.length, 7);
  for (const hill of SEVEN_HILLS) {
    const elev = getPeninsulaElevation(hill.x, hill.z);
    assert.ok(elev > 12, `${hill.name} should be elevated (>12m), got ${elev}`);
    assert.equal(isPeninsulaLand(hill.x, hill.z), true, `${hill.name} must be on peninsula land`);
  }
  const halicElev = getPeninsulaElevation(0, -165);
  assert.ok(halicElev < 0, `Golden Horn channel should be underwater (<0), got ${halicElev}`);
  const marmaraElev = getPeninsulaElevation(100, 320);
  assert.ok(marmaraElev < 0, `Marmara Sea should be underwater (<0), got ${marmaraElev}`);
});

test('all 14 required Mekânlar landmarks exist with valid Turkish certainty levels and interior types', () => {
  assert.equal(LANDMARKS.length, 14);
  const validCertainty = new Set(['Belgeli', 'Kısmen belgeli', 'Varsayımsal yeniden kurgu']);
  for (const lm of LANDMARKS) {
    assert.ok(lm.name.length > 3);
    assert.ok(lm.description.length > 40);
    assert.ok(validCertainty.has(lm.certainty), `Invalid certainty on ${lm.id}: ${lm.certainty}`);
  }
  const fatih = LANDMARKS.find((l) => l.id === 'fatih-camii');
  assert.ok(fatih);
  assert.equal(fatih.certainty, 'Varsayımsal yeniden kurgu');
  assert.equal(fatih.periodTag, '1451-1481');
});

test('9 historical regions cover the peninsula and resolve points accurately', () => {
  assert.equal(HISTORICAL_REGIONS.length, 9);
  const topkapiReg = findRegionAtPoint(355, -10);
  assert.equal(topkapiReg.id, 'topkapi-bolgesi');
  const fatihReg = findRegionAtPoint(-125, -45);
  assert.equal(fatihReg.id, 'fatih-bolgesi');
  const edirneReg = findRegionAtPoint(-440, -98);
  assert.equal(edirneReg.id, 'edirnekapi-bolgesi');
});

test('NPC collision avoidance separates overlapping agents so they do not pass through each other', () => {
  const [nx, nz] = resolveNpcCollision(10.0, 10.0, 10.5, 10.0, 1.8);
  const newDist = Math.hypot(nx - 10.5, nz - 10.0);
  assert.ok(newDist > 0.5, `Expected collision separation to push agent away, got dist=${newDist}`);
});

test('5 historical quests cover all requested open-world quest archetypes', () => {
  assert.equal(HISTORICAL_QUESTS.length, 5);
  const types = new Set(HISTORICAL_QUESTS.map((q) => q.type));
  assert.ok(types.has('lost_item'));
  assert.ok(types.has('escort'));
  assert.ok(types.has('explore'));
  assert.ok(types.has('history'));
  assert.ok(types.has('buy_item'));
});

test('guided tour covers at least 3 minutes (180s) and transitions time of day and seasons', () => {
  const lastFrame = GUIDED_TOUR_KEYFRAMES[GUIDED_TOUR_KEYFRAMES.length - 1];
  assert.ok(lastFrame.timeSec >= 180, 'Tour must be at least 180 seconds');
  const startState = evaluateTourAtTime(0);
  const midState = evaluateTourAtTime(90);
  const endState = evaluateTourAtTime(180);
  assert.equal(startState.progress, 0);
  assert.equal(endState.progress, 1);
  assert.notEqual(startState.season, endState.season);
  assert.ok(endState.timeOfDay > midState.timeOfDay);
});
