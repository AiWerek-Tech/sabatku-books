const MAX_OFFLINE_BYTES = 128 * 1024 * 1024;

export function validateBookCover(bytes) {
  const png = bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!png && !jpeg && !webp) throw Error('Book cover must be a PNG, JPEG, or WebP image');
}

export function validateEditionQuality(edition, bodies, coverBytes = 0) {
  const positions = new Set();
  const dates = new Set();
  let totalBytes = coverBytes;
  for (const node of edition.nodes) {
    if (!node.title.trim()) throw Error(`${edition.id}/${node.id}: empty title`);
    const position = `${node.parentId || ''}:${node.order}`;
    if (positions.has(position)) throw Error(`${edition.id}: duplicate sibling order ${node.order}`);
    positions.add(position);
    const body = bodies.get(node.id);
    totalBytes += body.length;
    if (!body.toString('utf8').trim()) throw Error(`${edition.id}/${node.id}: empty chapter`);
    if (node.readingDate) {
      const date = new Date(`${node.readingDate}T00:00:00Z`);
      if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== node.readingDate) throw Error(`${edition.id}: invalid reading date`);
      if (dates.has(node.readingDate)) throw Error(`${edition.id}: duplicate reading date ${node.readingDate}`);
      dates.add(node.readingDate);
    }
  }
  if (edition.rights.offlineAllowed && totalBytes > MAX_OFFLINE_BYTES) throw Error(`${edition.id}: exceeds Android's 128 MiB offline limit`);
  const period = edition.publicationPeriod;
  if (period && edition.status === 'published') {
    const start = new Date(`${period.startDate}T00:00:00Z`);
    const end = new Date(`${period.endDate}T00:00:00Z`);
    if (!Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf()) || start > end || start.getUTCFullYear() !== period.year || end.getUTCFullYear() !== period.year) throw Error(`${edition.id}: inconsistent publication period`);
    if (period.type === 'quarterly' && [start, end].some(date => Math.floor(date.getUTCMonth() / 3) + 1 !== period.quarter)) throw Error(`${edition.id}: dates fall outside the declared quarter`);
    for (const date of dates) if (date < period.startDate || date > period.endDate) throw Error(`${edition.id}: reading outside publication period`);
    if (period.cadence === 'weekly') {
      for (const date of dates) if (new Date(`${date}T00:00:00Z`).getUTCDay() !== 6) throw Error(`${edition.id}: weekly reading must fall on Sabbath`);
      for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
        if (date.getUTCDay() === 6 && !dates.has(date.toISOString().slice(0, 10))) throw Error(`${edition.id}: missing Sabbath reading ${date.toISOString().slice(0, 10)}`);
      }
    }
  }
  return { totalBytes, readings: dates.size };
}
