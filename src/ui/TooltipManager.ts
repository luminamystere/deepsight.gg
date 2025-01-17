import { Classes } from "ui/Classes";
import type { AnyComponent } from "ui/Component";
import Component from "ui/Component";
import Async from "utility/Async";

export enum TooltipClasses {
	Storage = "tooltip-storage",
	Surface = "tooltip-surface",
	Reversed = "tooltip-reversed",

	Main = "tooltip",
	Wrapper = "tooltip-wrapper",
	Extra = "tooltip-extra",
	Header = "tooltip-header",
	Title = "tooltip-title",
	Subtitle = "tooltip-subtitle",
	Tier = "tooltip-tier",
	Content = "tooltip-content",
	Footer = "tooltip-footer",
	Hints = "tooltip-hints",
	Forced1pxBigger = "tooltip-forced-1px-bigger",
}

export class TooltipWrapper extends Component<HTMLElement, [Tooltip]> {
	public tooltip!: Tooltip;

	protected override onMake (tooltip: Tooltip): void {
		this.classes.add(TooltipClasses.Wrapper);
		this.tooltip = tooltip.appendTo(this);
	}
}

export class Tooltip extends Component {
	public owner?: WeakRef<AnyComponent>;
	public header!: Component;
	public title!: Component<HTMLHeadingElement>;
	public subtitle!: Component;
	public tier!: Component;
	public content!: Component;
	public footer!: Component;
	public wrapper!: TooltipWrapper;
	private _hints?: Component;
	private _extra?: Tooltip;

	public get extra (): Tooltip {
		return this._extra ??= Tooltip.create()
			.classes.add(TooltipClasses.Extra)
			.appendTo(this.wrapper);
	}

	public get hints (): Component {
		return this._hints ??= Component.create()
			.classes.add(TooltipClasses.Hints)
			.appendTo(this.footer);
	}

	protected override onMake (): void {
		this.classes.add(TooltipClasses.Main);

		this.wrapper = TooltipWrapper.create([this]);

		this.header = Component.create("header")
			.classes.add(TooltipClasses.Header)
			.appendTo(this);

		this.title = Component.create("h2")
			.classes.add(TooltipClasses.Title)
			.appendTo(this.header);

		this.subtitle = Component.create()
			.classes.add(TooltipClasses.Subtitle)
			.appendTo(this.header);

		this.tier = Component.create()
			.classes.add(TooltipClasses.Tier)
			.appendTo(this.header);

		this.content = Component.create()
			.classes.add(TooltipClasses.Content)
			.appendTo(this);

		this.footer = Component.create("footer")
			.classes.add(TooltipClasses.Footer)
			.appendTo(this);
	}

	public setPadding (padding: number) {
		this.style.set("--mouse-offset", `${padding}px`);
		return this;
	}
}

namespace TooltipManager {

	const tooltipStorage = Component.create()
		.classes.add(TooltipClasses.Storage)
		.appendTo(document.body);

	const tooltipSurface = Component.create()
		.classes.add(TooltipClasses.Surface)
		.appendTo(document.body);

	let tooltipsEnabled = window.innerWidth > 800;

	export interface ITooltipClass<TOOLTIP> {
		get (): TOOLTIP;
		createRaw (): TOOLTIP;
	}

	export function create<TOOLTIP extends Tooltip> (initialiser: (tooltip: Tooltip) => TOOLTIP): ITooltipClass<TOOLTIP> {
		let tooltip: TOOLTIP | undefined;
		return {
			get () {
				if (tooltip) return tooltip;
				tooltip = initialiser(Tooltip.create());
				tooltip.wrapper.appendTo(tooltipStorage);
				return tooltip;
			},
			createRaw: () => initialiser(Tooltip.create()),
		};
	}

	export function show<TOOLTIP extends Tooltip> (tooltipClass: ITooltipClass<TOOLTIP>, initialiser: (tooltip: TOOLTIP) => any, hidePreviousIfSame = true) {
		const tooltip = tooltipClass.get();
		hideTooltips(hidePreviousIfSame ? undefined : tooltip);

		if (!tooltipsEnabled)
			return;

		tooltip.classes.remove(TooltipClasses.Forced1pxBigger);
		void Promise.resolve(initialiser(tooltip))
			.then(async () => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				if ((window as any).chrome) {
					await Async.sleep(1);
					if (tooltip.element.clientHeight % 2 !== window.innerHeight % 2)
						tooltip.classes.add(TooltipClasses.Forced1pxBigger);
				}
			});

		tooltip.wrapper
			.classes.remove(Classes.Hidden)
			.appendTo(tooltipSurface);
	}

	function hideTooltips (current?: Component) {
		for (const child of tooltipSurface.element.children) {
			const childComponent = child.component?.deref();
			if (!childComponent) {
				console.warn("Not a valid tooltip", child);
				child.remove();
				continue;
			}

			if (childComponent !== current)
				hide((childComponent as TooltipWrapper).tooltip);
		}
	}

	export function hide (tooltip: Tooltip) {
		if (tooltip.wrapper.classes.has(Classes.Hidden))
			// already hiding
			return;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const hideLock = (tooltip as any).TOOLTIP_HIDE_LOCK = Math.random();
		const persistTooltips = document.documentElement.classList.contains("persist-tooltips");
		if (!persistTooltips)
			tooltip.wrapper.classes.add(Classes.Hidden);
		void Async.sleep(500).then(() => {
			if (!tooltip.wrapper.classes.has(Classes.Hidden))
				// tooltip has been shown again, don't touch
				return;

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if ((tooltip as any).TOOLTIP_HIDE_LOCK !== hideLock)
				// a different call of this method is responsible for hiding the tooltip now
				return;

			if (!persistTooltips)
				tooltip.wrapper.appendTo(tooltipStorage);
		});
	}

	Component.event.subscribe("setTooltip", ({ component, tooltip: tooltipClass, handler }) => {
		const tooltip = tooltipClass.get();
		component.event.until("clearTooltip", event => event
			.subscribe("mouseover", () => {
				if (tooltip.owner?.deref() === component)
					return; // this tooltip is already shown

				tooltip.owner = new WeakRef(component);
				TooltipManager.show(tooltipClass, handler.initialiser, handler.differs?.(tooltip));
			})
			.subscribe("mouseout", event => {
				if (component.element.contains(document.elementFromPoint(event.clientX, event.clientY)))
					return;

				hideTooltip();
			}));

		void component.event.waitFor("clearTooltip")
			.then(hideTooltip);

		function hideTooltip () {
			if (tooltip.owner?.deref() === component) {
				delete tooltip.owner;
				TooltipManager.hide(tooltip);
			}
		}
	});

	let reversed: boolean | undefined;
	document.body.addEventListener("mousemove", event => {
		const switchTooltipAt = (800 / 1920) * window.innerWidth;
		const switchTooltipDirection = reversed && event.clientX < switchTooltipAt
			|| !reversed && event.clientX > window.innerWidth - switchTooltipAt;

		if (switchTooltipDirection && [...tooltipSurface.element.children].some(tooltip => !tooltip.classList.contains(Classes.Hidden))) {
			tooltipSurface.classes.toggle(TooltipClasses.Reversed);
			reversed = !reversed;
		}

		tooltipSurface.element.scrollLeft = tooltipSurface.element.scrollWidth - window.innerWidth - event.clientX;
		tooltipSurface.element.scrollTop = tooltipSurface.element.scrollHeight - window.innerHeight - window.innerHeight / 2 - event.clientY;
	});

	window.addEventListener("resize", () => {
		tooltipsEnabled = window.innerWidth > 800;
		hideTooltips();
	});
}

export default TooltipManager;
