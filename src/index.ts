import { identify } from 'object-identity';
import { read, write } from 'worktop/cfw.kv';
import { SHA1 } from 'worktop/crypto';

import type { Lifetimes, make as _make } from 'swrr';

export const make: typeof _make = (binding, context) => (name, handler, options) => {
	type Value = ReturnType<typeof handler>;
	type Metadata = { expireAt: number };

	const type = options?.type || 'json';
	const lifetimes: Required<Lifetimes> = {
		ttl: options?.ttl ?? 600,
		maxTtl: options?.maxTtl ?? 1000,
	};

	return new Proxy(handler, {
		async apply(target, this_arg, args_array) {
			const key = args_array.length
				? name + '::' + await SHA1(identify(args_array))
				: name;

			const result = await read<Value, Metadata>(binding, key, {
				metadata: true,
				cacheTtl: lifetimes.ttl,
				// @ts-expect-error TS2769
				type,
			});

			async function call(date = Date.now()) {
				const raw_result = await Reflect.apply(target, this_arg, args_array);

				context.waitUntil(
					write<Value, Metadata>(binding, key, raw_result, {
						metadata: {
							expireAt: date + lifetimes.ttl * 1000,
						},
						expirationTtl: lifetimes.maxTtl,
					}),
				);

				return raw_result;
			}

			if (result.value != null) {
				const called_at = Date.now();
				if (
					result.metadata!.expireAt == null ||
					called_at >= result.metadata!.expireAt
				) {
					context.waitUntil(call(called_at));
				}

				return result.value;
			}

			return await call();
		},
	});
};
