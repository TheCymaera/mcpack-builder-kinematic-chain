import { createSymlink, realPath } from "./fileUtilities.ts";

const outputPath = "pack";
const symlinkPath = "pack-symlink";

console.log("Creating symlink at " + symlinkPath + "...");

await createSymlink(await realPath(outputPath), symlinkPath);

console.log(`Success!\nYou can now move the symlink into your "world/datapacks" folder.`)
