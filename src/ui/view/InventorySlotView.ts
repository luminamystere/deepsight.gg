import type { DestinyCharacterComponent } from "bungie-api-ts/destiny2";
import { DestinyComponentType } from "bungie-api-ts/destiny2";
import type { DestinyGeneratedEnums, ItemCategoryHashes } from "bungie-api-ts/generated-enums";
import type { DestinyEnumHelper } from "model/models/DestinyEnums";
import DestinyEnums from "model/models/DestinyEnums";
import type { Bucket, BucketId } from "model/models/Items";
import Items from "model/models/Items";
import Profile from "model/models/Profile";
import { InventoryClasses } from "ui/Classes";
import Component from "ui/Component";
import BucketComponent from "ui/inventory/Bucket";
import ItemComponent from "ui/inventory/Item";
import View from "ui/View";

export enum InventorySlotViewClasses {
	Main = "view-inventory-slot",
	CharacterBuckets = "view-inventory-slot-character-buckets",
	CharacterBucket = "view-inventory-slot-character-bucket",
	CharacterBucketEmblem = "view-inventory-slot-character-bucket-emblem",
	CharacterBucketEquipped = "view-inventory-slot-character-bucket-equipped",
	CharacterBucketInventory = "view-inventory-slot-character-bucket-inventory",
	VaultBucket = "view-inventory-slot-vault-bucket",
}

interface ICharacterBucket {
	character: DestinyCharacterComponent;
	bucketComponent: BucketComponent;
	equippedComponent: Component;
}

function initialiseCharacterComponent (character: DestinyCharacterComponent): ICharacterBucket {
	const bucketComponent = BucketComponent.create()
		.classes.add(InventorySlotViewClasses.CharacterBucket);

	Component.create()
		.classes.add(InventorySlotViewClasses.CharacterBucketEmblem, InventoryClasses.Slot)
		.appendTo(bucketComponent.header);

	const equippedComponent = Component.create()
		.classes.add(InventorySlotViewClasses.CharacterBucketEquipped, InventoryClasses.Slot)
		.appendTo(bucketComponent);

	bucketComponent.inventory.classes.add(InventorySlotViewClasses.CharacterBucketInventory);

	void bucketComponent.initialiseFromCharacter(character);

	return {
		character,
		bucketComponent,
		equippedComponent,
	};
}

export default new View.Factory()
	.using(Items)
	.define<{ slot: (hashes: DestinyEnumHelper<DestinyGeneratedEnums["ItemCategoryHashes"]>) => ItemCategoryHashes }>()
	.initialise(async (component, buckets) => {
		const { characters: characterData } = await Profile(DestinyComponentType.Characters).await();
		if (!characterData.data || !Object.keys(characterData.data).length) {
			console.warn("No characters");
			return;
		}

		component.classes.add(InventorySlotViewClasses.Main);

		const { ItemCategoryHashes } = await DestinyEnums.await();

		const characterBuckets = Component.create()
			.classes.add(InventorySlotViewClasses.CharacterBuckets)
			.appendTo(component);

		const vaultBucket = BucketComponent.create()
			.classes.add(InventorySlotViewClasses.VaultBucket)
			.tweak(vault => vault.icon.style.set("--icon",
				"url(\"https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/general/vault2.svg\")"))
			.tweak(vault => vault.title.text.add("Vault"))
			.appendTo(component);

		const characterBucketsSorted = Object.values(characterData.data)
			.sort(({ dateLastPlayed: dateLastPlayedA }, { dateLastPlayed: dateLastPlayedB }) =>
				new Date(dateLastPlayedB).getTime() - new Date(dateLastPlayedA).getTime())
			.map(initialiseCharacterComponent);

		characterBuckets.append(...characterBucketsSorted.map(bucket => bucket.bucketComponent));

		const characters = Object.fromEntries(characterBucketsSorted.map(bucket => [
			bucket.character.characterId,
			bucket,
		]));

		// const { DestinyItemCategoryDefinition } = await Manifest.await();
		for (const [bucketId, bucket] of Object.entries(buckets) as [BucketId, Bucket][]) {
			if (bucketId === "inventory")
				continue;

			let bucketComponent: BucketComponent;
			if (bucketId === "vault")
				bucketComponent = vaultBucket;
			else {
				const character = characters[bucketId];
				if (!character) {
					console.warn(`Unknown character '${bucketId}'`);
					continue;
				}

				bucketComponent = character.bucketComponent;
			}

			for (const item of bucket.items) {
				const categories = item.definition.itemCategoryHashes ?? []
				// (await Promise.all((item.definition.itemCategoryHashes ?? [])
				// .map(category => DestinyItemCategoryDefinition.get(category))))
				// .filter((category): category is DestinyItemCategoryDefinition => category !== undefined);

				if (!categories.includes(component.definition.slot(ItemCategoryHashes)))
					continue;

				ItemComponent.create([item])
					.appendTo(Component.create()
						.classes.add(InventoryClasses.Slot)
						.appendTo(bucketComponent.inventory));
			}
		}
	});
