import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeProgressMetrics,
  formatStudentFirstName,
  isValidCustomPhotoDataUrl,
  shouldSkipCoverFromSearch,
} from './coverHelpers';

test('shouldSkipCoverFromSearch detects autostart=1 and autostart=true', () => {
  assert.equal(shouldSkipCoverFromSearch(''), false);
  assert.equal(shouldSkipCoverFromSearch('?tab=study'), false);
  assert.equal(shouldSkipCoverFromSearch('?autostart=0'), false);
  assert.equal(shouldSkipCoverFromSearch('?autostart=1'), true);
  assert.equal(shouldSkipCoverFromSearch('autostart=1&mode=dark'), true);
  assert.equal(shouldSkipCoverFromSearch('?autostart=true'), true);
});

test('formatStudentFirstName extracts first name or email local-part cleanly', () => {
  assert.equal(formatStudentFirstName('Mariana Silva', 'mari@ewm.com'), 'Mariana');
  assert.equal(formatStudentFirstName('  Igor   Souza ', null), 'Igor');
  assert.equal(formatStudentFirstName('', 'igordesouzaar@gmail.com'), 'igordesouzaar');
  assert.equal(formatStudentFirstName(null, null), 'aluno(a)');
});

test('isValidCustomPhotoDataUrl accepts valid base64 image data URLs and rejects invalid inputs', () => {
  const validJpeg = 'data:image/jpeg;base64,' + 'A'.repeat(64);
  const validWebp = 'data:image/webp;base64,' + 'B'.repeat(64);
  assert.equal(isValidCustomPhotoDataUrl(validJpeg), true);
  assert.equal(isValidCustomPhotoDataUrl(validWebp), true);
  assert.equal(isValidCustomPhotoDataUrl('https://example.com/photo.jpg'), false);
  assert.equal(isValidCustomPhotoDataUrl('javascript:alert(1)'), false);
  assert.equal(isValidCustomPhotoDataUrl('data:text/html;base64,PHNjcmlwdD4='), false);
  assert.equal(isValidCustomPhotoDataUrl(null), false);
});

test('computeProgressMetrics calculates accurate percentages and bounds for Recharts donut chart', () => {
  // New visitor: 0 mastered, 0 review, 172 unseen
  const initial = computeProgressMetrics(172, 0, 0);
  assert.equal(initial.total, 172);
  assert.equal(initial.mastered, 0);
  assert.equal(initial.review, 0);
  assert.equal(initial.unseen, 172);
  assert.equal(initial.masteredPercentage, 0);
  assert.equal(initial.reviewPercentage, 0);
  assert.equal(initial.unseenPercentage, 100);

  // Partial progress: 86 mastered (50%), 43 review (25%), 43 unseen (25%)
  const partial = computeProgressMetrics(172, 86, 43);
  assert.equal(partial.mastered, 86);
  assert.equal(partial.review, 43);
  assert.equal(partial.unseen, 43);
  assert.equal(partial.masteredPercentage, 50);
  assert.equal(partial.reviewPercentage, 25);
  assert.equal(partial.unseenPercentage, 25);

  // Defensive zero cards
  const zero = computeProgressMetrics(0, 0, 0);
  assert.equal(zero.masteredPercentage, 0);
  assert.equal(zero.unseenPercentage, 100);
});
