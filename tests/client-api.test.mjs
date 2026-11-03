import {test} from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../src/types.ts';

test('visitor errors explain connection and service failures without raw HTML or JSON parser diagnostics', async () => {
  const original=globalThis.fetch;
  try {
    for (const [fetcher,message] of [
      [async()=>{throw new TypeError('Failed to fetch');},/Проверьте соединение/],
      [async()=>new Response('<!doctype html>Gateway failure',{status:502}),/Сервис временно недоступен/],
      [async()=>Response.json({error:'Проверьте email и пароль.'},{status:401}),/Проверьте email и пароль/],
    ]) {globalThis.fetch=fetcher;await assert.rejects(api('/api/admin/session'),message);}
  } finally {globalThis.fetch=original;}
});
