import * as Spy from 'nanospy';
import { webcrypto } from 'node:crypto';
import type { Backplane } from '../src/backplane';
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import * as swr from '../src';

// @ts-ignore
globalThis.crypto = webcrypto;

const context = {
	waitUntil: Spy.spy(),
};

const mock_backplane = () => {
	let store = new Map();

	return {
		put: Spy.spy(async (key, value, metadata, ttl) => {
			store.set(key, { value, metadata, ttl });
			return true;
		}),
		read: Spy.spy(async (key, _type, _ttl) => {
			return store.get(key) ?? { value: undefined, metadata: {} };
		}),
		defer: context.waitUntil.bind(context),
	};
};

test.after.each(() => {
	Spy.restoreAll();
});

test('case', async () => {
	const handler = Spy.spy((slug: string) => slug);

	const backplane = mock_backplane();
	const broker = swr.make(backplane as Backplane);

	const getPosts = broker('posts', handler);

	// ~> where you need to use it
	assert.equal(await getPosts('my-slug'), 'my-slug');
	assert.equal(context.waitUntil.callCount, 1);
	assert.equal(handler.callCount, 1);
	assert.equal(backplane.put.callCount, 1);
	assert.equal(backplane.read.callCount, 1);

	assert.equal(await getPosts('my-slug'), 'my-slug');
	assert.equal(context.waitUntil.callCount, 1);
	assert.equal(handler.callCount, 1);
	assert.equal(backplane.put.callCount, 1);
	assert.equal(backplane.read.callCount, 2);
});

test('shouldnt call handler if time hasnt elapsed yet', async () => {
	let time = 0;
	const date_spy = Spy.spyOn(Date, 'now', () => time * 1000);

	const handler = Spy.spy((slug: string) => slug);

	const backplane = mock_backplane();
	const broker = swr.make(backplane as Backplane);

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

test.run();
