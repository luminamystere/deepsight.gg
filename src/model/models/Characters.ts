import type { DestinyCharacterComponent, DestinyClassDefinition, DestinyInventoryItemDefinition, DestinyProfileProgressionComponent, SingleComponentResponse } from "bungie-api-ts/destiny2";
import type { GroupUserInfoCard } from "bungie-api-ts/groupv2";
import Model from "model/Model";
import Manifest from "model/models/Manifest";
import { getCurrentDestinyMembership } from "model/models/Memberships";
import ProfileBatch from "model/models/ProfileBatch";
import type { CharacterId } from "model/models/items/Item";
import Objects from "utility/Objects";
import Time from "utility/Time";

interface Character extends DestinyCharacterComponent {
	class: DestinyClassDefinition;
	emblem?: DestinyInventoryItemDefinition;
	/**
	 * The average power level of your equipped gear. 
	 * 
	 * To get the average power level of your equipped gear *plus* your seasonal artefact bonus, see the `light` property.
	 */
	power: number;
}

interface IProfileProgression {
	profileProgression?: SingleComponentResponse<DestinyProfileProgressionComponent>;
}

class Character {

	public static async get (characterComponent: DestinyCharacterComponent, manifest: Manifest, profile: IProfileProgression) {
		const character = new Character();
		Object.assign(character, characterComponent);

		const { DestinyClassDefinition, DestinyInventoryItemDefinition } = manifest;
		character.class = await DestinyClassDefinition.get(character.classHash)!;
		character.emblem = await DestinyInventoryItemDefinition.get(character.emblemHash);
		character.power = (character.light ?? 0) - (profile.profileProgression?.data?.seasonalArtifact.powerBonus ?? 0);

		return character;
	}
}

export default Character;

export const ProfileCharacters = Model.createDynamic(Time.seconds(30), async progress => {
	progress.emitProgress(0 / 2, "Fetching characters");
	const profile = await ProfileBatch.await();

	const manifest = await progress.subscribeProgressAndWait(Manifest, 1 / 2, 1 / 2);

	return Objects.mapAsync(profile.characters?.data ?? {}, async ([key, character]) =>
		[key, await Character.get(character, manifest, profile)]);
});

export interface CharacterInfoCard extends GroupUserInfoCard {
	characterId?: CharacterId;
}

export async function getCurrentMembershipAndCharacter (): Promise<CharacterInfoCard> {
	const membership = await getCurrentDestinyMembership();
	const profile = await ProfileBatch.await();
	return {
		...membership,
		characterId: !profile.characters?.data ? undefined : Object.keys(profile.characters?.data ?? Objects.EMPTY)[0] as CharacterId,
	};
}
