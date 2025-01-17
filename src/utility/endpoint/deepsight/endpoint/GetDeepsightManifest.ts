import type { DeepsightDropTableDefinition } from "utility/endpoint/deepsight/endpoint/GetDeepsightDropTableDefinition";
import GetDeepsightDropTableDefinition from "utility/endpoint/deepsight/endpoint/GetDeepsightDropTableDefinition";
import type { DeepsightMomentDefinition } from "utility/endpoint/deepsight/endpoint/GetDeepsightMomentDefinition";
import GetDeepsightMomentDefinition from "utility/endpoint/deepsight/endpoint/GetDeepsightMomentDefinition";
import type { DeepsightWallpaperDefinition } from "utility/endpoint/deepsight/endpoint/GetDeepsightWallpaperDefinition";
import GetDeepsightWallpaperDefinition from "utility/endpoint/deepsight/endpoint/GetDeepsightWallpaperDefinition";
import Endpoint from "utility/endpoint/Endpoint";

export interface AllDeepsightManifestComponents {
	DeepsightMomentDefinition: Record<number, DeepsightMomentDefinition>;
	DeepsightWallpaperDefinition: Record<number, DeepsightWallpaperDefinition>;
	DeepsightDropTableDefinition: Record<number, DeepsightDropTableDefinition>;
}

export default (new class extends Endpoint<AllDeepsightManifestComponents> {
	public constructor () {
		super("");
	}

	public override async query (): Promise<AllDeepsightManifestComponents & { _headers: Headers }> {
		const result = {
			DeepsightMomentDefinition: await GetDeepsightMomentDefinition.query(),
			DeepsightWallpaperDefinition: await GetDeepsightWallpaperDefinition.query(),
			DeepsightDropTableDefinition: await GetDeepsightDropTableDefinition.query(),
		} as AllDeepsightManifestComponents as AllDeepsightManifestComponents & { _headers: Headers };

		Object.defineProperty(result, "_headers", {
			enumerable: false,
			get: () => new Headers(),
		});
		return result;
	}
})
