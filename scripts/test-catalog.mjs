import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const catalog=JSON.parse(await readFile(new URL('../src/data/gym-exercises.json',import.meta.url),'utf8'));
assert.equal(catalog.length,2906);
assert.equal(new Set(catalog.map(item=>item.id)).size,catalog.length);
assert.equal(new Set(catalog.map(item=>item.name.toLowerCase())).size,catalog.length);
assert.ok(catalog.every(item=>item.catalog===true&&item.supported===false&&item.supportLevel==='logging_only'));
assert.ok(catalog.every(item=>item.id.startsWith('gym-')&&item.name&&item.muscle&&item.equipment&&item.instructions));
assert.ok(catalog.some(item=>item.name.toLowerCase().includes('bench press')));
assert.ok(catalog.some(item=>item.equipment==='Cable'));
assert.ok(catalog.some(item=>item.category==='Powerlifting'));
console.log(`Exercise catalog checks passed: ${catalog.length} unique CC0 movements, logging-only support, searchable metadata and core gym coverage.`);
