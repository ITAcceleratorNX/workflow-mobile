import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Office } from '../api';
import { findNearestOffice, formatDistance, nearestOfficeNotice } from '../nearest-office';

const office = (id: number, name: string, lat: unknown, lon: unknown) =>
  ({ id, name, city: 'Алматы', address: '', lat, lon }) as unknown as Office;

// Как в проде на 22.10.2026: координаты есть только у одного офиса.
const teniz = office(1, 'Teniz Towers', 43.214868, 76.872067);
const venus = office(3, 'Venus, бизнес-центр', null, null);
const nurlyTau = office(5, 'Нурлы-Тау', null, null);

// Один градус широты — около 111 км.
const north = (meters: number) => ({ lat: 43.214868 + meters / 111_000, lon: 76.872067 });

describe('the nearest office', () => {
  it('is recommended when the user is near it', () => {
    const result = findNearestOffice([venus, teniz, nurlyTau], north(120));
    assert.equal(result.kind, 'nearby');
    assert.equal(result.kind === 'nearby' && result.office, teniz);
  });

  it('is not recommended when the only office on the map is far away', () => {
    // Раньше единственный офис с координатами рекомендовался всем, где бы они ни были.
    const result = findNearestOffice([venus, teniz, nurlyTau], north(4000));
    assert.equal(result.kind, 'far');
    assert.match(nearestOfficeNotice(result).description, /Выберите офис вручную/);
  });

  it('picks the closer of two offices with coordinates', () => {
    const near = office(2, 'Коктем Grand', north(300).lat, north(300).lon);
    const result = findNearestOffice([teniz, near], north(250));
    assert.equal(result.kind === 'nearby' && result.office, near);
  });

  it('reads coordinates sent as strings and skips empty ones', () => {
    const asStrings = office(4, 'Коктем-2', '43.214868', '76.872067');
    const empty = office(6, 'Без адреса', '', '');
    const result = findNearestOffice([empty, asStrings], north(50));
    assert.equal(result.kind === 'nearby' && result.office, asStrings);
  });

  it('does not invent an office when none has coordinates', () => {
    // Раньше возвращался первый офис списка, будто он ближайший.
    const result = findNearestOffice([venus, nurlyTau], north(0));
    assert.deepEqual(result, { kind: 'no_coordinates' });
    assert.equal(nearestOfficeNotice(result).variant, 'default');
  });

  it('names the office and the distance in the recommendation', () => {
    const notice = nearestOfficeNotice({ kind: 'nearby', office: teniz, distanceMeters: 118 });
    assert.deepEqual(notice, {
      title: 'Ближайший офис',
      description: 'Teniz Towers — около 120 м от вас',
      variant: 'success',
    });
  });
});

describe('a distance for people', () => {
  it('rounds meters and switches to kilometers', () => {
    assert.equal(formatDistance(3), '10 м');
    assert.equal(formatDistance(994), '990 м');
    assert.equal(formatDistance(1000), '1,0 км');
    assert.equal(formatDistance(4230), '4,2 км');
  });
});
