import type { TierType } from "bungie-api-ts/destiny2";
import type Manifest from "model/models/Manifest";
import type { IItemInit } from "model/models/items/Item";

export enum TierHashes {
	Basic = 3772930460,
	Common = 3340296461, // internally also called basic for some reason
	Uncommon = 2395677314, // internally called common for some reason
	Rare = 2127292149,
	Legendary = 4008398120,
	Exotic = 2759499571,
	AmazingOmgWtfActuallyWaitThisIsApparentlyJustAnotherBasic = 1801258597,
}

// @ts-expect-error prevent error on import
const x: TierType = 0;

/**
 * Note: This is *NOT* `inventory.tierType`, this is purely a value that exists on `DestinyItemTierTypeDefinition`s
 * @see {@link TierType} — That property and the associated enum is not very useful in general.
 * @see {@link TierHashes} — Try this instead? `inventory.tierTypeHash`
 */
export enum TierIndex {
	Basic,
	Common, // internally also called basic for some reason
	Uncommon, // internally called common for some reason
	Rare,
	Legendary,
	Exotic,
	AmazingOmgWtfActuallyWaitThisIsApparentlyJustAnotherBasic,
}

namespace Tier {

	export async function apply ({ DestinyItemTierTypeDefinition }: Manifest, item: IItemInit) {
		item.tier = await DestinyItemTierTypeDefinition.get(item.definition.inventory?.tierTypeHash);
	}
}

export default Tier;
