import { identify } from 'object-identity';
import { read, write } from 'worktop/cfw.kv';
import { SHA1 } from 'worktop/crypto';

export type Lifetimes = {
	/**
	 * The amount of time to keep an entry in the cache, before refetching.
	 */
	ttl?: number;

	/**
	 * The ultimate ttl, the time at which a SWR will not respond.
	 */
	maxTtl?: number;
}

export type Options = Lifetimes & { type?: 'json' | 'arrayBuffer' | 'stream' | 'text' };

interface Resource<T extends (...args: any[]) => any> {
	(...args: Parameters<T>): Promise<ReturnType<T>>;
}

const make_id = (...key: string[]) => key.join('__');

export const make = (binding: KVNamespace, context: ExecutionContext) => {

	return <T extends (...args: any[]) => any>(name: string, handler: T, options?: Options): Resource<T> => {
		type Value = ReturnType<T>;
		type Metadata = Required<Pick<Lifetimes, 'ttl'>>;

		const type = options?.type || 'json';
		const lifetimes: Required<Lifetimes> = {
			ttl: options?.ttl ?? 600,
			maxTtl: options?.maxTtl ?? 1000,
		};

		return new Proxy(handler, {
			async apply(target, thisArg, argsArray) {
				const hashed_args = argsArray.length ? await identify(argsArray, SHA1) : '';
				const key = make_id(name, hashed_args);

				const result = await read<Value, Metadata>(binding, key, {
					metadata: true,
					cacheTtl: lifetimes.ttl,
					// @ts-expect-error TS2769
					type,
				});

				async function call() {
					const raw_result = await Reflect.apply(target, thisArg, argsArray);

					context.waitUntil(
						write(binding, key, raw_result, {
							metadata: { ttl: Date.now() + lifetimes.ttl * 1000 },
							expirationTtl: lifetimes.maxTtl,
						}),
					);

					return raw_result;
				}

				if (result.value != null) {
					if (result.metadata!.ttl >= Date.now()) context.waitUntil(call());

					return result.value;
				}

				return await call();
			},
		});
	};
};
