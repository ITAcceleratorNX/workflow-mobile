import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { keyboardOverlap } from '../keyboard-overlap';

describe('the part of a screen the keyboard covers', () => {
  it('adds the navigation bar under the keyboard on Android, where the screen reaches under it', () => {
    assert.equal(keyboardOverlap(300, 24, 'android'), 324);
    assert.equal(keyboardOverlap(300, 0, 'android'), 300, 'A screen that stops above the bar');
  });

  it('takes the height as it is on iOS, where it counts from the bottom edge of the screen', () => {
    assert.equal(keyboardOverlap(336, 34, 'ios'), 336);
  });

  it('covers nothing while the keyboard is hidden', () => {
    for (const os of ['android', 'ios', 'web']) assert.equal(keyboardOverlap(0, 34, os), 0, os);
  });
});
