export type Result<T, M> = { value: T; metadata: M };

export type Metadata = { expireAt: number };

export type Type = 'json' | 'arrayBuffer' | 'stream' | 'text';

export interface Backplane {
	read<T>(
		key: string,
		type: Type,
		maxTtl: number,
	): Promise<Result<T | null, Metadata | null>>;

	put<T>(
		key: string,
		value: T,
		metadata: Metadata,
		maxTtl: number,
	): Promise<boolean>;

	defer(cb: any): void;
}
