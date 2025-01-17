import type { AllDestinyManifestComponents } from "bungie-api-ts/destiny2";
import Model from "model/Model";
import type { IModelCache } from "model/ModelCacheDatabase";
import type Database from "utility/Database";
import type { PromiseOr } from "utility/Type";
import type { AllClarityDatabaseComponents } from "utility/endpoint/clarity/endpoint/GetClarityDatabase";
import type { AllDeepsightManifestComponents } from "utility/endpoint/deepsight/endpoint/GetDeepsightManifest";

export namespace IManifest {
	export function elapsed (elapsed: number) {
		if (elapsed < 1)
			return `${Math.floor(elapsed * 1_000)} μs`;

		if (elapsed < 1_000)
			return `${Math.floor(elapsed)} ms`;

		if (elapsed < 60_000)
			return `${+(elapsed / 1_000).toFixed(2)} s`;

		return `${+(elapsed / 60_000).toFixed(2)} m`;
	}

	export interface CombinedManifest extends AllDestinyManifestComponents, AllDeepsightManifestComponents, AllClarityDatabaseComponents { }

	export type AllComponentNames = keyof CombinedManifest;

	export type Indices<COMPONENT_NAME extends AllComponentNames> =
		{
			DeepsightMomentDefinition: "iconWatermark" | "id";
			DestinyInventoryItemDefinition: "iconWatermark" | "name";
			DestinyRecordDefinition: "icon" | "name";
		} extends infer ALL_INDICES ?
		ALL_INDICES[COMPONENT_NAME & keyof ALL_INDICES]
		: never;

	export type Component<COMPONENT_NAME extends AllComponentNames> = CombinedManifest[COMPONENT_NAME][number];

	export type ComponentKey<COMPONENT_NAME extends AllComponentNames = AllComponentNames> =
		`manifest [${COMPONENT_NAME}]`;

	export type IModelCacheManifestComponents =
		{ [COMPONENT_NAME in AllComponentNames as ComponentKey<COMPONENT_NAME>]: Component<COMPONENT_NAME> };

	export type ManifestItemCache<COMPONENT_NAME extends AllComponentNames = AllComponentNames> = Record<string, Component<COMPONENT_NAME> | Promise<Component<COMPONENT_NAME> | undefined> | undefined>;

	export type ManifestCache = { [COMPONENT_NAME in AllComponentNames]: ManifestItemCache };

	export namespace CacheComponentKey {
		export function get<COMPONENT_NAME extends AllComponentNames> (componentName: COMPONENT_NAME) {
			return `manifest [${componentName}]` as const;
		}
		export function getBundle<COMPONENT_NAME extends AllComponentNames> (componentName: COMPONENT_NAME) {
			return `manifest bundle [${componentName}]` as const;
		}
	}
}

declare module "model/ModelCacheDatabase" {
	interface IModelCache extends IManifest.IModelCacheManifestComponents { }
}

type QueryCounts = Partial<Record<IManifest.AllComponentNames | "ALL", Record<string | number, number>>>;

export class ManifestItem<COMPONENT_NAME extends IManifest.AllComponentNames> {

	private static readonly queryCounts: QueryCounts = {};

	public static logQueryCounts () {
		console.debug("Query counts:", Object.fromEntries(Object.entries(ManifestItem["queryCounts"])
			.map(([over, counts]) => [over, Object.entries(counts)
				.sort(([, a], [, b]) => b - a)])));
	}

	private memoryCache: IManifest.ManifestItemCache<COMPONENT_NAME> = {};

	private readonly stagedTransaction: Database.StagedTransaction<Pick<IModelCache, IManifest.ComponentKey<COMPONENT_NAME>>, [IManifest.ComponentKey<COMPONENT_NAME>]>;
	private readonly modelCache: Model<any>;
	private manifestCacheState?: boolean;
	private loadedManifestCache?: Promise<void>;
	private allCached?: boolean;

	public constructor (private readonly componentName: COMPONENT_NAME) {
		this.stagedTransaction = Model.cacheDB.stagedTransaction([IManifest.CacheComponentKey.get(componentName)]);
		this.modelCache = Model.create(IManifest.CacheComponentKey.getBundle(componentName), {
			cache: "Global",
			generate: () => this.createCache(),
		});
	}

	public get (key?: string | number | null, cached?: boolean): IManifest.Component<COMPONENT_NAME> | Promise<IManifest.Component<COMPONENT_NAME>> | undefined;
	public get (index: IManifest.Indices<COMPONENT_NAME>, key: string | number | null, cached?: boolean): IManifest.Component<COMPONENT_NAME> | Promise<IManifest.Component<COMPONENT_NAME>> | undefined;
	public get (index?: string | number | null, key?: string | number | null | boolean, cached = true): any {
		if (typeof key === "boolean")
			cached = key, key = undefined;

		if (key === undefined)
			key = index, index = undefined;

		if (key === undefined || key === null)
			return undefined;

		const memoryCacheKey = `${index ?? "/"}:${key}`;
		if (this.memoryCache[memoryCacheKey])
			return this.memoryCache[memoryCacheKey] ?? undefined;

		return this.resolve(memoryCacheKey, key, index, cached);
	}

	private async resolve (memoryCacheKey: string, key: string | number, index?: string | number | null, cached = true) {
		await this.loadCache();

		if (memoryCacheKey in this.memoryCache)
			return this.memoryCache[memoryCacheKey] ?? undefined;

		const counts = ManifestItem.queryCounts[this.componentName] ??= {} as Record<string | number, number>;
		counts[key] ??= 0;
		counts[key]++;
		ManifestItem.queryCounts.ALL ??= {};
		ManifestItem.queryCounts.ALL[key] ??= 0;
		ManifestItem.queryCounts.ALL[key]++;

		const promise = this.stagedTransaction.get(IManifest.CacheComponentKey.get(this.componentName), `${key}`, index as string | undefined)
			.then(value => {
				if (cached) {
					this.memoryCache[memoryCacheKey] = value ?? null as never;
					this.updateManifestCache();
				}

				return value ?? undefined;
			});

		if (cached)
			this.memoryCache[memoryCacheKey] = promise;

		return promise;
	}

	public all (): PromiseOr<IManifest.Component<COMPONENT_NAME>[]>;
	public all (index: IManifest.Indices<COMPONENT_NAME>, key: string | number | null): Promise<IManifest.Component<COMPONENT_NAME>[]>;
	public all (index?: string, key?: string | number | null): any {
		if (!this.manifestCacheState)
			return this.loadCache()
				.then(() => this.all(index as IManifest.Indices<COMPONENT_NAME>, key!));

		const componentKey = IManifest.CacheComponentKey.get(this.componentName);
		if (index)
			return this.stagedTransaction.all(componentKey, `${key!}`, index);
		return this.allCached ? Object.values(this.memoryCache) as IManifest.Component<COMPONENT_NAME>[]
			: this.stagedTransaction.all(componentKey);
	}

	public allKeys (): Promise<`${bigint}`[]>;
	public allKeys (index: IManifest.Indices<COMPONENT_NAME>, key: string | number | null): Promise<`${bigint}`[]>;
	public allKeys (index?: string, key?: string | number | null) {
		const componentKey = IManifest.CacheComponentKey.get(this.componentName);
		if (index)
			return this.stagedTransaction.allKeys(componentKey, `${key!}`, index);
		return this.stagedTransaction.allKeys(componentKey);
	}

	public async loadCache () {
		if (this.manifestCacheState !== undefined)
			return this.manifestCacheState ? undefined : this.loadedManifestCache;

		this.manifestCacheState = false;
		return this.loadedManifestCache = (async () => {
			const bundleKey = IManifest.CacheComponentKey.getBundle(this.componentName);
			console.debug("Loading", bundleKey);

			const hasCache = !!await this.modelCache.resolveCache();

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			this.memoryCache = await this.modelCache.await();

			if (!hasCache) {
				console.debug("Generating initial", bundleKey);
				const cacheKeyRange = async (keyRange = this.cacheAllKeyRange && this.cacheAllKeyRange !== true ? this.cacheAllKeyRange : undefined) => {
					const all = await this.stagedTransaction.all(
						IManifest.CacheComponentKey.get(this.componentName),
						keyRange,
					);

					for (const value of all) {
						if ("hash" in value) {
							const memoryCacheKey = `/:${value.hash}`;
							this.memoryCache[memoryCacheKey] = value;
						}
					}
				};

				if (this.allCached !== undefined || this.cacheAllKeyRange !== undefined) {
					await cacheKeyRange();
				}

				await this.cacheInitialiser?.(this.memoryCache, cacheKeyRange);

				// save changes
				clearTimeout(this.manifestCacheUpdateTimeout);
				await this.modelCache.reset();
				await this.modelCache.await();
			}

			if (this.allCached === false || this.allCached === true)
				this.allCached = true;

			this.manifestCacheState = true;
			console.debug("Loaded", bundleKey, /*this.memoryCache*/);
		})();
	}

	private cacheInitialiser?: (cache: IManifest.ManifestItemCache<COMPONENT_NAME>, cacheKeyRange: (keyRange?: IDBValidKey | IDBKeyRange | undefined) => Promise<void>) => any;
	private cacheAllKeyRange?: true | IDBValidKey | IDBKeyRange;
	public setPreCache (all: boolean | IDBValidKey | IDBKeyRange, initialise?: (cache: IManifest.ManifestItemCache<COMPONENT_NAME>, cacheKeyRange: (keyRange?: IDBValidKey | IDBKeyRange | undefined) => Promise<void>) => any) {
		this.cacheInitialiser = initialise;
		if (all) {
			this.allCached = all === true ? false : undefined;
			this.cacheAllKeyRange = all;
		}
	}

	private createCache () {
		return JSON.parse(JSON.stringify(this.memoryCache));
	}

	private manifestCacheUpdateTimeout?: number;
	private updateManifestCache () {
		clearTimeout(this.manifestCacheUpdateTimeout);
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		this.manifestCacheUpdateTimeout = window.setTimeout(async () => {
			await this.modelCache.reset();
			await this.modelCache.await();
		}, 2000);
	}
}

Object.assign(window, { ManifestItem });
