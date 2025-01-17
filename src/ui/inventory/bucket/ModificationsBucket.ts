import { CardClasses } from "ui/Card";
import InventoryBucket from "ui/inventory/bucket/InventoryBucket";

export default class ModificationsBucket extends InventoryBucket {
	protected override onMake (): void {
		super.onMake();
		this.setDisplayMode(CardClasses.DisplayModeSection);
		this.icon.style.set("--icon", "url(\"https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/general/modifications.svg\")");
		this.title.text.add("Modifications");
	}
}
