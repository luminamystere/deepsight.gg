import Sort from "ui/inventory/sort/Sort";
import SortManager from "ui/inventory/SortManager";
import InventorySlotView from "ui/view/inventory/InventorySlotView";

export default InventorySlotView.clone().configure({
	sort: new SortManager({
		id: "armour",
		name: "Armour",
		default: [Sort.Power, Sort.Name, Sort.Energy],
		inapplicable: [Sort.Deepsight, Sort.Pattern],
	}),
});