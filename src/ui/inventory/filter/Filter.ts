import type EnumModel from "model/models/enum/EnumModel";
import type Item from "model/models/items/Item";
import type { DisplayPropertied } from "ui/bungie/DisplayProperties";
import type { EnumModelIconPath } from "ui/bungie/EnumIcon";
import type { FilterChipButton } from "ui/inventory/filter/ItemFilter";
import Arrays from "utility/Arrays";
import type { SupplierOr } from "utility/Type";

enum Filter {
	Shaped,
	Masterwork,
	Ammo,
	Element,
	WeaponType,
	Perk,
	Moment,
	Locked,
	Raw,
}

export default Filter;

export type IFilterSuggestedValue = {
	name: string;
	icon: string;
};

export interface IFilter {
	id: Filter;
	prefix: string;
	suggestedValues?: (IFilterSuggestedValue | string)[];
	suggestedValueHint?: string;
	matches?(filterValue: string): boolean;
	apply (filterValue: string, item: Item): boolean;
	tweakChip?(chip: FilterChipButton, filterValue: string): any;
	colour: `#${string}` | number | ((value: string) => `#${string}` | number);
	maskIcon?: SupplierOr<string | EnumModelIconPath | EnumModel<any, DisplayPropertied> | undefined, [filterValue: string]>;
	icon?: SupplierOr<string | EnumModelIconPath | EnumModel<any, DisplayPropertied> | undefined, [filterValue: string]>;
}

export type IFilterGenerator = IFilter | (() => Promise<IFilter>);

export namespace IFilter {
	export function create (filter: IFilter) {
		return filter;
	}
	export function async (filterGenerator: () => Promise<IFilter>) {
		return filterGenerator;
	}

	export function colour (value: string, colour?: IFilter["colour"]) {
		if (colour === undefined)
			return undefined;

		if (typeof colour === "function")
			colour = colour(value);

		if (typeof colour === "string")
			return colour;

		return `#${colour.toString(16).padStart(6, "0")}`;
	}

	export function icon (value: string, icon?: IFilter["icon"]): string | EnumModelIconPath | undefined {
		if (typeof icon === "function")
			icon = icon(value);

		if (icon === undefined)
			return undefined;

		if (typeof icon === "string")
			return icon;

		if (Array.isArray(icon))
			return icon;

		return Arrays.tuple(icon, value);
	}
}
