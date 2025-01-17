import type { IFilterManagerConfiguration } from "ui/inventory/filter/FilterManager";
import FilterManager from "ui/inventory/filter/FilterManager";
import Sort from "ui/inventory/sort/Sort";
import type { ISortManagerConfiguration } from "ui/inventory/sort/SortManager";
import SortManager from "ui/inventory/sort/SortManager";
import InventorySlotView from "ui/view/inventory/slot/InventorySlotView";

export const SORTS_DEFAULT_WEAPONS = [Sort.Pattern, Sort.Power, Sort.Name] as const;
export const SORTS_INAPPLICABLE_WEAPONS = [Sort.Energy, Sort.StatTotal, Sort.StatDistribution, Sort.Quantity, "stat-.*"] as const;
export const FILTERS_INAPPLICABLE_WEAPONS = [] as const;

export const VIEW_ID_WEAPONS = "weapons";
export const VIEW_NAME_WEAPONS = "Weapons";

export const SORT_MANAGER_WEAPONS_DEFINITION: ISortManagerConfiguration = {
	id: VIEW_ID_WEAPONS,
	name: VIEW_NAME_WEAPONS,
	default: SORTS_DEFAULT_WEAPONS,
	inapplicable: SORTS_INAPPLICABLE_WEAPONS,
};

export const FILTER_MANAGER_WEAPONS_DEFINITION: IFilterManagerConfiguration = {
	id: VIEW_ID_WEAPONS,
	name: VIEW_NAME_WEAPONS,
	inapplicable: FILTERS_INAPPLICABLE_WEAPONS,
};

export default InventorySlotView.clone().configure({
	sort: new SortManager(SORT_MANAGER_WEAPONS_DEFINITION),
	filter: new FilterManager(FILTER_MANAGER_WEAPONS_DEFINITION),
	parentViewId: VIEW_ID_WEAPONS,
});
