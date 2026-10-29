import { test } from "node:test";
import assert from "node:assert/strict";
import { hasCoordinates, parseCoordinate, parseCoordinates, yandexMapUrl, googleMapUrl, fitMapView } from "../src/maps.ts";

test("passport coordinates accept decimal dots, decimal commas and degrees/minutes/seconds", () => {
  for (const text of ["61.24, 73.4", "61,24; 73,4", "61,24 73,4", "61°14′24″ с. ш., 73°24′00″ в. д.", "61°14'24\" N, 73°24'00\" E"]) {
    const value = parseCoordinates(text);
    assert.ok(value, text);
    assert.ok(Math.abs(value.latitude - 61.24) < .000001, text);
    assert.ok(Math.abs(value.longitude - 73.4) < .000001, text);
  }
  assert.equal(parseCoordinate("61,24", "latitude"), 61.24);
  assert.equal(parseCoordinate("61°14′24″", "latitude"), 61.24);
});
test("coordinates reject swapped axes, invalid angles, out-of-region points and incomplete values", () => {
  for (const text of ["73.4, 61.24", "61°60′00″ N, 73°24′00″ E", "61°14′24″ E, 73°24′00″ N", "55.75, 37.61", "61.24", "NaN, 73.4"]) assert.equal(parseCoordinates(text), null, text);
  assert.equal(hasCoordinates({ latitude: null, longitude: 73 }), false);
  assert.equal(hasCoordinates({ latitude: NaN, longitude: 73 }), false);
});
test("Yandex uses longitude/latitude while Google uses latitude/longitude without leaking user text", () => {
  const point = { id: "test", title: '<script>alert(1)</script>', latitude: 61.24, longitude: 73.4, approximate: true };
  const url = new URL(yandexMapUrl([point], { ...point, zoom: 13 }));
  assert.equal(url.origin, "https://yandex.ru");
  assert.equal(url.pathname, "/map-widget/v1/");
  assert.equal(url.searchParams.get("ll"), "73.4,61.24");
  assert.equal(url.searchParams.get("pt"), "73.4,61.24");
  assert.ok(!url.href.includes("script"));
  assert.equal(new URL(googleMapUrl(point)).searchParams.get("query"), "61.24,73.4");
});
test("map view fits the actual filtered places and centers a single point without a fabricated location", () => {
  assert.deepEqual(fitMapView([{ latitude: 61.24, longitude: 73.4 }]), { latitude: 61.24, longitude: 73.4, zoom: 13 });
  const view = fitMapView([{ latitude: 60, longitude: 70 }, { latitude: 63, longitude: 77 }]);
  assert.ok(view.latitude > 60 && view.latitude < 63);
  assert.ok(view.longitude > 70 && view.longitude < 77);
  assert.ok(view.zoom >= 4 && view.zoom <= 10);
});
