import * as Spy from 'nanospy';
import { webcrypto } from 'node:crypto';
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import * as swr from '../src';

// @ts-ignore
globalThis.crypto = webcrypto;

const mock_kv = () => {
	let store = new Map();

	return {
		put: Spy.spy((key, value, metadata) => {
			store.set(key, { value, metadata });
		}),
		get: Spy.spy((key) => {
			return store.get(key)?.value;
		}),
		getWithMetadata: Spy.spy((key) => {
			return store.get(key) ?? { value: undefined, metadata: {} };
		}),
	};
};

test.after.each(() => {
	Spy.restoreAll();
});

test('case', async () => {
	// preamble
	const context = {
		waitUntil: Spy.spy(),
	};
	const binding = mock_kv();

	// ~> module scope
	const handler = Spy.spy((slug: string) => slug);

	// ~> request bound
	const broker = swr.make(
		binding as any as KVNamespace,
		context as any as ExecutionContext,
	);

	const getPosts = broker('posts', handler);

	// ~> where you need to use it
	assert.equal(await getPosts('my-slug'), 'my-slug');
	assert.equal(context.waitUntil.callCount, 1);
	assert.equal(handler.callCount, 1);
	assert.equal(binding.put.callCount, 1);
	assert.equal(binding.getWithMetadata.callCount, 1);

	assert.equal(await getPosts('my-slug'), 'my-slug');
	assert.equal(context.waitUntil.callCount, 1);
	assert.equal(handler.callCount, 1);
	assert.equal(binding.put.callCount, 1);
	assert.equal(binding.getWithMetadata.callCount, 2);
});

test.run();
