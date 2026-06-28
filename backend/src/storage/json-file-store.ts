import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class JsonFileStore<T> {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly defaultValue: T,
  ) {}

  async read(): Promise<T> {
    await this.writeQueue;
    return this.readDirect();
  }

  async update<R>(mutator: (current: T) => R | Promise<R>): Promise<R> {
    const operation = this.writeQueue.then(async () => {
      const current = await this.readDirect();
      const result = await mutator(current);
      await this.writeAtomic(current);
      return result;
    });

    this.writeQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async readDirect(): Promise<T> {
    try {
      const content = await readFile(this.filePath, 'utf8');
      return JSON.parse(content) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const initialValue = structuredClone(this.defaultValue);
      await this.writeAtomic(initialValue);
      return initialValue;
    }
  }

  private async writeAtomic(value: T): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = this.filePath + '.' + randomUUID() + '.tmp';
    await writeFile(temporaryPath, JSON.stringify(value, null, 2) + '\n', 'utf8');
    await rename(temporaryPath, this.filePath);
  }
}
