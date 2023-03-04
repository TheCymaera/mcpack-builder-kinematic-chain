import { promises as fs } from "node:fs";

export async function emptyFolder(folder: string) {
	try {
		await fs.rmdir(folder, { recursive: true });
	} catch {
		// do nothing
	}
}

export function writeFiles(folder: string, files: Iterable<[string, string]>) {
	const promises: Promise<unknown>[] = [];
	for (const [path, text] of files) {
		const fullPath = folder + "/" + path;

		const dir = fullPath.split("/").slice(0, -1).join("/");

		promises.push(
			(dir ? fs.mkdir(dir, { recursive: true }) : Promise.resolve())
			.then(()=>fs.writeFile(fullPath.toString(), text))
		);
	}

	return Promise.all(promises);
}