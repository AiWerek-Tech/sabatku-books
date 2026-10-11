import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateEditionQuality,validateBookCover} from '../scripts/edition-quality.mjs';

function fixture() {
  const edition = {id: 'weekly', status: 'published', rights: {offlineAllowed: true},
    publicationPeriod: {type: 'quarterly', year: 2026, quarter: 4, cadence: 'weekly', startDate: '2026-10-03', endDate: '2026-10-17'},
    nodes: ['2026-10-03', '2026-10-10', '2026-10-17'].map((readingDate, order) => ({id: readingDate, title: 'Reading', order, readingDate}))};
  return {edition, bodies: new Map(edition.nodes.map(node => [node.id, Buffer.from('Reading body')]))};
}
test('a renamed HTML file cannot be published as a book cover', () => {
  assert.throws(() => validateBookCover(Buffer.from('<html>not a cover</html>')), /Book cover/);
  validateBookCover(Buffer.from([255, 216, 255, 224, 0, 0]));
});
test('missing Sabbath readings and duplicate dates block publication', () => {
  const {edition, bodies} = fixture();
  validateEditionQuality(edition, bodies);
  edition.nodes.splice(1, 1);
  assert.throws(() => validateEditionQuality(edition, bodies), /missing Sabbath/);
  edition.nodes[1].readingDate = edition.nodes[0].readingDate;
  assert.throws(() => validateEditionQuality(edition, bodies), /duplicate reading date/);
});
test('calendar rollover and conflicting TOC positions are rejected', () => {
  const {edition, bodies} = fixture();
  edition.nodes[0].readingDate = '2026-02-30';
  assert.throws(() => validateEditionQuality(edition, bodies), /invalid reading date/);
  delete edition.nodes[0].readingDate;
  edition.nodes[1].order = edition.nodes[0].order;
  assert.throws(() => validateEditionQuality(edition, bodies), /duplicate sibling order/);
});
test('offline size includes cover bytes and refuses impossible mobile downloads', () => {
  const {edition, bodies} = fixture();
  assert.throws(() => validateEditionQuality(edition, bodies, 128 * 1024 * 1024), /offline limit/);
});
