import { ItemCategoryHashes } from "bungie-api-ts/destiny2";
import WeaponTypes from "model/models/enum/WeaponTypes";
import Component from "ui/Component";
import EnumIcon from "ui/bungie/EnumIcon";
import Sort, { ISort } from "ui/inventory/sort/Sort";

export default ISort.create({
	id: Sort.WeaponType,
	name: "Weapon Type",
	shortName: "Type",
	sort: (a, b) => (a.definition.itemTypeDisplayName ?? "").localeCompare(b.definition.itemTypeDisplayName ?? ""),
	renderSortable: sortable => sortable.maskIcon
		.tweak(EnumIcon.applyIconVar, WeaponTypes, ItemCategoryHashes.HandCannon),
	render: item => !item.definition.itemCategoryHashes?.includes(ItemCategoryHashes.Weapon) ? undefined
		: Component.create()
			.classes.add("item-weapon-type-icon")
			.tweak(component => EnumIcon.applyIcon(WeaponTypes, item.definition.itemCategoryHashes, iconPath =>
				component.style.set("--icon", `url("${iconPath}")`))),
});
