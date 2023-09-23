import { Coordinate, Datapack, Namespace, Duration, ScoreboardTag, command, entities, execute, mcfunction, MCFunction, scheduler } from "mcpack-builder";
import { Vector3 } from "open-utilities/core/maths/Vector3.js";
import { emptyFolder, writeFiles } from "./fileUtilities.ts";

// output
const outputPath = "pack";
const datapack = new Datapack;

// config
const namespace = new Namespace("kinematic-chain");
const internalNamespace = namespace.id("zzz_internal");

const thicknesses = {
	"thin": 0.0,
	"mid": 0.1,
	"thick": 0.2,
	"thickest": 0.3,
}

const rootLocation = new Vector3(222.0, 51.0, -14.0);
const mouthLocation = new Vector3(220.0, 51.0, -13.0).add(new Vector3(.5, .9, .5));
const segmentLength = .5;
const carrotFollowSpeed = 5.0 / 20;
const moveSpeed = 3.0 / 20;
const chaseSpeed = 12.0 / 20;
const chaseDistance = 3.5;

class Segment {
	constructor(public id: string, public thickness: string, public rotation: number) {}

	selector() {
		return entities`@e`.hasScoreboardTag(this.id);
	}
}

const rotateAmount = .25;
let rotate = 0;
const segments = [
	new Segment("sTendril.seg1", "thickest", 0, ),
	new Segment("sTendril.seg2", "thickest", 0, ),
	new Segment("sTendril.seg3", "thick", 0, ),
	new Segment("sTendril.seg4", "thick", rotate -= rotateAmount),
	new Segment("sTendril.seg5", "thick", rotate -= rotateAmount),
	new Segment("sTendril.seg6", "mid", rotate -= rotateAmount),
	new Segment("sTendril.seg7", "mid", rotate -= rotateAmount),
	new Segment("sTendril.seg8", "mid", rotate += rotateAmount),
	new Segment("sTendril.seg9", "mid", rotate += rotateAmount),
	new Segment("sTendril.seg10", "mid", rotate += rotateAmount),
	new Segment("sTendril.seg11", "mid", rotate += rotateAmount),
	new Segment("sTendril.seg12", "thin", rotate += rotateAmount),
	new Segment("sTendril.seg13", "thin", rotate += rotateAmount),
	new Segment("sTendril.seg14", "thin", rotate += rotateAmount),
	new Segment("sTendril.seg15", "thin", rotate += rotateAmount),
	new Segment("sTendril.seg16", "thin", rotate += rotateAmount),
];

const tip = new Segment("sTendril.tip","",0);


datapack.packMeta = {
	pack: {
		pack_format: 7,
		description: "Kinematic Chain for Minecraft"
	},
};

const load = mcfunction(function * () {
	this.label = "load"
	yield command`kill @e[tag=sTendril]`;

	const location = rootLocation.clone();
	for (const segment of segments) {
		let rotX = segment.rotation * 180 / Math.PI - 90;
		const rotY = rotX < -90 ? 180 : 0;
		if (rotX < -90) rotX = -90 - (rotX + 90);

		yield command`
			summon minecraft:marker ${Coordinate.fromVector(location, true)} 
			{Tags:["sTendril","${segment.id}", "sTendril.${segment.thickness}"], Rotation:[${rotY}f,${rotX}f]}
		`;

		location.add(new Vector3(0,segmentLength,0).rotateX(segment.rotation))
	}
	
	yield command`
		summon minecraft:marker ${Coordinate.fromVector(location, true)} 
		{Tags:["sTendril","${tip.id}"]}
	`;
});

datapack.addOnLoadFunction(load);

datapack.addOnTickFunction(mcfunction(function * () {
	this.label = "dedupe";
	// due to chunk loading, there can be multiple copies of the chain when the world first loads.
	yield execute`as @e[tag=sTendril.tip] store result entity @s data.count byte 1 if entity @e[tag=sTendril.tip]`;
	yield execute`if entity @e[tag=sTendril.tip,nbt=!{data:{count:1b}}]`.runFunction(load);
}));

datapack.addOnTickFunction(mcfunction(function * () {
	this.label = "drawChain"
	 for (const [name, thickness] of Object.entries(thicknesses)) {
	 	for (let i = 0; i < segmentLength; i += .2) {
			const radius = thickness / 2;
			const bubbleAmount = Math.max(1, thickness * 20);

	 		yield command`
				execute at @e[tag=sTendril.${name}] run 
				particle minecraft:bubble ^ ^ ^${i} ${radius} ${radius} ${radius} 0 ${bubbleAmount}
			`;
	 	}
	 }
}));

const moveChain = mcfunction(function * () {
	this.label = "moveChain";
	// move each segment to target
	let target = tip;
	for (const segment of [...segments].reverse()) {
		yield command`
			execute 
			as @e[tag=${segment.id}] 
			at @s 
			facing entity @e[tag=${target.id}] feet positioned 
			as @e[tag=${target.id}] 
			run tp @s ^ ^ ^${-segmentLength} ~ ~
		`;

		target = segment;
	}

	// re-anchor chain
	yield command`tp @e[tag=${segments[0]!.id}] ${Coordinate.fromVector(rootLocation, true)}`;

	for (let i = 0; i < segments.length; i++) {
		const parent = segments[i]!;
		const segment = segments[i+1] ?? tip;
		yield command`
			execute 
			as @e[tag=${parent.id}] 
			at @s 
			facing entity @e[tag=${segment.id}] feet 
			positioned ^ ^ ^${segmentLength} 
			run tp @e[tag=${segment.id}] ~ ~ ~
		`;
	}
});

function *arc(targetId: string, lift: number) {
	for (let i = 1; i < 5; i++) {
		yield command`
			execute as @e[tag=${targetId}] at @s 
			if entity @e[tag=${tip.id},distance=${i}..] 
			run tp @s ~ ~${lift / 4} ~
		`;
	}
}

function *follow(
	targetId: string, 
	speed: number, 
	chaseDistance = speed, 
	chaseSpeed = speed, 
	onReach?: MCFunction
) {
	const name = targetId.replace("sTendril.", "");

	yield execute`as @e[tag=${tip.id}] at @s[tag=!sTendril.frozen]`.run( 
		mcfunction(function * () {
			this.label = "follow_" + name

			// move towards target
			yield command`
				execute facing entity @e[tag=${targetId},distance=${chaseDistance}..] eyes 
				run tp @s ^ ^ ^${speed}
			`;

			// play movement sound
			yield command`
				execute if entity @e[tag=${targetId},distance=${chaseDistance}..] 
				run playsound minecraft:block.honey_block.slide block @a ~ ~ ~ 1 .5
			`;
			
			if (chaseSpeed != speed) {
				yield command`execute facing entity @e[tag=${targetId},distance=${speed}..${chaseDistance}] eyes run tp @s ^ ^ ^${chaseSpeed}`;
			}
		}).run()
	);

	// reached target
	yield execute`
		as @e[tag=${targetId}] 
		at @s anchored eyes 
		if entity @e[tag=${tip.id},distance=..${chaseSpeed * 1.2}]
	`.runFunction(mcfunction(function *() {
			this.label = "reached_" + name
			yield command`tp @s ~ ~ ~`;
			if (onReach) yield onReach.run();
	}));
}

const frozenScoreboardTag = new ScoreboardTag("sTendril.frozen");

const freeze = frozenScoreboardTag.add(tip.selector());

const unfreeze = mcfunction(function * () {
	this.label = "unfreeze";
	yield frozenScoreboardTag.remove(tip.selector());
});

const playAcquireSound = mcfunction(function * () {
	this.label = "playAcquireSound";
	yield execute().at(tip.selector()).run(
		command`playsound minecraft:block.sculk_sensor.clicking block @a ~ ~ ~ 1 0`
	);
});

const playDigestSound = mcfunction(function * () {
	this.label = "playDigestSound";
	yield execute().at(tip.selector()).run(
		command`playsound minecraft:block.sculk_sensor.hit block @a ~ ~ ~ 1 0`
	);
});

const playHitSound = execute().at(tip.selector()).run(
	command`playsound minecraft:block.sculk_sensor.break block @a ~ ~ ~ 1 1`
);

const playBiteSound = execute().at(tip.selector()).run(
	command`playsound minecraft:block.sculk_sensor.break block @a ~ ~ ~ 3 0`
);

const playIdleSound = execute().at(tip.selector()).run(
	command`playsound minecraft:block.sculk_sensor.clicking_stop block @a ~ ~ ~ 1 0.1`
);

const scheduleIdleSound = mcfunction(function * () {
	this.label = "scheduleIdleSound";
	yield playIdleSound;
	yield scheduler.replace(Duration.seconds(4), this);
});

datapack.addOnLoadFunction(scheduleIdleSound);


datapack.addOnTickFunction(mcfunction(function*() {
	this.label = "locateChicken";
	// find a chicken target
	yield execute().at(tip.selector())
	.unless(
		entities`@e`.hasScoreboardTag("sTendril.chickenTarget").exists()
	)
	.unless(
		entities`@e`.hasScoreboardTag("sTendril.chickenHeld").exists()
	)
	.as(
		entities`@e[type=minecraft:chicken]`.sortNearest().limit(1)
	)
	.runFunction(mcfunction(function * () {
		this.label = "acquireChicken";
		yield command`tag @s add sTendril.chickenTarget`;
		yield freeze;
		yield scheduler.replace(Duration.ticks(30), unfreeze);
		yield scheduler.replace(Duration.ticks(20), playAcquireSound);
	}));


	yield * follow("sTendril.chickenTarget", moveSpeed, chaseDistance, chaseSpeed, mcfunction(function * () {
		// damage chicken
		yield command`effect give @e[tag=sTendril.chickenTarget] minecraft:resistance 1 100 true`;
		yield command`effect give @e[tag=sTendril.chickenTarget] minecraft:instant_damage 1 0 true`;
		yield playHitSound;

		// hold chicken
		yield command`tag @e[tag=sTendril.chickenTarget] add sTendril.chickenHeld`;
		
		// remove target
		yield command`tag @e[tag=sTendril.chickenTarget] remove sTendril.chickenTarget`;
		
		// freeze
		yield freeze;
		yield scheduler.replace(Duration.ticks(10), unfreeze);
	}));
}));




datapack.addOnTickFunction(mcfunction(function * () {
	this.label = "locateMouth";
	yield command`kill @e[tag=sTendril.mouthTarget]`;

	yield command`
		execute if entity @e[tag=sTendril.chickenHeld] run 
		summon minecraft:marker ${Coordinate.fromVector(mouthLocation, true)} 
		{Tags:["sTendril.mouthTarget"]}
	`;

	yield * arc("sTendril.mouthTarget", 3);
	yield * follow("sTendril.mouthTarget", moveSpeed, undefined, undefined, mcfunction(function * () {
		yield command`kill @e[tag=sTendril.chickenHeld]`;
		yield command`kill @e[type=minecraft:item,nbt={Item:{id:"minecraft:chicken"}}]`;
		yield playBiteSound;
		yield scheduler.replace(Duration.ticks(20), playDigestSound);
	}));

	// tp chicken to tip
	yield command`execute as @e[tag=${tip.id}] at @s run tp @e[tag=sTendril.chickenHeld] ~ ~-.6 ~`;
}));


datapack.addOnTickFunction(mcfunction(function * () {
	this.label = "locateCarrot";
	yield command`kill @e[tag=sTendril.carrotTarget]`;
	yield command`
		execute as @p[nbt={SelectedItem:{id:"minecraft:carrot_on_a_stick"}}] at @s run 
		summon minecraft:marker ^ ^1.5 ^3 {Tags:["sTendril.carrotTarget"]}
	`;

	yield * arc("sTendril.carrotTarget", 1);
	yield * follow("sTendril.carrotTarget", carrotFollowSpeed);

	yield moveChain.run();
}));




console.log("Writing files...");
await emptyFolder(outputPath);
await writeFiles(outputPath, datapack.build({
	internalNamespace
}).files);
console.log("Complete!");