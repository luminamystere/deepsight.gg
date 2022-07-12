namespace Maths {
	/**
	 * Note: This implementation matches DIM's to ensure consistency between apps.  
	 * See: https://github.com/DestinyItemManager/DIM/blob/83ec236416fae879c09f4aa93be7d3be4843510d/src/app/inventory/store/stats.ts#L582-L585
	 * Also see: https://github.com/Bungie-net/api/issues/1029#issuecomment-531849137
	 */
	export function bankersRound (x: number) {
		const r = Math.round(x);
		return (x > 0 ? x : -x) % 1 === 0.5 ? (0 === r % 2 ? r : r - 1) : r;
	}
}

export default Maths;
