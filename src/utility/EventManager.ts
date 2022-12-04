
export interface IEventSubscriptionManager<EVENTS = {}, TARGET extends EventTarget = EventTarget> {
	subscribe<TYPE extends keyof EVENTS> (type: TYPE, listener: (this: TARGET, event: Event & EVENTS[TYPE]) => any): this;
	subscribe (type: string, listener: (this: TARGET, event: Event) => any): this;
}

export class EventManager<HOST extends object, EVENTS = {}, TARGET extends EventTarget = EventTarget> {

	public static readonly global = EventManager.make<GlobalEventHandlersEventMap>();

	public static make<EVENTS> () {
		return new EventManager<{}, EVENTS>({});
	}

	public static emit (target: EventTarget | undefined, event: Event | string, init?: ((event: Event) => any) | object) {
		if (init instanceof Event)
			event = init;

		if (typeof event === "string")
			event = new Event(event, { cancelable: true });

		if (typeof init === "function")
			init?.(event);
		else if (init && event !== init)
			Object.assign(event, init);

		target?.dispatchEvent(event);
		return event;
	}

	private readonly host: WeakRef<HOST>;
	private readonly _target: TARGET | WeakRef<TARGET>;

	private get target () {
		return this._target instanceof WeakRef ? this._target.deref() : this._target;
	}

	public constructor (host: HOST, target: TARGET | WeakRef<TARGET> = new EventTarget() as TARGET) {
		this.host = new WeakRef(host);
		this._target = target;
	}

	public subscribe<TYPE extends keyof EVENTS> (type: TYPE, listener: (this: TARGET, event: Event & EVENTS[TYPE]) => any): HOST;
	public subscribe (type: string, listener: (this: TARGET, event: Event) => any): HOST;
	public subscribe (type: never, listener: (this: TARGET, event: any) => any) {
		this.target?.addEventListener(type, listener);
		return this.host.deref() as HOST;
	}

	public subscribeFirst<TYPE extends keyof EVENTS> (type: TYPE, listener: (this: TARGET, event: Event & EVENTS[TYPE]) => any): HOST;
	public subscribeFirst (type: string, listener: (this: TARGET, event: Event) => any): HOST;
	public subscribeFirst (type: string, listener: (this: TARGET, event: any) => any) {
		this.target?.addEventListener(type, listener, { once: true });
		return this.host.deref() as HOST;
	}

	public unsubscribe<TYPE extends keyof EVENTS> (type: TYPE, listener: (this: TARGET, event: Event & EVENTS[TYPE]) => any): HOST;
	public unsubscribe (type: string, listener: (this: TARGET, event: Event) => any): HOST;
	public unsubscribe (type: string, listener: (this: TARGET, event: any) => any) {
		this.target?.removeEventListener(type, listener);
		return this.host.deref() as HOST;
	}

	public async waitFor<TYPE extends keyof EVENTS> (type: TYPE): Promise<Event & EVENTS[TYPE]>;
	public async waitFor (type: string): Promise<Event>;
	public async waitFor (type: string) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return new Promise<any>(resolve =>
			this.target?.addEventListener(type, resolve, { once: true }));
	}

	public until (promise: Promise<any> | keyof EVENTS, initialiser?: (manager: IEventSubscriptionManager<EVENTS, TARGET>) => any): HOST {
		if (typeof promise !== "object")
			promise = this.waitFor(promise);

		const manager: IEventSubscriptionManager<EVENTS, TARGET> = {
			subscribe: (type: never, listener: (this: TARGET, event: any) => any) => {
				this.target?.addEventListener(type, listener);
				void (promise as Promise<any>).then(() => this.target?.removeEventListener(type, listener));
				return manager;
			},
		};
		initialiser?.(manager);
		return this.host.deref() as HOST;
	}

	private pipeTargets = new Map<string, WeakRef<EventTarget>[]>();

	public emit<TYPE extends keyof { [TYPE in keyof EVENTS as Event extends EVENTS[TYPE] ? TYPE : never]: true }> (type: TYPE): void;
	public emit<TYPE extends keyof EVENTS> (type: TYPE, init: Pick<EVENTS[TYPE], Exclude<keyof EVENTS[TYPE], Event>>): void;
	public emit<TYPE extends keyof EVENTS> (type: TYPE, initializer: (event: Event) => EVENTS[TYPE]): void;
	public emit<EVENT extends Event> (event: EVENT, init: Omit<EVENTS[keyof EVENTS], keyof EVENT>): void;
	public emit<EVENT extends EVENTS[keyof EVENTS]> (event: EVENT, initializer?: (event: EVENT) => any): void;
	public emit<EVENT extends Event> (event: EVENT, initializer: (event: EVENT) => EVENTS[keyof EVENTS]): void;
	public emit (event: Event | string, init?: ((event: any) => any) | object) {
		event = EventManager.emit(this.target, event, init);

		const pipeTargets = this.pipeTargets.get(event.type);
		if (pipeTargets) {
			for (let i = 0; i < pipeTargets.length; i++) {
				const pipeTarget = pipeTargets[i].deref();
				if (pipeTarget)
					pipeTarget.dispatchEvent(event);
				else
					pipeTargets.splice(i--, 1);
			}

			if (!pipeTargets.length)
				this.pipeTargets.delete(event.type);
		}

		return this.host.deref() as HOST;
	}

	private pipes = new Map<string, WeakRef<EventManager<any, any>>[]>();

	public pipe<TYPE extends keyof EVENTS> (type: TYPE, on: EventManager<any, { [key in TYPE]: EVENTS[TYPE] }, any>) {
		const typeName = type as string;

		on.insertPipe(typeName, this._target instanceof WeakRef ? this._target : new WeakRef(this._target));

		let pipes = this.pipes.get(typeName);
		if (!pipes) {
			pipes = [];
			this.pipes.set(typeName, pipes);
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		pipes.push(new WeakRef(on));
		return this;
	}

	private insertPipe (type: string, target: WeakRef<EventTarget>) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		let pipeTargets = this.pipeTargets.get(type);
		if (!pipeTargets) {
			pipeTargets = [];
			this.pipeTargets.set(type, pipeTargets);
		}

		pipeTargets.push(target);

		const pipes = this.pipes.get(type);
		if (pipes) {
			for (let i = 0; i < pipes.length; i++) {
				const pipe = pipes[i].deref();
				if (pipe)
					pipe.insertPipe(type, target);
				else
					pipes.splice(i--, 1);
			}

			if (!pipes.length)
				this.pipes.delete(type);
		}
	}
}
