import { read, write } from 'worktop/cfw.kv';
import type { Backplane, Metadata } from './backplane';

export const create = (
	binding: KVNamespace,
	context: ExecutionContext,
): Backplane => ({
	read<T>(key: string, type: string, maxTtl: number) {
		return read<T, Metadata>(binding, key, {
			metadata: true,
			cacheTtl: maxTtl,
			// @ts-expect-error TS2322
			type,
		});
	},
	put(key, value, metadata, maxTtl) {
		return write(binding, key, value, {
			metadata,
			expirationTtl: maxTtl,
		});
	},
	defer: context.waitUntil.bind(context),
});