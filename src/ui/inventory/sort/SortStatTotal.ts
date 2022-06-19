import type { Item } from "model/models/Items";
import Component from "ui/Component";
import Sort, { ISort } from "ui/inventory/sort/Sort";
import { ARMOUR_STATS } from "ui/inventory/tooltip/ItemTooltipStat";

export default ISort.create({
	id: Sort.StatTotal,
	name: "Stat Total",
	sort: (a, b) => getStatTotal(b) - getStatTotal(a),
	render: item => Component.create()
		.classes.add("item-stat-total")
		.text.set(`${getStatTotal(item)}`),
});

function getStatTotal (item: Item) {
	return ARMOUR_STATS.map(stat => item.stats?.[stat]?.intrinsic ?? 0)
		.reduce((a, b) => a + b, 0);
}