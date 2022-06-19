import UiEventBus from "ui/UiEventBus";

class ExtraInfoManager {

	public constructor () {
		UiEventBus.subscribe("keydown", event => {
			if (event.use("e"))
				this.show("KEY");
		});
		UiEventBus.subscribe("keyup", event => {
			if (event.use("e"))
				this.hide("KEY");
		});
	}

	private showers = new Set<string>();
	public show (id: string) {
		this.showers.add(id);
		document.documentElement.classList.add("show-extra-info");
	}

	public hide (id: string) {
		this.showers.delete(id);
		if (!this.showers.size)
			document.documentElement.classList.remove("show-extra-info");
	}

	public toggle (id: string, newState = !this.showers.has(id)) {
		if (newState)
			this.show(id);
		else
			this.hide(id);
	}
}

export default new ExtraInfoManager;