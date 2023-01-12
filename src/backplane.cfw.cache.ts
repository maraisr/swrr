import { lookup, save } from 'worktop/cfw.cache';
import type { Backplane } from './backplane';

const make_key = (key: string) => `http://192.0.0.1/__swrr__/${key}`;

const make_result = async (res: Response, type: string): Promise<any> => {
	if ('x-metadata' in res.headers) {
		var metadata = JSON.parse(res.headers.get('x-metadata') as string);
	} else {
		throw new Error('no metadata header');
	}

	let value;
	if (type === 'json') value = await res.json();
	else if (type === 'stream') value = res.body;
	else if (type === 'text') value = await res.text();
	else if (type === 'arrayBuffer') value = await res.arrayBuffer();
	else throw new Error(`undefined type ${type}`);

	return {
		value,
		metadata,
	};
};

export const create = (context: ExecutionContext): Backplane => ({
	read(key, type) {
		return lookup(make_key(key)).then((res) => {
			if (res === undefined) return { value: null, metadata: null };
			return make_result(res, type);
		});
	},
	async put(key, value, metadata, maxTtl) {
		const data = new Response(value as any, {
			headers: {
				'cache-control': `public,max-age=${maxTtl}`,
				'x-metadata': JSON.stringify(metadata),
			},
		});

		save(make_key(key), data, context);

		return true;
	},
	defer: context.waitUntil.bind(context),
});
