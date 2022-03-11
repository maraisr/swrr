import { identify } from 'object-identity';
import { read, write } from 'worktop/cfw.kv';
import { SHA1 } from 'worktop/crypto';

export type Lifetimes = {
	/**
	 * The amount of time to keep an entry in the cache, before refetching.
	 *
	 * @default 600
	 */
	ttl?: number;

	/**
	 * If there is an error, the amount of time to return stale data irrespective of its ttl. The
	 * {@see maxTtl} is still considered ultimate ttl, however.
	 *
	 * 0 — means no ttl as to say instantly return error.
	 *
	 * @default 0
	 */
	errorTtl?: number;

	/**
	 * The ultimate ttl, the time at which a SWR will not respond.
	 *
	 * @default 1000
	 */
	maxTtl?: number;
};

export type Options = Lifetimes & {
	type?: 'json' | 'arrayBuffer' | 'stream' | 'text';
};

type Resource<T extends (...args: any[]) => any> = (
	...args: Parameters<T>
) => Promise<ReturnType<T>>;

const make_id = (...key: string[]) => key.join('::');

export const make = (binding: KVNamespace, context: ExecutionContext) => {
	return <T extends (...args: any[]) => any>(
		name: string,
		handler: T,
		options?: Options,
	): Resource<T> => {
		type Value = ReturnType<T>;
		type Metadata = {
			expireAt: number,
			errorExpireAt: number
		};

		const type = options?.type || 'json';
		const lifetimes: Required<Lifetimes> = {
			ttl: options?.ttl ?? 600,
			errorTtl: options?.errorTtl ?? 0,
			maxTtl: options?.maxTtl ?? 1000,
		};

		return new Proxy(handler, {
			async apply(target, this_arg, args_array) {
				const key = args_array.length
					? make_id(name, await identify(args_array, SHA1))
					: name;

				const result = await read<Value, Metadata>(binding, key, {
					metadata: true,
					cacheTtl: lifetimes.ttl,
					// @ts-expect-error TS2769
					type,
				});

				const has_cached_copy = result.value != null;

				async function call(date = Date.now()) {
					try {
						var raw_result = await Reflect.apply(
							target,
							this_arg,
							args_array,
						);
					} catch(e) {
						if (has_cached_copy && result!.metadata!.errorExpireAt >= date) {
							return result.value;
						}

						throw e;
					}

					context.waitUntil(
						write<Value, Metadata>(binding, key, raw_result, {
							metadata: {
								expireAt: date + lifetimes.ttl * 1000,
								errorExpireAt: date + lifetimes.errorTtl * 1000,
							},
							expirationTtl: lifetimes.maxTtl,
						}),
					);

					return raw_result;
				}

				if (has_cached_copy) {
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
};
