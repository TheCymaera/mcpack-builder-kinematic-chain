// @ts-expect-error No types installed
import fs from "node:fs/promises";

export async function emptyFolder(folder: string) {
	try {
		await fs.stat(folder);
	} catch {
		return;
	}

	const promises: Promise<unknown>[] = [];
	for await (const file of await fs.readdir(folder, { withFileTypes: true })) {
		promises.push(fs.rm(folder + "/" + file.name, { recursive: true }));
	}
	
	await Promise.all(promises);
}

export function writeFiles(folder: string, files: Iterable<[string, string]>) {
	const promises: Promise<unknown>[] = [];
	for (const [path, text] of files) {
		const fullPath = folder + "/" + path;

		const dir = fullPath.split("/").slice(0, -1).join("/");

		promises.push(
			(dir ? fs.mkdir(dir, { recursive: true }) : Promise.resolve())
			.then(()=>fs.writeFile(fullPath, text))
		);
	}

	return Promise.all(promises);
}

export async function createSymlink(realPath: string, symlinkPath: string) {
	return fs.symlink(realPath, symlinkPath, "dir");
}

export async function realPath(path: string) {
	return fs.realpath(path);
}