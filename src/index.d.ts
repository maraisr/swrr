export type Lifetimes = {
	/**
	 * The amount of time to keep an entry in the cache, before refetching.
	 *
	 * @default 600
	 */
	ttl?: number;
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

export const make: (
	binding: KVNamespace,
	context: ExecutionContext,
) => <T extends (...args: any[]) => any>(
	name: string,
	handler: T,
	options?: Options | undefined,
) => Resource<T>;
