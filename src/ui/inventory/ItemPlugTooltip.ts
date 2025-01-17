import type Item from "model/models/items/Item";
import type { Perk, Plug } from "model/models/items/Plugs";
import { PlugType } from "model/models/items/Plugs";
import { TierHashes } from "model/models/items/Tier";
import Display from "ui/bungie/DisplayProperties";
import { Classes } from "ui/Classes";
import Component from "ui/Component";
import { Hint, IInput } from "ui/Hints";
import ItemClarity, { ItemClarityDefinitions } from "ui/inventory/tooltip/ItemClarity";
import TooltipManager, { Tooltip } from "ui/TooltipManager";
import type { IKeyUpEvent } from "ui/UiEventBus";
import UiEventBus from "ui/UiEventBus";

enum ItemPlugTooltipClasses {
	Main = "item-plug-tooltip",
	Content = "item-plug-tooltip-content",
	Description = "item-plug-tooltip-description",
	Perk = "item-plug-tooltip-perk",
	Enhanced = "item-plug-tooltip-enhanced",
	Exotic = "item-plug-tooltip-exotic",
	ClarityURL = "item-plug-tooltip-clarity-url",
	Extra = "item-plug-tooltip-extra",
	ExtraHeader = "item-plug-tooltip-extra-header",
	ExtraContent = "item-plug-tooltip-extra-content",
}

class ItemPlugTooltip extends Tooltip {

	public plug?: Plug;
	public perk?: Perk;
	public item?: Item;

	public description!: Component;
	public clarity!: ItemClarity;
	public clarityDefinitions!: ItemClarityDefinitions;
	public hintShowDefinitions!: Hint;

	protected override onMake () {
		this.classes.add(ItemPlugTooltipClasses.Main);
		this.content.classes.add(ItemPlugTooltipClasses.Content);

		this.description = Component.create()
			.classes.add(ItemPlugTooltipClasses.Description)
			.appendTo(this.content);

		this.clarity = ItemClarity.create()
			.insertToAfter(this, this.content);

		this.hintShowDefinitions = Hint.create([IInput.get("KeyE")])
			.classes.add(Classes.ShowIfNotExtraInfo)
			.tweak(hint => hint.label.text.set("Show Definitions"))
			.appendTo(this.hints);

		Hint.create([IInput.get("MouseMiddle")])
			.tweak(hint => hint.label.text.add("Visit ")
				.append(Component.create("span")
					.classes.add(ItemPlugTooltipClasses.ClarityURL)
					.text.set("d2clarity.com")))
			.appendTo(this.hints);

		this.extra.classes.add(ItemPlugTooltipClasses.Extra);
		this.extra.header.classes.add(ItemPlugTooltipClasses.ExtraHeader);
		this.extra.content.classes.add(ItemPlugTooltipClasses.ExtraContent);

		this.clarityDefinitions = ItemClarityDefinitions.create()
			.appendTo(this.extra.content);

		this.onGlobalKeyup = this.onGlobalKeyup.bind(this);
		UiEventBus.subscribe("keyup", this.onGlobalKeyup);
	}

	public setPlug (plug: Plug, perk?: Perk, item?: Item) {
		this.plug = plug;
		this.perk = perk;
		this.item = item;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		(window as any).plug = plug;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		(window as any).perk = perk;
		console.log(Display.name(perk?.definition) ?? Display.name(plug.definition), plug, perk);

		this.title.text.set(Display.name(perk?.definition) ?? Display.name(plug.definition));
		this.subtitle.removeContents();

		this.subtitle.text.set(plug.is(PlugType.Catalyst) ? "Catalyst" : plug.definition?.itemTypeDisplayName ?? "Unknown");
		this.description.text.set(Display.description(perk?.definition) ?? Display.description(plug.definition));

		this.header.classes.toggle(plug.is(PlugType.Perk), ItemPlugTooltipClasses.Perk);
		this.header.classes.toggle(plug.is(PlugType.Enhanced) || plug.is(PlugType.Catalyst) && item?.definition.inventory?.tierTypeHash === TierHashes.Exotic, ItemPlugTooltipClasses.Enhanced);
		this.header.classes.toggle((plug.is(PlugType.Intrinsic) || plug.is(PlugType.Catalyst)) && item?.definition.inventory?.tierTypeHash === TierHashes.Exotic, ItemPlugTooltipClasses.Exotic);

		this.clarity.set(plug.clarity);
		this.clarityDefinitions.set(plug.clarity);
		this.footer.classes.toggle(!this.clarity.isPresent, Classes.Hidden);
		this.extra.classes.toggle(!this.clarityDefinitions.isPresent, Classes.Hidden);
		this.hintShowDefinitions.classes.toggle(!this.clarityDefinitions.isPresent, Classes.Hidden);
	}

	protected onGlobalKeyup (event: IKeyUpEvent) {
		if (this.clarity.isPresent && event.hovering(".view-item-socket-plug") && event.use("MouseMiddle")) {
			window.open("https://www.d2clarity.com", "_blank");
		}
	}
}

export default TooltipManager.create(tooltip => tooltip
	.make(ItemPlugTooltip));
