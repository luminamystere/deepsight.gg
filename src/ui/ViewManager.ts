import { APP_NAME } from "Constants";
import type Model from "model/Model";
import View from "ui/View";
import AuthView from "ui/view/AuthView";
import ErrorView from "ui/view/ErrorView";
import InventoryArmsView from "ui/view/inventory/InventoryArmsView";
import InventoryChestView from "ui/view/inventory/InventoryChestView";
import InventoryClassItemView from "ui/view/inventory/InventoryClassItemView";
import InventoryEnergyView from "ui/view/inventory/InventoryEnergyView";
import InventoryHelmetView from "ui/view/inventory/InventoryHelmetView";
import InventoryKineticView from "ui/view/inventory/InventoryKineticView";
import InventoryLegsView from "ui/view/inventory/InventoryLegsView";
import InventoryPowerView from "ui/view/inventory/InventoryPowerView";
import ItemView from "ui/view/item/ItemView";
import ItemTooltipView from "ui/view/itemtooltip/ItemTooltipView";
import SettingsView from "ui/view/SettingsView";
import Async from "utility/Async";
import { EventManager } from "utility/EventManager";
import Strings from "utility/Strings";
import URL from "utility/URL";

const registry = Object.fromEntries([
	AuthView,
	// InventoryOverviewView,
	InventoryKineticView,
	InventoryEnergyView,
	InventoryPowerView,
	InventoryHelmetView,
	InventoryArmsView,
	InventoryChestView,
	InventoryLegsView,
	InventoryClassItemView,
	SettingsView,
	ItemView,
	ErrorView,
	ItemTooltipView,
].map((view) => [view.id, view as View.Handler<readonly Model<any, any>[]>] as const));

View.event.subscribe("show", ({ view }) => ViewManager.show(view));
View.event.subscribe("hide", () => ViewManager.hide());
URL.event.subscribe("navigate", () => {
	ViewManager.showByHash(URL.hash);
});

export interface IViewManagerEvents {
	hide: { view: View.WrapperComponent };
	show: { view: View.WrapperComponent };
}

export default class ViewManager {

	public static readonly event = EventManager.make<IViewManagerEvents>();

	public static get registry () {
		return registry;
	}

	public static view?: View.WrapperComponent;
	private static history: string[] = [];

	public static defaultView = InventoryKineticView;

	public static hasView () {
		return !!this.view;
	}

	public static showDefaultView () {
		this.defaultView.show();
	}

	public static showByHash (hash: string): void {
		if (hash === this.view?.hash)
			return;

		const view = registry[hash] ?? registry[Strings.sliceTo(hash, "/")];
		if (view?.redirectOnLoad === true || hash === "")
			return this.showDefaultView();
		else if (view?.redirectOnLoad)
			return this.showByHash(view.redirectOnLoad);

		if (!view) {
			console.warn(`Tried to navigate to an unknown view '${hash}'`);
			return;
		}

		const args: any[] = [];
		if (view !== registry[hash])
			args.push(Strings.sliceAfter(hash, "/"));

		this.show(view.show(...args as []));
	}

	public static show (view: View.WrapperComponent) {
		if (this.view === view)
			return;

		const oldView = this.view;
		if (oldView) {
			oldView.event.emit("hide");
			this.event.emit("hide", { view: oldView });
			oldView.classes.add(View.Classes.Hidden);
			void Async.sleep(1000).then(() => oldView.remove());
		}

		this.history.push(view.hash);
		URL.hash = view.hash;
		this.view = view;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		(window as any).view = view;
		view.appendTo(document.body);
		this.event.emit("show", { view });
		view.event.until("hide", manager => manager
			.subscribe("updateTitle", () => this.updateDocumentTitle(view))
			.subscribe("back", () => this.hide()));

		this.updateDocumentTitle(view);
	}

	public static hide () {
		this.history.pop();
		const previous = this.history.pop();
		if (previous)
			this.showByHash(previous);
	}

	private static updateDocumentTitle (view: View.WrapperComponent) {
		let name = view.definition.name;
		if (typeof name === "function")
			name = name(...view._args.slice(1) as []);

		document.title = `${name} // ${APP_NAME}`;
	}
}
