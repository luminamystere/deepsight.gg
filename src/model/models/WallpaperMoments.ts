import Model from "model/Model";
import Manifest from "model/models/Manifest";
import type { DeepsightMomentDefinition } from "utility/endpoint/deepsight/endpoint/GetDeepsightMomentDefinition";

export interface IWallpaperMoment {
	wallpapers: string[];
	moment: DeepsightMomentDefinition;
}

export default Model.createDynamic("Daily", async _ => Manifest.await()
	.then(async manifest => {
		const wallpaperMomentsRaw = await manifest.DeepsightWallpaperDefinition.all();
		const moments = await manifest.DeepsightMomentDefinition.all();

		return wallpaperMomentsRaw.map((wallpaperMoment): IWallpaperMoment => ({
			wallpapers: wallpaperMoment.data,
			moment: moments.find(moment => wallpaperMoment.hash === moment.hash)!,
		}))
			.sort((a, b) => +(a.moment?.hash || 0) - +(b.moment?.hash || 0));
	}));

export async function createWallpaperThumbnail (wallpaper: string) {
	const image = new Image();
	image.src = wallpaper;
	await new Promise(resolve => image.onload = resolve);

	const canvas = document.createElement("canvas");
	canvas.width = 144;
	canvas.height = 81;
	const context = canvas.getContext("2d")!;
	context.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);
	return canvas;
}
