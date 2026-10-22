import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  coordinatesMapUrl,
  hasOfficeCoordinates,
  officeCoordinatesInput,
  parseOfficeCoordinates,
  splitCoordinatesPair,
} from '../office-coordinates';

describe('office coordinates in the admin form', () => {
  it('fills both fields from a point copied in Google Maps or 2GIS', () => {
    assert.deepEqual(splitCoordinatesPair('43.214868, 76.872067'), { lat: '43.214868', lon: '76.872067' });
    assert.deepEqual(splitCoordinatesPair(' 43.2149 76.8721 '), { lat: '43.2149', lon: '76.8721' });
    // Десятичная запятая в одном поле — не пара.
    assert.equal(splitCoordinatesPair('43,2'), null);
    assert.equal(splitCoordinatesPair('43.2149'), null);
  });

  it('saves numbers, and only as a pair', () => {
    assert.deepEqual(parseOfficeCoordinates({ lat: '43,214868', lon: ' 76.872067 ' }), {
      ok: true,
      lat: 43.214868,
      lon: 76.872067,
    });
    assert.deepEqual(parseOfficeCoordinates({ lat: '', lon: '' }), { ok: true, lat: null, lon: null });
    assert.deepEqual(parseOfficeCoordinates({ lat: '', lon: '76.9' }), {
      ok: false,
      error: 'Укажите широту и долготу вместе или очистите обе',
    });
    assert.deepEqual(parseOfficeCoordinates({ lat: '43.2', lon: '200' }), {
      ok: false,
      error: 'Долгота — число от −180 до 180',
    });
  });

  it('shows what the API returns, NUMERIC as a string', () => {
    assert.deepEqual(officeCoordinatesInput({ lat: '43.214868', lon: '76.872067' }), {
      lat: '43.214868',
      lon: '76.872067',
    });
    assert.deepEqual(officeCoordinatesInput({ lat: null, lon: null }), { lat: '', lon: '' });
    assert.equal(hasOfficeCoordinates({ lat: null, lon: null }), false);
    assert.equal(hasOfficeCoordinates({ lat: 43.2, lon: 76.9 }), true);
    assert.match(coordinatesMapUrl(43.2, 76.9), /query=43\.2,76\.9$/);
  });
});
