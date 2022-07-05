import Component from "ui/Component";

export enum ButtonClasses {
	Main = "button",
	Icon = "button-icon",
	InnerIcon = "button-icon-inner",
	Attention = "button-attention",
}

export default class Button<ARGS extends any[] = []> extends Component<HTMLButtonElement, ARGS> {

	protected static override defaultType = "button";

	protected override onMake (...args: ARGS) {
		this.classes.add(ButtonClasses.Main);
	}

	public innerIcon?: Component;
	public addIcon (tweaker?: (component: Component) => any) {
		this.innerIcon?.remove();
		return this.prepend(this.innerIcon = Component.create()
			.classes.add(ButtonClasses.InnerIcon)
			.append(Component.create())
			.append(Component.create())
			.tweak(tweaker));
	}
}
