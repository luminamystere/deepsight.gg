import type { DestinyInventoryComponent, DestinyItemComponent } from "bungie-api-ts/destiny2";
import { BucketHashes } from "bungie-api-ts/destiny2";
import Model from "model/Model";
import DebugInfo from "model/models/DebugInfo";
import type { BucketId, CharacterId } from "model/models/items/Item";
import Item from "model/models/items/Item";
import Plugs from "model/models/items/Plugs";
import Manifest from "model/models/Manifest";
import { ManifestItem } from "model/models/manifest/IManifest";
import ProfileBatch from "model/models/ProfileBatch";
import Async from "utility/Async";
import Time from "utility/Time";

/**
 * **Warning:** Not all weapon mods have this category hash
 */
export const ITEM_WEAPON_MOD = 610365472;

export class Bucket {

	public capacity?: number;

	public constructor (public readonly id: BucketId, public readonly items: Item[]) {
	}
}

export default Model.createDynamic(Time.seconds(30), async api => {
	api.subscribeProgress(Manifest, 1 / 4);
	const manifest = await Manifest.await();
	api.emitProgress(1 / 4, "Loading manifest cache");

	// precache some defs for item initialisation
	const { DeepsightDropTableDefinition, DestinyActivityDefinition } = manifest;
	await DeepsightDropTableDefinition.all();
	await DestinyActivityDefinition.all();

	const vaultBucket = await manifest.DestinyInventoryBucketDefinition.get(BucketHashes.General);

	api.subscribeProgress(ProfileBatch, 1 / 4, 2 / 4);
	const profile = await ProfileBatch.await();
	api.emitProgress(3 / 4, "Loading items");

	const initialisedItems = new Set<string>();
	const itemsToInit = new Set<string>((profile.profileInventory?.data?.items ?? [])
		.concat(Object.values(profile.characterInventories?.data ?? {}).flatMap(character => character.items))
		.map(item => item.itemInstanceId ?? ""));
	itemsToInit.delete("");
	const totalItemsToInit = itemsToInit.size;
	const occurrences: Record<string, number> = {};

	let lastForcedTimeoutForStyle = Date.now();

	async function resolveItemComponent (reference: DestinyItemComponent, bucket: BucketId) {
		if (Date.now() - lastForcedTimeoutForStyle > 10) {
			await Async.sleep(1);
			lastForcedTimeoutForStyle = Date.now();
		}

		api.emitProgress(3 / 4 + 1 / 4 * (1 - itemsToInit.size / totalItemsToInit), `Loading items ${totalItemsToInit - itemsToInit.size} / ${totalItemsToInit}`);
		if (reference.itemInstanceId !== undefined && initialisedItems.has(reference.itemInstanceId))
			return undefined; // already initialised in another bucket

		occurrences[`${reference.itemHash}:${reference.bucketHash}`] ??= 0;
		const occurrence = occurrences[`${reference.itemHash}:${reference.bucketHash}`]++;

		if (reference.itemInstanceId !== undefined) {
			initialisedItems.add(reference.itemInstanceId);
			itemsToInit.delete(reference.itemInstanceId);
		}

		const result = await Item.resolve(manifest, profile, reference, bucket, occurrence);
		if (!result && reference.itemInstanceId !== undefined)
			initialisedItems.delete(reference.itemInstanceId);

		return result;
	}

	async function createBucket (id: BucketId, itemComponents: DestinyItemComponent[]) {
		const items: Item[] = [];
		for (const itemComponent of itemComponents) {
			const item = await resolveItemComponent(itemComponent, id);
			if (!item)
				continue;

			items.push(item);
		}

		const bucket = new Bucket(id, items);

		if (id === "vault")
			bucket.capacity = vaultBucket?.itemCount;

		return bucket;
	}

	Plugs.resetInitialisedPlugTypes();

	const profileItems = profile.profileInventory?.data?.items ?? [];

	const buckets = {} as Record<BucketId, Bucket>;
	for (const [characterId, character] of Object.entries(profile.characterInventories?.data ?? {}) as [CharacterId, DestinyInventoryComponent][]) {
		const postmasterId = `postmaster:${characterId}` as const;
		buckets[postmasterId] = await createBucket(postmasterId, character.items
			.filter(item => item.bucketHash === BucketHashes.LostItems || item.bucketHash === BucketHashes.Engrams));

		const bucket = buckets[characterId] = await createBucket(characterId, character.items);

		for (const itemComponent of (profile.characterEquipment?.data?.[characterId].items ?? [])) {
			const item = await resolveItemComponent(itemComponent, characterId);
			if (!item)
				continue;

			item.equipped = true;
			bucket.items.push(item);
		}
	}

	buckets.consumables = await createBucket("consumables", profileItems);
	buckets.modifications = await createBucket("modifications", profileItems);
	buckets.vault = await createBucket("vault", profileItems);

	Plugs.logInitialisedPlugTypes();
	ManifestItem.logQueryCounts();
	api.emitProgress(4 / 4);

	DebugInfo.updateBuckets(buckets);

	return buckets;
});
