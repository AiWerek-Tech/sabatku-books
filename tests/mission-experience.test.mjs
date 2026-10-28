import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {build, root} from '../scripts/build-content.mjs';

test('mission companion references canonical editions, exact Sabbath dates and separate English provider readings', () => {
  build(root);
  const q = JSON.parse(fs.readFileSync(path.join(root, 'mission/2026-q4.json')));
  assert.equal(q.countries.length, 4);
  assert.equal(q.projects.length, 4);
  for (const role of ['children','youth-adult']) {
    const edition = JSON.parse(fs.readFileSync(path.join(root, `content/id/mission-stories/2026-q4-${role}/edition.json`)));
    assert.equal(q.stories[role].length, edition.nodes.length);
    q.stories[role].forEach((story, index) => {
      const node = edition.nodes[index];
      assert.equal(story.id, node.id);
      assert.equal(story.date, node.readingDate);
      assert.equal(new Date(story.date + 'T12:00:00Z').getUTCDay(), 6);
      assert.match(story.englishTextUrl, /^https:\/\/sabbath-school\.adventech\.io\/resources\/en\/explore\//);
      assert.equal(story.englishTextUrl.includes('2026-04-children/'), role === 'children');
    });
  }
  assert.notEqual(q.stories.children[0].englishTextUrl, q.stories['youth-adult'][0].englishTextUrl);
  for (const activity of q.activities) {
    assert.ok(activity.steps.length >= 3);
    assert.ok(activity.sourcePages.every(page => page >= 30 && page <= 34));
  }
  assert.ok(q.countries.every(country => !Object.hasOwn(country, 'membership')));
});
