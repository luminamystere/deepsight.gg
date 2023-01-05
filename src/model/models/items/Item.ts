import type { DestinyInventoryItemDefinition, DestinyItemComponent, DestinyItemInstanceComponent, DestinyItemTierTypeDefinition } from "bungie-api-ts/destiny2";
import { BucketHashes, ItemBindStatus, ItemLocation, ItemState, StatHashes, TransferStatuses } from "bungie-api-ts/destiny2";
import type { IDeepsight, IWeaponShaped } from "model/models/items/Deepsight";
import Deepsight from "model/models/items/Deepsight";
import type { PlugType } from "model/models/items/Plugs";
import Plugs, { Socket } from "model/models/items/Plugs";
import Source from "model/models/items/Source";
import type { IStats } from "model/models/items/Stats";
import Stats from "model/models/items/Stats";
import Tier from "model/models/items/Tier";
import type Manifest from "model/models/Manifest";
import EquipItem from "utility/endpoint/bungie/endpoint/destiny2/actions/items/EquipItem";
import PullFromPostmaster from "utility/endpoint/bungie/endpoint/destiny2/actions/items/PullFromPostmaster";
import TransferItem from "utility/endpoint/bungie/endpoint/destiny2/actions/items/TransferItem";
import type { DestinySourceDefinition } from "utility/endpoint/deepsight/endpoint/GetDestinySourceDefinition";
import { EventManager } from "utility/EventManager";
import type { IItemPerkWishlist } from "utility/Store";
import Store from "utility/Store";
import Time from "utility/Time";
import type { PromiseOr } from "utility/Type";

export type CharacterId = `${bigint}`;
export type PostmasterId = `postmaster:${CharacterId}`;
export type DestinationBucketId = CharacterId | "vault" | "inventory";
export type OwnedBucketId = DestinationBucketId | PostmasterId;
export type BucketId = OwnedBucketId | "collections";
export namespace PostmasterId {
	export function is (id: BucketId): id is PostmasterId {
		return id.startsWith("postmaster:");
	}

	export function character (id: PostmasterId) {
		return id.slice(11) as CharacterId;
	}
}
export namespace CharacterId {
	export function is (id: BucketId): id is CharacterId {
		return id !== "vault" && id !== "inventory" && id !== "collections" && !PostmasterId.is(id);
	}
}

enum TransferType {
	PullFromPostmaster,
	TransferToVault,
	TransferToCharacterFromVault,
	// TransferToInventoryFromVault,
	Equip,
}

interface ITransferArgs {
	[TransferType.PullFromPostmaster]: [],
	[TransferType.TransferToVault]: [],
	[TransferType.TransferToCharacterFromVault]: [character: CharacterId],
	// [TransferType.TransferToInventoryFromVault]: [],
	[TransferType.Equip]: [character: CharacterId],
}

type Transfer = {
	[TYPE in TransferType]: (
		[type: TYPE, ...args: ITransferArgs[TYPE]] extends infer TRANSFER ?
		Extract<TRANSFER, any[]>["length"] extends 1 ? Extract<TRANSFER, any[]>[number] | TRANSFER : TRANSFER
		: never
	)
} extends infer UNDOS ? UNDOS[keyof UNDOS] : never;

interface ITransferDefinition<TYPE extends TransferType> {
	applicable (item: Item, ...args: ITransferArgs[TYPE]): boolean;
	transfer (item: Item, ...args: ITransferArgs[TYPE]): Promise<ITransferResult>;
}

interface IGenericTransferDefinition {
	applicable (item: Item, ...args: ITransferArgs[TransferType]): boolean;
	transfer (item: Item, ...args: ITransferArgs[TransferType]): Promise<ITransferResult>;
}

interface ITransferResult {
	bucket: DestinationBucketId;
	equipped?: true;
	undo?: Transfer;
}

const TRANSFERS: { [TYPE in TransferType]: ITransferDefinition<TYPE> } = {
	[TransferType.PullFromPostmaster]: {
		applicable: item => PostmasterId.is(item.bucket),
		transfer: async item => {
			if (!PostmasterId.is(item.bucket))
				throw new Error("Not in postmaster bucket");

			const characterId = PostmasterId.character(item.bucket);
			await PullFromPostmaster.query(item, characterId);
			return { bucket: characterId };
		},
	},
	[TransferType.TransferToVault]: {
		applicable: item => CharacterId.is(item.bucket),
		transfer: async item => {
			if (!CharacterId.is(item.bucket))
				throw new Error("Not in character bucket");

			const characterId = item.bucket;
			await TransferItem.query(item, characterId, "vault");
			return {
				bucket: "vault",
				undo: [TransferType.TransferToCharacterFromVault, characterId],
			};
		},
	},
	[TransferType.TransferToCharacterFromVault]: {
		applicable: item => item.bucket === "vault",
		transfer: async (item, characterId) => {
			if (item.bucket !== "vault")
				throw new Error("Not in vault bucket");

			await TransferItem.query(item, characterId);
			return {
				bucket: characterId,
				undo: TransferType.TransferToVault,
			};
		},
	},
	[TransferType.Equip]: {
		applicable: item => CharacterId.is(item.bucket),
		transfer: async (item, characterId) => {
			if (!CharacterId.is(item.bucket))
				throw new Error("Not in character bucket");

			await EquipItem.query(item, characterId);
			return {
				bucket: characterId,
				equipped: true,
				undo: TransferType.TransferToVault,
			};
		},
	},
};

export type ItemId = `hash:${bigint}` | `${bigint}`;

export interface IItemInit {
	id: ItemId;
	reference: DestinyItemComponent;
	definition: DestinyInventoryItemDefinition;
	bucket: BucketId;
	instance?: DestinyItemInstanceComponent;
	sockets?: PromiseOr<(Socket | undefined)[]>;
	source?: DestinySourceDefinition;
	deepsight?: IDeepsight;
	shaped?: IWeaponShaped;
	stats?: IStats;
	tier?: DestinyItemTierTypeDefinition;
}

export interface IItem extends IItemInit {
	equipped?: true;
	sockets: (Socket | undefined)[];
}

export interface IItemEvents {
	update: { item: Item };
	loadStart: Event;
	loadEnd: Event;
	bucketChange: { item: Item; oldBucket: OwnedBucketId; equipped?: true };
}

namespace Item {
	export interface IItemProfile extends
		Deepsight.IDeepsightProfile,
		Plugs.IPlugsProfile,
		Stats.IStatsProfile { }
}

interface Item extends IItem { }
class Item {

	public static id (reference: DestinyItemComponent): ItemId {
		return reference.itemInstanceId as `${bigint}` ?? `hash:${reference.itemHash}`;
	}

	public static async resolve (manifest: Manifest, profile: Item.IItemProfile, reference: DestinyItemComponent, bucket: BucketId) {
		const { DestinyInventoryItemDefinition } = manifest;

		const definition = await DestinyInventoryItemDefinition.get(reference.itemHash);
		if (!definition) {
			console.warn("No item definition for ", reference.itemHash);
			return undefined;
		}

		if (definition.nonTransferrable && reference.bucketHash !== BucketHashes.LostItems && reference.bucketHash !== BucketHashes.Engrams) {
			console.debug(`Skipping "${definition.displayProperties.name}", non-transferrable`);
			return undefined;
		}

		const item: IItemInit = {
			id: Item.id(reference),
			reference,
			definition,
			bucket,
			instance: profile.itemComponents?.instances.data?.[reference.itemInstanceId!],
		};

		await Promise.all([
			Plugs.apply(manifest, profile, item),
			Stats.apply(manifest, profile, item),
			Deepsight.apply(manifest, profile, item),
			Source.apply(manifest, item),
			Tier.apply(manifest, item),
		]);

		return new Item(item);
	}

	public static async createFake (manifest: Manifest, profile: Plugs.IPlugsProfile & Deepsight.IDeepsightProfile, definition: DestinyInventoryItemDefinition) {
		const item: IItemInit = {
			id: `hash:${definition.hash}` as ItemId,
			reference: { itemHash: definition.hash, quantity: 0, bindStatus: ItemBindStatus.NotBound, location: ItemLocation.Unknown, bucketHash: BucketHashes.General, transferStatus: TransferStatuses.NotTransferrable, lockable: false, state: ItemState.None, isWrapper: false, tooltipNotificationIndexes: [], metricObjective: { objectiveHash: -1, complete: false, visible: false, completionValue: 0 }, itemValueVisibility: [] },
			definition,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			bucket: "collections" as any,
			sockets: [],
		};

		await Promise.all([
			Deepsight.apply(manifest, profile, item),
			Plugs.apply(manifest, profile, item),
		]);

		return new Item(item);
	}

	public readonly event = new EventManager<this, IItemEvents>(this);

	public get character () {
		return this.bucket === "vault" || this.bucket === "inventory" || this.bucket === "collections" ? undefined
			: PostmasterId.is(this.bucket) ? PostmasterId.character(this.bucket)
				: this.bucket;
	}

	public get objectives () {
		return this.sockets.flatMap(socket => socket?.plugs.flatMap(plug => plug.objectives) ?? []);
	}

	private constructor (item: IItemInit) {
		Object.assign(this, item);
	}

	public isMasterwork () {
		return !!(this.reference.state & ItemState.Masterwork)
			|| (!!this.instance
				&& (this.sockets
					?.filter(socket => socket?.plugs.some(plug => plug.definition?.itemTypeDisplayName === "Enhanced Trait"))
					.length ?? 0) >= 2);
	}

	public hasDeepsight () {
		const objectiveComplete = this.deepsight?.attunement?.progress.complete ?? false;
		const hasIncompletePattern = this.deepsight?.pattern && !(this.deepsight.pattern.progress.complete ?? false);
		return !this.deepsight?.attunement ? false
			: objectiveComplete || hasIncompletePattern || !Store.items.settingsNoDeepsightBorderOnItemsWithoutPatterns;
	}

	public hasPattern () {
		return !!(this.deepsight?.attunement && this.deepsight?.pattern && !this.deepsight.pattern.progress.complete);
	}

	public canTransfer () {
		return !this.definition.doesPostmasterPullHaveSideEffects && this.reference.bucketHash !== BucketHashes.Engrams;
	}

	public getPower () {
		const isValidStat = this.instance?.primaryStat?.statHash === StatHashes.Power
			|| this.instance?.primaryStat?.statHash === StatHashes.Attack
			|| this.instance?.primaryStat?.statHash === StatHashes.Defense;
		const primaryStatPower = isValidStat ? this.instance!.primaryStat.value : 0;
		const itemLevelQualityPower = (this.instance?.itemLevel ?? 0) * 10 + (this.instance?.quality ?? 0);
		return Math.max(primaryStatPower, itemLevelQualityPower);
	}

	public isSame (item: Item) {
		return this.id === item.id;
	}

	public getSockets (type: PlugType) {
		return Socket.filterByPlugs(this.sockets, type);
	}

	public update (item: Item) {
		this.id = item.id;
		this.reference = item.reference;
		if (this.trustTransferUntil < Date.now() || !this.bucketHistory?.includes(item.bucket)) {
			delete this.bucketHistory;
			this.bucket = item.bucket;
			this.equipped = item.equipped;
		}
		this.instance = item.instance;
		this.sockets = item.sockets;
		this.source = item.source;
		this.deepsight = item.deepsight;
		this.shaped = item.shaped;
		this.stats = item.stats;
		this.event.emit("update", { item: this });
		return this;
	}

	private _transferPromise?: Promise<void>;
	private undoTransfers: Transfer[] = [];
	private bucketHistory?: BucketId[];
	private trustTransferUntil = 0;

	public get transferring () {
		return !!this._transferPromise;
	}

	public async transferrable () {
		while (this._transferPromise)
			await this._transferPromise;
	}

	public transferToBucket (bucket: DestinationBucketId) {
		if (bucket === "inventory")
			throw new Error("Inventory transfer not implemented yet");

		if (bucket === "vault")
			return this.transferToVault();

		return this.transferToCharacter(bucket);
	}

	public async transferToCharacter (character: CharacterId) {
		if (character === this.bucket)
			return;

		return this.transfer(
			TransferType.PullFromPostmaster,
			...CharacterId.is(this.bucket) ? [TransferType.TransferToVault as const] : [],
			[TransferType.TransferToCharacterFromVault, character],
		);
	}

	public transferToVault () {
		return this.transfer(
			TransferType.PullFromPostmaster,
			TransferType.TransferToVault,
		);
	}

	public transferToggleVaulted (character: CharacterId) {
		if (this.bucket === "vault")
			return this.transferToCharacter(character);
		else
			return this.transferToVault();
	}

	public equip (character: CharacterId) {
		return this.transfer(
			TransferType.PullFromPostmaster,
			[TransferType.TransferToCharacterFromVault, character],
			[TransferType.Equip, character],
		);
	}

	public pullFromPostmaster () {
		return this.transfer(TransferType.PullFromPostmaster);
	}

	private async transfer (...transfers: Transfer[]) {
		await this.transferrable();
		this.event.emit("loadStart");
		this._transferPromise = this.performTransfer(...transfers);
		await this._transferPromise;
		delete this._transferPromise;
		this.event.emit("loadEnd");
	}

	private async performTransfer (...transfers: Transfer[]) {
		this.undoTransfers.splice(0, Infinity);

		for (let transfer of transfers) {
			transfer = Array.isArray(transfer) ? transfer : [transfer] as Exclude<Transfer, number>;
			const [type, ...args] = transfer;
			const definition = TRANSFERS[type] as IGenericTransferDefinition;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
			if (!definition.applicable(this, ...args))
				continue;

			try {
				const result = await definition.transfer(this, ...args);

				if (result.undo)
					this.undoTransfers.push(result.undo);
				else
					this.undoTransfers.splice(0, Infinity);

				const oldBucket = this.bucket as OwnedBucketId;
				this.bucketHistory ??= [];
				this.bucketHistory.push(oldBucket);

				this.bucket = result.bucket;
				this.equipped = result.equipped;
				this.trustTransferUntil = Date.now() + Time.seconds(45);
				this.event.emit("bucketChange", { item: this, oldBucket, equipped: this.equipped });

			} catch (error) {
				console.error(error);
				if (!Store.items.settingsDisableReturnOnFailure)
					await this.performTransfer(...this.undoTransfers.reverse());
			}
		}
	}

	/**
	 * @returns undefined if there are no wishlists for this item, true if a wishlist matches, false otherwise
	 */
	public async isWishlisted () {
		const wishlists = Store.items[`item${this.definition.hash}PerkWishlists`];
		if (wishlists?.length === 0)
			// the user doesn't want any roll of this item
			return false;

		if (!wishlists)
			// the user hasn't configured wishlists for this item
			return undefined;

		for (const wishlist of Store.items[`item${this.definition.hash}PerkWishlists`] ?? [])
			if (await this.checkMatchesWishlist(wishlist))
				// all sockets match this wishlist!
				return true;

		// none of the wishlists matched
		return false;
	}

	/**
	 * @returns false if there are no wishlists for this item, and an array with matching wishlists otherwise
	 */
	public async getMatchingWishlists () {
		const wishlists = Store.items[`item${this.definition.hash}PerkWishlists`] ?? [];
		if (!wishlists.length)
			return false;

		const matchingWishlists: IItemPerkWishlist[] = [];
		for (const wishlist of wishlists)
			if (await this.checkMatchesWishlist(wishlist))
				matchingWishlists.push(wishlist);

		return matchingWishlists;
	}

	private async checkMatchesWishlist (wishlist: IItemPerkWishlist) {
		for (const socket of this.sockets) {
			const pool = await socket?.getPool();
			if (pool?.some(plug => wishlist.plugs.includes(plug.plugItemHash))) {
				// the full pool for this socket contains a wishlisted plug
				if (!socket?.plugs.some(plug => wishlist.plugs.includes(plug.plugItemHash))) {
					// but the available plugs on this socket don't
					return false;
				}
			}
		}

		return true;
	}
}

export default Item;
