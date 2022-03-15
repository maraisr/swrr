import { identify } from 'object-identity';

import { SHA1 } from 'worktop/crypto';

import type { Backplane, Type } from './backplane';

export type Lifetimes = {
	/**
	 * The amount of time to keep an entry in the cache, before refetching.
	 */
	ttl?: number;

	/**
	 * The ultimate ttl, the time at which a SWR will not respond.
	 */
	maxTtl?: number;
};

export type Options = Lifetimes & {
	type?: Type;
};

type Resource<T extends (...args: any[]) => any> = (
	...args: Parameters<T>
) => Promise<ReturnType<T>>;

const make_id = (...key: string[]) => key.join('::');

export const make = (backplane: Backplane) => {
	return <T extends (...args: any[]) => any>(
		name: string,
		handler: T,
		options?: Options,
	): Resource<T> => {
		type Value = ReturnType<T>;

		const type = options?.type || 'json';
		const lifetimes: Required<Lifetimes> = {
			ttl: options?.ttl ?? 600,
			maxTtl: options?.maxTtl ?? 1000,
		};

		return new Proxy(handler, {
			async apply(target, this_arg, args_array) {
				const key = args_array.length
					? make_id(name, await identify(args_array, SHA1))
					: name;

				const result = await backplane.read<Value>(
					key,
					type,
					lifetimes.ttl,
				);

				async function call(date = Date.now()) {
					const raw_result = await Reflect.apply(
						target,
						this_arg,
						args_array,
					);

					backplane.defer(
						backplane.put<Value>(
							key,
							raw_result,
							{
								expireAt: date + lifetimes.ttl * 1000,
							},
							lifetimes.maxTtl,
						),
					);

					return raw_result;
				}

				if (result.value != null) {
					const called_at = Date.now();
					if (
						result.metadata!.expireAt == null ||
						called_at >= result.metadata!.expireAt
					) {
						backplane.defer(call(called_at));
					}

					return result.value;
				}

				return await call();
			},
		});
	};
};
