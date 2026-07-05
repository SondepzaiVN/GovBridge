import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JsonFileStore } from '../src/storage/json-file-store.js';
import { ApplicationRepository } from '../src/modules/applications/application.repository.js';
import type { ApplicationRecord } from '../src/modules/applications/application.types.js';

let dataDirectory: string;

beforeEach(async () => {
  dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'gov-bridge-store-'));
});

afterEach(async () => {
  if (dataDirectory.startsWith(os.tmpdir())) await rm(dataDirectory, { recursive: true, force: true });
});

describe('JsonFileStore and repositories', () => {
  it('creates missing files from defaults and keeps the returned object isolated', async () => {
    const storePath = path.join(dataDirectory, 'missing', 'store.json');
    const store = new JsonFileStore<{ schemaVersion: number; items: string[] }>(storePath, {
      schemaVersion: 1,
      items: [],
    });

    const value = await store.read();
    value.items.push('local mutation only');

    expect(await store.read()).toEqual({ schemaVersion: 1, items: [] });
    expect(JSON.parse(await readFile(storePath, 'utf8'))).toEqual({ schemaVersion: 1, items: [] });
  });

  it('surfaces corrupt JSON instead of overwriting it', async () => {
    const storePath = path.join(dataDirectory, 'corrupt.json');
    await writeFile(storePath, '{not json', 'utf8');
    const store = new JsonFileStore(storePath, { schemaVersion: 1 });

    await expect(store.read()).rejects.toBeInstanceOf(SyntaxError);
    expect(await readFile(storePath, 'utf8')).toBe('{not json');
  });

  it('serializes concurrent updates in order', async () => {
    const store = new JsonFileStore<{ values: number[] }>(path.join(dataDirectory, 'queue.json'), {
      values: [],
    });

    await Promise.all(Array.from({ length: 25 }, async (_unused, index) =>
      store.update(async (current) => {
        current.values.push(index);
        return index;
      }),
    ));

    expect((await store.read()).values).toEqual(Array.from({ length: 25 }, (_unused, index) => index));
  });

  it('inserts and finds applications while returning null for unknown ids', async () => {
    const repository = new ApplicationRepository(dataDirectory);
    const application: ApplicationRecord = {
      id: 'HS-TEST-001',
      serviceId: 'cccd',
      status: 'RECEIVED',
      data: { hoTen: 'Nguyễn Văn An' },
      receivedAt: '2026-01-01T00:00:00.000Z',
      schemaVersion: 1,
    };

    await expect(repository.findById(application.id)).resolves.toBeNull();
    await expect(repository.insert(application)).resolves.toEqual(application);
    await expect(repository.findById(application.id)).resolves.toEqual(application);
    await expect(repository.findById('HS-NOT-FOUND')).resolves.toBeNull();
  });
});
