import Component from "ui/Component";
import FilterManager from "ui/inventory/filter/FilterManager";
import SortManager from "ui/inventory/sort/SortManager";
import InventoryEquipmentView, { InventorySlotColumnsViewClasses } from "ui/view/inventory/equipment/InventorySlotColumnsView";
import InventoryEnergyView from "ui/view/inventory/slot/InventoryEnergyView";
import InventoryKineticView from "ui/view/inventory/slot/InventoryKineticView";
import InventoryPowerView from "ui/view/inventory/slot/InventoryPowerView";
import { FILTER_MANAGER_WEAPONS_DEFINITION, SORT_MANAGER_WEAPONS_DEFINITION, VIEW_ID_WEAPONS, VIEW_NAME_WEAPONS } from "ui/view/inventory/slot/InventoryWeaponSlotView";

export default InventoryEquipmentView.clone().create({
	id: VIEW_ID_WEAPONS,
	name: VIEW_NAME_WEAPONS,
	childViews: [
		InventoryKineticView,
		InventoryEnergyView,
		InventoryPowerView,
	],
	sort: new SortManager(SORT_MANAGER_WEAPONS_DEFINITION),
	filter: new FilterManager(FILTER_MANAGER_WEAPONS_DEFINITION),
	preUpdateInit (view, wrapper) {
		const component = Component.create()
			.classes.add(InventorySlotColumnsViewClasses.SlotColumn, InventorySlotColumnsViewClasses.PostmasterColumn)
			.append(Component.create()
				.classes.add(InventorySlotColumnsViewClasses.SlotColumnTitle)
				.text.set("\xa0"))
			.appendTo(wrapper.content);

		view.columns.push({
			name: "Postmaster",
			component,
		});
	},
	onItemMoveStart (view, wrapper, item, event) {
		wrapper.content.element.scrollTo({ top: 0, behavior: "smooth" });
	},
});
