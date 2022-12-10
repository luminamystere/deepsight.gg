import type { IModelGenerationApi } from "model/Model";
import Model from "model/Model";
import type Character from "model/models/Characters";
import { ProfileCharacters } from "model/models/Characters";
import type { Bucket } from "model/models/Items";
import Items from "model/models/Items";
import type Item from "model/models/items/Item";
import type { BucketId, CharacterId, ItemId } from "model/models/items/Item";
import FocusManager from "ui/FocusManager";
import type { IItemComponentCharacterHandler } from "ui/inventory/Item";
import LoadingManager from "ui/LoadingManager";
import Arrays from "utility/Arrays";
import { EventManager } from "utility/EventManager";
import Time from "utility/Time";

interface IInventoryModelEvents {
	update: InventoryModel;
	dispose: Event;
}

Model.event.subscribe("clearCache", () => {
	InventoryModel["INSTANCE"]?.event.emit("dispose");
	clearInterval(InventoryModel["INSTANCE"]?.["interval"]);
	delete InventoryModel["INSTANCE"];
});

export default class InventoryModel implements IItemComponentCharacterHandler {

	private static INSTANCE?: InventoryModel;
	public static get () {
		return InventoryModel.INSTANCE ??= new InventoryModel();
	}

	public static createTemporary () {
		return Model.createTemporary(async progress => InventoryModel.get().await(progress));
	}

	public readonly event = new EventManager<this, IInventoryModelEvents>(this);

	public items?: Record<ItemId, Item>;
	public buckets?: Record<BucketId, Bucket>;
	public characters?: Record<CharacterId, Character>;
	public sortedCharacters?: Character[];

	public getCharacter (id?: CharacterId) {
		return (this.characters?.[id!] ?? this.sortedCharacters?.[0])!;
	}

	public constructor () {
		const disposed = this.event.waitFor("dispose");
		Items.event.until(disposed, event => event
			.subscribe("loading", () => LoadingManager.start("inventory"))
			.subscribe("loaded", ({ value }) => this.updateItems(value)));

		ProfileCharacters.event.until(disposed, event => event
			// don't emit update separately for profile characters, that can be delayed to whenever the next item update is
			.subscribe("loaded", ({ value }) => {
				this.sortedCharacters = Object.values(value)
					.sort(({ dateLastPlayed: dateLastPlayedA }, { dateLastPlayed: dateLastPlayedB }) =>
						new Date(dateLastPlayedB).getTime() - new Date(dateLastPlayedA).getTime());
				this.characters = Object.fromEntries(this.sortedCharacters.map(character => [character.characterId, character]));
			}));

		this.await = this.await.bind(this);
		this.onPageFocusChange = this.onPageFocusChange.bind(this);
		if (FocusManager.focused)
			this.onPageFocusChange(FocusManager);

		FocusManager.event.until(disposed, event => event
			.subscribe("changeFocusState", this.onPageFocusChange));
	}

	private shouldSkipCharacters?: () => boolean;
	public setShouldSkipCharacters (shouldSkip: () => boolean) {
		this.shouldSkipCharacters = shouldSkip;
		return this;
	}

	public async await (progress?: IModelGenerationApi) {
		if (this.shouldSkipCharacters?.() ?? false)
			return this;

		const charactersLoadedPromise = ProfileCharacters.await();

		if (!this.characters) {
			progress?.subscribeProgress(ProfileCharacters, 1 / 2);
			await charactersLoadedPromise;
		}

		const itemsLoadedPromise = Items.await();
		if (!this.buckets) {
			progress?.subscribeProgress(Items, 1 / 2, 1 / 2);
			await itemsLoadedPromise;
		}

		progress?.emitProgress(2 / 2);
		return this as Required<this>;
	}

	private updateItems (buckets: Record<BucketId, Bucket>) {
		this.items ??= {};
		this.buckets = buckets;
		for (const [bucketId, bucket] of Object.entries(this.buckets)) {
			for (let i = 0; i < bucket.items.length; i++) {
				let newItem = bucket.items[i];
				// use old item if it exists
				newItem = this.items[newItem.id]?.update(newItem) ?? newItem;

				if (this.items[newItem.id] !== newItem)
					// if the new item instance is used, subscribe to its bucketChange event
					newItem.event.subscribe("bucketChange", ({ item, oldBucket, equipped }) => {
						// and on its bucket changing, remove it from its old bucket and put it in its new one
						Arrays.remove(this.buckets![oldBucket]?.items, item);
						this.buckets![item.bucket].items.push(item);

						// if this item is equipped now, make the previously equipped item not equipped
						if (equipped)
							for (const potentiallyEquippedItem of this.buckets![item.bucket].items)
								if (potentiallyEquippedItem.equipped && potentiallyEquippedItem !== item)
									delete potentiallyEquippedItem.equipped;
					});

				this.items[newItem.id] = newItem;

				if (newItem.bucket !== bucketId) {
					this.buckets[newItem.bucket].items.push(newItem);
					this.buckets[bucketId as BucketId].items.splice(i, 1);
					i--;
				} else {
					this.buckets[bucketId]!.items[i] = this.items[newItem.id] = newItem;
				}
			}
		}

		this.event.emit("update", this);
		LoadingManager.end("inventory");
	}

	private interval?: number;
	private onPageFocusChange ({ focused }: { focused: boolean }) {
		if (focused)
			void this.await();
		clearInterval(this.interval);
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		this.interval = window.setInterval(this.await, focused ? Time.seconds(5) : Time.minutes(2));
	}
}
