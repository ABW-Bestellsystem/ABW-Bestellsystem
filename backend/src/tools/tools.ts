import { randomBytes } from "crypto";
import https from "https"

export function generateNewEditorKey(): any {
	return randomBytes(128).toString("hex");
}

export function permissionIDTranslator(ID: string, config: any) {
	switch (ID) {
		case config().PERMISSON_ADMIN:
			return "Admin";
		case config().PERMISSON_USER:
			return "User";
		case config().PERMISSON_EDITOR:
			return "Editor";
		default:
			return "";
	}
}

export async function getLatestRelease() {
	const LatestRelase = (await fetch('https://github.com/ABW-Bestellsystem/ABW-Bestellsystem/releases/latest')).url.split("/");

	return LatestRelase[LatestRelase.length - 1]
}