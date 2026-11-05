import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliveryDays, mapboxLocation } from '../src/lib/delivery-location';

test('Mapbox v6: location in Panama keeps the actual city, country, region and postcode', () => {
  assert.deepEqual(
    mapboxLocation({
      properties: {
        feature_type: 'address',
        context: {
          country: { country_code: 'pa', name: 'Panamá' },
          region: { name: 'Panamá', region_code_full: 'PA-8' },
          place: { name: 'Ciudad de Panamá' },
          postcode: { name: '0801' },
        },
      },
    }),
    {
      country: 'PA',
      countryName: 'Panamá',
      city: 'Ciudad de Panamá',
      state: 'PA-8',
      stateName: 'Panamá',
      postalCode: '0801',
    },
  );
});

test('Mapbox place results can be chosen without inventing a postcode', () => {
  const place = mapboxLocation({
    properties: {
      feature_type: 'place',
      name: 'David',
      context: {
        country: { country_code: 'PA', name: 'Panamá' },
        region: { name: 'Chiriquí', region_code: '4' },
      },
    },
  });
  assert.equal(place?.city, 'David');
  assert.equal(place?.postalCode, '');
  assert.equal(mapboxLocation({ properties: { feature_type: 'country', name: 'Panamá' } }), null);
});

test('shipping durations retain their day type, with no invented delivery times', () => {
  assert.equal(deliveryDays('3 - 5 días hábiles'), '3–5 días hábiles');
  assert.equal(deliveryDays('3 to 5 business days'), '3–5 días hábiles');
  assert.equal(deliveryDays('1 day'), '1 día');
  assert.equal(deliveryDays('2 días naturales'), '2 días naturales');
  assert.equal(deliveryDays('3–5 días'), '3–5 días');
  for (const input of [
    null,
    3,
    '',
    '2026-12-01',
    'Por confirmar',
    '5-2 días',
    '0 días',
    '120 days',
    '3 horas',
  ])
    assert.equal(deliveryDays(input), null);
});
