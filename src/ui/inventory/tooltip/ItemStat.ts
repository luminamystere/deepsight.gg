import { DestinyItemSubType, ItemCategoryHashes } from "bungie-api-ts/destiny2";
import type Item from "model/models/items/Item";
import type { IStat } from "model/models/items/Stats";
import { Classes } from "ui/Classes";
import Component from "ui/Component";
import type { StatOrder } from "ui/inventory/Stat";
import { ARMOUR_STAT_GROUPS, ARMOUR_STAT_MAX, IStatDistribution, Stat } from "ui/inventory/Stat";
import RecoilDirection from "ui/inventory/tooltip/stats/RecoilDirection";

enum CustomStat {
	Total = -1,
	Distribution = -2,
}

interface ICustomStatDisplayDefinition extends Partial<IStat> {
	hash: number;
	order: StatOrder;
	name?: string;
	group?: number;
	min?: number;
	max?: number;
	bar?: boolean;
	plus?: true;
	displayEntireFormula?: true;
	combinedValue?: number;
	combinedText?: string;
	render?(item: Item, stat: ICustomStatDisplayDefinition, allStats: ICustomStatDisplayDefinition[]): boolean;
	calculate?(item: Item, stat: ICustomStatDisplayDefinition): Omit<ICustomStatDisplayDefinition, "calculate" | "definition" | "order" | "hash"> | undefined;
	renderFormula?(item: Item, stat: ICustomStatDisplayDefinition): Component[];
	renderBar?(bar: Component, item: Item, value: number): any;
}

export enum ItemStatClasses {
	Wrapper = "item-stat-wrapper",
	Main = "item-stat",
	Label = "item-stat-label",
	LabelMasterwork = "item-stat-label-masterwork",
	GroupLabel = "item-stat-group-label",
	Bar = "item-stat-bar",
	BarBlock = "item-stat-bar-block",
	BarBlockNegative = "item-stat-bar-block-negative",
	Value = "item-stat-value",
	ValueComponent = "item-stat-value-component",
	ValueComponentNegative = "item-stat-value-component-negative",
	Combined = "item-stat-combined",
	Intrinsic = "item-stat-intrinsic",
	Random = "item-stat-random",
	Masterwork = "item-stat-masterwork",
	Mod = "item-stat-mod",
	Formula = "item-stat-formula",
	Distribution = "item-stat-distribution-component",
	DistributionGroupLabel = "item-stat-distribution-component-group-label",
}

const customStats: Record<CustomStat, ICustomStatDisplayDefinition> = {
	[CustomStat.Total]: {
		hash: CustomStat.Total,
		order: 1000,
		name: "Total",
		calculate: item => {
			const armourStats = ARMOUR_STAT_GROUPS.flat();
			const totalIntrinsic = armourStats.map(stat => item.stats?.values[stat]?.intrinsic ?? 0)
				.reduce((a, b) => a + b, 0);
			const totalRandom = armourStats.map(stat => item.stats?.values[stat]?.roll ?? 0)
				.reduce((a, b) => a + b, 0);
			const totalMasterwork = armourStats.map(stat => item.stats?.values[stat]?.masterwork ?? 0)
				.reduce((a, b) => a + b, 0);
			const totalMod = armourStats.map(stat => item.stats?.values[stat]?.mod ?? 0)
				.reduce((a, b) => a + b, 0);
			if (totalIntrinsic + totalMasterwork + totalMod === 0)
				return undefined; // this item doesn't have armour stats

			return {
				value: totalIntrinsic + totalRandom + totalMasterwork + totalMod,
				intrinsic: totalIntrinsic,
				roll: totalRandom,
				masterwork: totalMasterwork,
				mod: totalMod,
			};
		},
	},
	[CustomStat.Distribution]: {
		hash: CustomStat.Distribution,
		order: 1001,
		name: "Distribution",
		calculate: item => {
			const distribution = IStatDistribution.get(item);
			if (!distribution.overall)
				return undefined; // this item doesn't have armour stats

			return {
				value: distribution.overall,
				combinedValue: distribution.overall,
				combinedText: `${Math.floor(distribution.overall * 100)}%`,
				renderFormula: () => distribution.groups.map((groupValue, i) => Component.create()
					.classes.add(ItemStatClasses.Distribution)
					.text.set(`${Math.floor(groupValue * 100)}%`)
					.append(Component.create("sup")
						.classes.add(ItemStatClasses.DistributionGroupLabel)
						.text.set(`${i + 1}`))
					.style.set("--value", `${groupValue}`)),
			};
		},
	},
};

const renderArmourStat = (item: Item, _: ICustomStatDisplayDefinition, allStats: ICustomStatDisplayDefinition[]) =>
	ARMOUR_STAT_GROUPS.flat()
		.map(stat => allStats.find(display => display.hash === stat))
		.some(display => {
			const cdisplay = display?.calculate?.(item, display) ?? display;
			return cdisplay?.combinedValue ?? (cdisplay?.intrinsic ?? 0) + (cdisplay?.masterwork ?? 0) + (cdisplay?.mod ?? 0);
		});

type StatDisplayDef = Partial<ICustomStatDisplayDefinition> | false;
const customStatDisplays: Record<CustomStat, StatDisplayDef> & Partial<Record<Stat, StatDisplayDef>> = {
	// undrendered
	[Stat.Attack]: false,
	[Stat.Defense]: false,
	[Stat.Power]: false,
	[Stat.InventorySize]: false,
	[Stat.Mystery1]: false,
	[Stat.Mystery2]: false,
	[Stat.GhostEnergyCapacity]: false,
	[Stat.ModCost]: false,

	// weapons
	[Stat.AirborneEffectiveness]: {
		name: "Airborne Aim",
		render: item => item.definition.itemSubType !== DestinyItemSubType.Sword,
	},
	[Stat.RPM]: { name: "RPM", max: undefined },
	[Stat.DrawTime]: { max: undefined },
	[Stat.ChargeTime]: {
		bar: true,
		render: item => item.definition.itemSubType !== DestinyItemSubType.Bow && item.definition.itemSubType !== DestinyItemSubType.Sword,
	},
	[Stat.RecoilDirection]: {
		bar: true,
		renderBar: (bar, item, stat) => bar.removeContents()
			.append(RecoilDirection(stat)),
	},
	[Stat.Magazine]: { render: item => item.definition.itemSubType !== DestinyItemSubType.Sword },
	[Stat.Zoom]: { render: item => item.definition.itemSubType !== DestinyItemSubType.Sword },
	[Stat.Stability]: { render: item => item.definition.itemSubType !== DestinyItemSubType.Sword },
	[Stat.Range]: { render: item => item.definition.itemSubType !== DestinyItemSubType.Sword },

	// armour
	[Stat.Mobility]: { plus: true, max: ARMOUR_STAT_MAX, render: renderArmourStat },
	[Stat.Resilience]: { plus: true, max: ARMOUR_STAT_MAX, render: renderArmourStat },
	[Stat.Recovery]: { plus: true, max: ARMOUR_STAT_MAX, render: renderArmourStat },
	[Stat.Discipline]: { plus: true, max: ARMOUR_STAT_MAX, render: renderArmourStat },
	[Stat.Intellect]: { plus: true, max: ARMOUR_STAT_MAX, render: renderArmourStat },
	[Stat.Strength]: { plus: true, max: ARMOUR_STAT_MAX, render: renderArmourStat },

	...customStats,
};

for (const [stat, display] of Object.entries(customStatDisplays)) {
	if (!display) continue;

	const armourGroup = ARMOUR_STAT_GROUPS.findIndex(group => group.includes(+stat));
	if (armourGroup !== -1) display.group = armourGroup;
}

class ItemStat extends Component<HTMLElement, [ICustomStatDisplayDefinition]> {

	public stat!: ICustomStatDisplayDefinition;
	public groupLabel?: Component;
	public label!: Component;
	public bar?: Component;
	public intrinsicBar?: Component;
	public masterworkBar?: Component;
	public modBar?: Component;
	public combinedText!: Component;
	public intrinsicText!: Component;
	public masterworkText!: Component;
	public modText!: Component;
	public formulaText!: Component;

	protected override onMake (stat: ICustomStatDisplayDefinition) {
		this.stat = stat;

		const statName = Stat[this.stat.hash]
			?? CustomStat[this.stat.hash]
			?? this.stat.name
			?? this.stat.definition?.displayProperties.name.replace(/\s+/g, "")
			?? `${this.stat.hash}`;

		this.groupLabel = stat.group === undefined ? undefined : Component.create()
			.text.set(`${stat.group + 1}`)
			.classes.add(ItemStatClasses.GroupLabel)
			.appendTo(this);

		this.label = Component.create()
			.classes.add(ItemStatClasses.Label)
			.appendTo(this);

		if (this.stat?.bar)
			this.bar = Component.create()
				.classes.add(ItemStatClasses.Bar, `${ItemStatClasses.Bar}-${(statName).toLowerCase()}`)
				.append(this.intrinsicBar = Component.create()
					.classes.add(ItemStatClasses.BarBlock, ItemStatClasses.Intrinsic))
				.append(this.masterworkBar = Component.create()
					.classes.add(ItemStatClasses.BarBlock, ItemStatClasses.Masterwork))
				.append(this.modBar = Component.create()
					.classes.add(ItemStatClasses.BarBlock, ItemStatClasses.Mod))
				.appendTo(this);

		Component.create()
			.classes.add(ItemStatClasses.Value)
			.append(this.combinedText = Component.create()
				.classes.add(ItemStatClasses.Combined))
			.append(this.intrinsicText = Component.create()
				.classes.add(ItemStatClasses.ValueComponent, ItemStatClasses.Intrinsic))
			.append(this.masterworkText = Component.create()
				.classes.add(ItemStatClasses.ValueComponent, ItemStatClasses.Masterwork))
			.append(this.modText = Component.create()
				.classes.add(ItemStatClasses.ValueComponent, ItemStatClasses.Mod))
			.append(this.formulaText = Component.create()
				.classes.add(ItemStatClasses.ValueComponent, ItemStatClasses.Formula))
			.appendTo(this);

		this.classes.add(ItemStatClasses.Main, `${ItemStatClasses.Main}-${(statName).toLowerCase()}`);

		this.label.text.set(this.stat?.name ?? this.stat.definition?.displayProperties.name ?? "Unknown Stat");

		const icon = this.stat.definition?.displayProperties.icon;
		if (icon)
			this.label.style.set("--icon", `url("${icon}")`);
	}

	public set (display: ICustomStatDisplayDefinition, item: Item) {
		this.stat = display;

		if (display?.calculate) {
			const calculatedDisplay = display.calculate(item, display);
			if (!calculatedDisplay) {
				this.classes.add(Classes.Hidden);
				return false;
			}

			display = { ...display, ...calculatedDisplay };
		}

		this.classes.remove(Classes.Hidden);

		if (display.group !== undefined && this.groupLabel) {
			const distribution = IStatDistribution.get(item);
			if (distribution.overall) {
				this.groupLabel.style.set("--value", `${distribution.groups[display.group]}`);
			}
		}

		this.label.classes.toggle(!!display.masterwork && (item.definition.itemCategoryHashes?.includes(ItemCategoryHashes.Weapon) ?? false), ItemStatClasses.LabelMasterwork);

		if (display.intrinsic === undefined && display.masterwork === undefined && display.mod === undefined && display.renderFormula === undefined) {
			const render = this.render(display, display.value, true);
			this.combinedText.text.set(display.combinedText ?? render?.text);
			this.intrinsicText.text.set(render?.text);
			if (display.bar && display.max) {
				const value = (render?.value ?? 0) / display.max;
				this.intrinsicBar!.style.set("--value", `${value}`)
					.classes.toggle((render?.value ?? 0) < 0, ItemStatClasses.BarBlockNegative);
				this.bar!.style.set("--value", `${value}`);
			}
			return true;
		}

		let combinedValue = undefined;
		if (combinedValue === undefined) {
			combinedValue = display.combinedValue ?? (display.intrinsic ?? 0) + (display.masterwork ?? 0) + (display.mod ?? 0);
			if (combinedValue < (display.min ?? -Infinity))
				combinedValue = display.min!;

			if (combinedValue > (display.max ?? Infinity))
				combinedValue = display.max!;
		}

		let render = this.render(display, combinedValue, true);
		this.combinedText.style.set("--value", `${render?.value ?? 0}`)
			.text.set(display.combinedText ?? render?.text);

		if (display.bar && display.max) {
			this.bar!.style.set("--value", `${(render?.value ?? 0) / display.max}`)
				.tweak(display.renderBar, item, render?.value ?? 0);
		}

		render = this.render(display, display.intrinsic, true);
		this.intrinsicText.text.set(render?.text);
		if (display.bar && display.max)
			this.intrinsicBar!.style.set("--value", `${(render?.value ?? 0) / display.max}`);

		render = this.render(display, display.masterwork, !render);
		this.masterworkText.text.set(render?.text)
			.classes.toggle(!render?.value && !display.displayEntireFormula, Classes.Hidden);
		if (display.bar && display.max)
			this.masterworkBar!.style.set("--value", `${(render?.value ?? 0) / display.max}`);

		render = this.render(display, display.mod, !render);
		this.modText.text.set(render?.text)
			.classes.toggle((render?.value ?? 0) < 0, ItemStatClasses.ValueComponentNegative)
			.classes.toggle(!render?.value && !display.displayEntireFormula, Classes.Hidden);
		if (display.bar && display.max)
			this.modBar!.style.set("--value", `${(render?.value ?? 0) / display.max}`)
				.classes.toggle((render?.value ?? 0) < 0, ItemStatClasses.BarBlockNegative);

		this.formulaText.classes.toggle(!display.renderFormula, Classes.Hidden)
			.removeContents()
			.append(...display.renderFormula?.(item, display) ?? []);

		return true;
	}

	private render (display: ICustomStatDisplayDefinition, value: number | undefined, first: boolean): { text: string; value: number } | undefined {
		if (value === undefined)
			return undefined;

		return {
			value,
			text: (!first || display.plus) && value >= 0 ? `+${value}` : `${value}`,
		};
	}
}

namespace ItemStat {
	export class Wrapper extends Component {
		public map!: Record<number, ItemStat>;

		protected override onMake (): void {
			this.map = {};

			this.classes.add(ItemStatClasses.Wrapper)
		}

		public setItem (item: Item) {
			let hasAnyVisible = false;
			const stats = (Object.values(item.stats?.values ?? {}) as ICustomStatDisplayDefinition[])
				.concat(Object.values(customStats));

			while (true) {
				let sorted = false;
				NextStat: for (const stat of stats) {
					if (typeof stat.order !== "number") {
						const searchHash = stat.order.after ?? stat.order.before;
						for (const pivotStat of stats) {
							if (pivotStat.hash === searchHash) {
								if (typeof pivotStat.order !== "number")
									// can't pivot on this stat yet, it doesn't have its own order fixed
									continue NextStat;

								stat.order = pivotStat.order + 0.01;
								sorted = true;
							}
						}
					}
				}

				if (!sorted)
					break;
			}

			stats.sort((a, b) => (a.order as number) - (b.order as number));

			const renderedGroups = new Set<number | undefined>();
			const statDisplays: Record<number, ICustomStatDisplayDefinition | undefined> = {};
			for (const stat of stats) {
				const custom = customStatDisplays[stat.hash as Stat];
				if (custom === false || custom?.render?.(item, stat, stats) === false)
					continue;

				const display = {
					...stat,
					...custom,
				};
				const component = (this.map[stat.hash] ??= ItemStat.create([display])).appendTo(this);
				const isVisible = component.set(display, item);
				hasAnyVisible ||= isVisible;
				if (isVisible)
					statDisplays[stat.hash] = display;

				component.groupLabel?.classes.toggle(renderedGroups.has(custom?.group), Classes.Hidden);
				renderedGroups.add(custom?.group);
			}

			for (const stat of Object.keys(this.map))
				this.map[+stat].classes.toggle(!statDisplays[+stat], Classes.Hidden);

			this.classes.toggle(!hasAnyVisible, Classes.Hidden);
			return hasAnyVisible;
		}
	}
}

export default ItemStat;
