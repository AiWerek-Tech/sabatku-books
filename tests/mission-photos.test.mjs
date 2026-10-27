import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {build,root} from '../scripts/build-content.mjs';

test('all 26 mission photos are assigned to their weekly stories and published with integrity',()=>{
  build(root);
  const evidence=JSON.parse(fs.readFileSync(path.join(root,'docs/mission-story-photos-2026-q4.json')));
  assert.equal(evidence.length,26);
  for(const role of ['children','youth-adult']){
    const manifest=JSON.parse(fs.readFileSync(path.join(root,`public/editions/mission-stories-${role}-2026-q4-id/revisions/5/manifest.json`)));
    assert.equal(manifest.nodes.length,13);
    for(const node of manifest.nodes){
      const source=evidence.find(x=>x.role===role&&x.date===node.readingDate);
      assert.ok(source?.source.startsWith('https://adventistmission.org/'));
      assert.equal(source.number,node.order);
      const bytes=fs.readFileSync(path.join(root,'public',node.illustration.path));
      assert.ok(bytes.length>1000&&bytes.length<200000);
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),node.illustration.sha256);
    }
  }
});
