import Model from "model/Model";
import { EventManager } from "utility/EventManager";

export interface ILoadingManagerEvents {
	start: Event;
	end: Event;
}

class LoadingManager {

	public readonly event = new EventManager<this, ILoadingManagerEvents>(this);

	public readonly model = Model.createTemporary(async () => this.event.waitFor("end"))

	private loaders = new Set<string>();

	public get loading () {
		return this.loaders.size > 0;
	}

	public start (id: string) {
		const newlyLoading = this.loaders.size === 0;
		this.loaders.add(id);
		if (newlyLoading) {
			this.event.emit("start");
			this.model.get();
		}
	}

	public end (id: string) {
		this.loaders.delete(id);
		if (!this.loaders.size)
			this.event.emit("end");
	}

	public toggle (id: string, newState = !this.loaders.has(id)) {
		if (newState)
			this.start(id);
		else
			this.end(id);
	}
}

export default new LoadingManager;
