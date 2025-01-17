import View from "ui/View";
import SettingsBackground from "ui/view/settings/SettingsBackground";
import SettingsDeviceStorage from "ui/view/settings/SettingsDeviceStorage";
import SettingsInventoryDisplay from "ui/view/settings/SettingsInventoryDisplay";
import SettingsItemMovement from "ui/view/settings/SettingsItemMovement";

export default View.create({
	id: "settings",
	name: "Settings",
	initialiseDestinationButton: button =>
		button.text.remove(),
	initialise: view => view
		.setTitle(title => title.text.set("Settings"))
		.tweak(view => view.content
			.append(SettingsInventoryDisplay.create())
			.append(SettingsItemMovement.create())
			.append(SettingsBackground.create())
			.append(SettingsDeviceStorage.create())),
});
