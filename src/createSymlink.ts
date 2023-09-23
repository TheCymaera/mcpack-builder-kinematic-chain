import { createSymlink, realPath } from "./fileUtilities.ts";

const file = await realPath("pack");
const output = "pack-symlink";

await createSymlink(file, output)
.then(()=>console.log("Symlink created! Drag it into your world/datapacks folder."))
.catch((e)=>console.error("Failed to create symlink", e))