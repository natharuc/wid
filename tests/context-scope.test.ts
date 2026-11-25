import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectedContext, scopedPath, contextQuery } from '../ui/context-scope.js';

test('explicit context including overall scope wins over a saved selection', () => {
  assert.equal(selectedContext('', 'MAG'), 'MAG');
  assert.equal(
    selectedContext('?context=Pesquisa%20%2F%20Cliente%20%C3%81', 'MAG'),
    'Pesquisa / Cliente Á',
  );
  assert.equal(selectedContext('?context=', 'MAG'), '');
  assert.equal(selectedContext('', null), '');
});
test('navigation preserves context and existing filters without inheriting another tab selection', () => {
  const path = scopedPath('/?day=2026-11-24#history', 'Pesquisa / Cliente Á');
  const url = new URL(path, 'http://wid.local');
  assert.equal(url.searchParams.get('day'), '2026-11-24');
  assert.equal(url.searchParams.get('context'), 'Pesquisa / Cliente Á');
  assert.equal(url.hash, '#history');
  assert.equal(scopedPath('/tasks?context=MAG', 'WID'), '/tasks?context=WID');
  assert.equal(scopedPath('/tasks', ''), '/tasks?context=');
  assert.equal(contextQuery(''), '');
  assert.equal(contextQuery('WID'), '?context=WID');
});
