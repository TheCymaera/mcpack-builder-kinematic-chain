import { resolve } from "node:path";
import { promises as fs } from "node:fs";

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

export function createSymlink(original: string, link: string) {
	return fs.symlink(original, link);
}

export function realPath(path: string) {
	return Promise.resolve(resolve(path));
}