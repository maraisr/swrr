import * as Spy from 'nanospy';
import { webcrypto } from 'node:crypto';
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import * as swr from '.';

// @ts-ignore
globalThis.crypto = webcrypto;

const mock_kv = () => {
	let store = new Map();

	return {
		store,
		put: Spy.spy(async (key, value, metadata) => {
			store.set(key, { value, ...metadata });
			return true;
		}),
		get: Spy.spy(async (key) => {
			return store.get(key)?.value;
		}),
		getWithMetadata: Spy.spy(async (key) => {
			return store.get(key) ?? { value: undefined, metadata: {} };
		}),
	};
};

test.after.each(() => {
	Spy.restoreAll();
});

const context = {
	waitUntil: Spy.spy(),
};

test('case', async () => {
	// preamble
	const binding = mock_kv();

	// ~> module scope
	const handler = Spy.spy((slug: string) => slug);

	// ~> request bound
	const broker = swr.make(binding as any as KVNamespace, context as any as ExecutionContext);

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

test('shouldnt call handler if time hasnt elapsed yet', async () => {
	let time = 0;
	const date_spy = Spy.spyOn(Date, 'now', () => time * 1000);

	const binding = mock_kv();
	const handler = Spy.spy((slug: string) => slug);

	const broker = swr.make(binding as any as KVNamespace, context as any as ExecutionContext);

	const getPosts = broker('posts', handler, {
		ttl: 5,
		maxTtl: 8,
	});

	assert.equal(await getPosts('my-slug'), 'my-slug');
	assert.equal(date_spy.results, [0]);
	assert.equal(handler.callCount, 1);

	time = 1;

	assert.equal(await getPosts('my-slug'), 'my-slug');
	assert.equal(date_spy.results, [0, 1000], 'date should stepped once more');
	assert.equal(handler.callCount, 1, 'handler should\nt have called');

	time = 5;

	assert.equal(await getPosts('my-slug'), 'my-slug');
	assert.equal(date_spy.results, [0, 1000, 5000]);
	assert.equal(handler.callCount, 2, 'time elapsed, handler should have been called again');

	time = 7;

	assert.equal(await getPosts('my-slug'), 'my-slug');
	assert.equal(date_spy.results, [0, 1000, 5000, 7000]);
	assert.equal(handler.callCount, 2, 'should still be cached');

	time = 13; // ttl + maxTtl

	assert.equal(await getPosts('my-slug'), 'my-slug');
	assert.equal(date_spy.results, [0, 1000, 5000, 7000, 13000]);
	assert.equal(handler.callCount, 3, 'maxTtl exceeded, should call handler');
});

test('assures keys dont change', async () => {
	const binding = mock_kv();
	const handler = Spy.spy((slug: string) => slug);
	const broker = swr.make(binding as any, context as any);

	const getPosts = broker('posts', handler);
	const data = await getPosts('my-slug');

	assert.equal(data, 'my-slug');
	assert.equal(handler.callCount, 1);
	assert.equal(binding.put.callCount, 1);
	assert.equal(
		binding.store.keys().next()?.value,
		'posts::f75db37be2bee57123bdb9b8655967bdf834c222',
	);
});

test.run();
