import { join } from 'node:path';

const candidates = [
  join(process.cwd(), 'node_modules', 'sharp', 'lib', 'index.js'),
  join(process.cwd(), 'backend', 'node_modules', 'sharp', 'lib', 'index.js'),
];

let sharpFactory: any;

function loadSharp(): any {
  if (sharpFactory) return sharpFactory;

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const sharpModule = require(candidate);
      sharpFactory = sharpModule.default || sharpModule;
      sharpFactory.cache(false);
      sharpFactory.concurrency(1);
      return sharpFactory;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function sharp(...args: any[]) {
  return loadSharp()(...args);
}

export default new Proxy(sharp, {
  get(target, property) {
    if (property in target) return (target as any)[property];
    return loadSharp()[property as any];
  },
}) as any;
