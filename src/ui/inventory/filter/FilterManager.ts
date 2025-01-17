import type Item from "model/models/items/Item";
import type { IFilter } from "ui/inventory/filter/Filter";
import Filter from "ui/inventory/filter/Filter";
import type ItemFilter from "ui/inventory/filter/ItemFilter";
import FilterAmmo from "ui/inventory/filter/filters/FilterAmmo";
import ElementFilter from "ui/inventory/filter/filters/FilterElement";
import FilterLocked from "ui/inventory/filter/filters/FilterLocked";
import FilterMasterwork from "ui/inventory/filter/filters/FilterMasterwork";
import FilterMoment from "ui/inventory/filter/filters/FilterMoment";
import FilterPerk from "ui/inventory/filter/filters/FilterPerk";
import FilterShaped from "ui/inventory/filter/filters/FilterShaped";
import FilterWeaponType from "ui/inventory/filter/filters/FilterWeaponType";
import Strings from "utility/Strings";

let filterMap: Record<Filter, IFilter> | undefined;

export interface IFilterManagerConfiguration {
	id: string;
	name: string;
	readonly inapplicable: readonly Filter[];
}

export interface IConfiguredFilter {
	filter: Filter;
	value: string;
}

interface FilterManager extends IFilterManagerConfiguration { }
class FilterManager {

	private readonly current: IConfiguredFilter[] = [];

	public uiComponent?: ItemFilter;

	public constructor (configuration: IFilterManagerConfiguration) {
		Object.assign(this, configuration);
	}

	public static async init () {
		if (filterMap)
			return;

		filterMap = {
			[Filter.Ammo]: FilterAmmo,
			[Filter.Element]: await ElementFilter(),
			[Filter.WeaponType]: await FilterWeaponType(),
			[Filter.Perk]: await FilterPerk(),
			[Filter.Moment]: await FilterMoment(),
			[Filter.Shaped]: FilterShaped,
			[Filter.Masterwork]: FilterMasterwork,
			[Filter.Locked]: FilterLocked,
			[Filter.Raw]: {
				id: Filter.Raw,
				prefix: "",
				colour: undefined as any as 0,
				apply: (value: string, item: Item) =>
					new RegExp(`(?<=^| )${value}`).test(item.definition.displayProperties.name.toLowerCase()),
			},
		};

		for (const [type, sort] of Object.entries(filterMap))
			if (+type !== sort.id)
				throw new Error(`Filter ${Filter[+type as Filter]} implementation miscategorised`);
	}

	public getApplicable () {
		return Object.values(filterMap!)
			.filter(filter => !this.inapplicable.includes(filter.id))
			.sort((a, b) => a.id - b.id);
	}

	public apply (item: Item) {
		return this.current.every(filter => filterMap![filter.filter].apply(filter.value, item));
	}

	public add (token: string) {
		token = token.toLowerCase();
		for (const filter of this.getApplicable()) {
			if (!token.startsWith(filter.prefix))
				continue;

			const value = Strings.extractFromQuotes(token.slice(filter.prefix.length));

			if (filter.matches?.(value) ?? true) {
				this.current.push({
					filter: filter.id,
					value,
				});
				return filter;
			}
		}

		throw new Error(`Somehow, no filters matched the token "${token}" 😕`);
	}

	public reset () {
		this.current.splice(0, Infinity);
	}

	private last: IConfiguredFilter[] = [];
	public hasChanged () {
		const isIdentical = this.last.length === this.current.length
			&& this.last.every((filter, i) =>
				filter.filter === this.current[i].filter
				&& filter.value === this.current[i].value);

		// it's alright that it's the same filters, they get dumped from current rather than modified
		this.last = this.current.slice();
		return !isIdentical;
	}

	public getFilterIds () {
		return this.current.map(filter => `${filterMap![filter.filter].prefix}${filter.value}`);
	}
}

export default FilterManager;
