import ansi from "ansicolor";
import * as fs from "fs-extra";
import * as https from "https";
import fetch from "node-fetch";
import type { DestinyManifest } from "../src/node_modules/bungie-api-ts/destiny2";
import Log from "./utilities/Log";
import Task from "./utilities/Task";

export default Task("manifest", async () => {
	if (process.env.FVM_ENVIRONMENT !== "dev")
		return;

	const manifest = await fetch("https://www.bungie.net/Platform/Destiny2/Manifest/")
		.then(response => response.json())
		.then(json => (json as { Response: DestinyManifest }).Response);

	const savedVersion = await fs.readFile("static/testiny.v", "utf8").catch(() => "<no saved manifest>");
	const bungieVersion = `${manifest.version}-1.fvm`;
	if (bungieVersion === savedVersion)
		return;

	Log.info(`Bungie API is serving a new version of the Destiny manifest.\n    Old version: ${ansi.lightYellow(savedVersion)}\n    New version: ${ansi.lightBlue(bungieVersion)}`);
	Log.info("Downloading manifest...");

	await new Promise(resolve => https.get(`https://www.bungie.net/${manifest.jsonWorldContentPaths.en}`, response => response
		.pipe(fs.createWriteStream("static/testiny.json"))
		.on("finish", resolve)));
	await fs.writeFile("static/testiny.v", bungieVersion);

	Log.info("Manifest download complete.");
});