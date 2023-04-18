export async function emptyFolder(folder: string) {
	try {
		await Deno.stat(folder);
	} catch {
		return;
	}


	const promises: Promise<unknown>[] = [];
	for await (const file of Deno.readDir(folder)) {
		promises.push(Deno.remove(folder + "/" + file.name, { recursive: true }));
	}
	
	await Promise.all(promises);
}

export function writeFiles(folder: string, files: Iterable<[string, string]>) {
	const promises: Promise<unknown>[] = [];
	for (const [path, text] of files) {
		const fullPath = folder + "/" + path;

		const dir = fullPath.split("/").slice(0, -1).join("/");

		promises.push(
			(dir ? Deno.mkdir(dir, { recursive: true }) : Promise.resolve())
			.then(()=>Deno.writeTextFile(fullPath, text))
		);
	}

	return Promise.all(promises);
}