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

test('shouldnt call handler if time hasnt elapsed yet', async () => {
	let time = 0;
	const date_spy = Spy.spyOn(Date, 'now', () => time * 1000);

	const binding = mock_kv();
	const handler = Spy.spy((slug: string) => slug);

	const broker = swr.make(
		binding as any as KVNamespace,
		context as any as ExecutionContext,
	);

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
	assert.equal(
		handler.callCount,
		2,
		'time elapsed, handler should have been called again',
	);

	time = 7;

	assert.equal(await getPosts('my-slug'), 'my-slug');
	assert.equal(date_spy.results, [0, 1000, 5000, 7000]);
	assert.equal(handler.callCount, 2, 'should still be cached');

	time = 13; // ttl + maxTtl

	assert.equal(await getPosts('my-slug'), 'my-slug');
	assert.equal(date_spy.results, [0, 1000, 5000, 7000, 13000]);
	assert.equal(handler.callCount, 3, 'maxTtl exceeded, should call handler');
});

test('stale if error', async () => {
	const date_spy = Spy.spyOn(Date, 'now');

	const binding = mock_kv();
	const handler = Spy.spy();

	const broker = swr.make(
		binding as any as KVNamespace,
		context as any as ExecutionContext,
	);

	const getPosts = broker('posts', handler, {
		ttl: 5,
		errorTtl: 7,
		maxTtl: 10,
	});

	handler.nextResult('my-slug');
	date_spy.nextResult(0);

	assert.equal(await getPosts(), 'my-slug');
	assert.equal(date_spy.results, [0]);
	assert.equal(handler.callCount, 1);

	date_spy.nextResult(5000);
	handler.nextError(new Error('test'));

	try {
		assert.equal(await getPosts(), 'my-slug', 'should be from cache');
	} catch(e) {
		assert.unreachable('this method shouldn\'t throw');
	}
	assert.equal(date_spy.results, [0, 5000]);
	assert.equal(handler.callCount, 2);
	assert.equal(handler.results.at(1), undefined, 'throwing an error has no result');

	date_spy.nextResult(8000);
	handler.nextResult('my-slug-2');

	assert.equal(await getPosts(), 'my-slug', 'should still be served from cache');
	assert.equal(handler.callCount, 3, 'async called');
	assert.equal(date_spy.results, [0, 5000, 8000]);

	date_spy.nextResult(9000);

	assert.equal(await getPosts(), 'my-slug-2', 'last swr should have updated');
	assert.equal(handler.callCount, 3);
	assert.equal(date_spy.results, [0, 5000, 8000, 9000]);
});

test.only('stale if error when 0', async () => {
	const date_spy = Spy.spyOn(Date, 'now');

	const binding = mock_kv();
	const handler = Spy.spy();

	const broker = swr.make(
		binding as any as KVNamespace,
		context as any as ExecutionContext,
	);

	const getPosts = broker('posts', handler, {
		ttl: 5,
		errorTtl: 0,
		maxTtl: 10,
	});

	handler.nextResult('my-slug');
	date_spy.nextResult(0);

	assert.equal(await getPosts(), 'my-slug');
	assert.equal(date_spy.results, [0]);
	assert.equal(handler.callCount, 1);

	date_spy.nextResult(6000);
	handler.nextError(new Error('test'));

	assert.equal(await getPosts(), 'my-slug', 'should still be served from cache');
	assert.equal(handler.callCount, 2, 'async called');
	assert.equal(date_spy.results, [0, 6000]);
});

test.run();
