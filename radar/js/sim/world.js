/**
 * The game's world wrapper around the ported skysim engine (see
 * ../engine/). Ownship and every "air" contact are real point-mass bodies
 * flying the engine's Mode.HEADING autopilot (thrust, drag, lift, gravity,
 * RK4) - not the old fixed-heading kinematic drift. Ground/sea contacts
 * stay simple data: they don't fly, so the airspace engine has nothing to
 * offer them (a stationary ground vehicle isn't a flight-dynamics problem),
 * and spawning them as engine bodies would just trip its own ground-contact
 * handling (anything at z<=0 gets landed/destroyed on the first tick).
 */
import { World as EngineWorld } from '../engine/world.js';
import { Command, Mode, headingVector } from '../engine/bodies.js';
import { Vec3 } from '../engine/vec.js';
import { atmosphere } from '../engine/physics.js';
import * as profiles from '../engine/profiles.js';
import { wrapDeg, DEG, RAD, makeRng } from '../core/rng.js';
import { TARGETS, BOGEYS, OWNSHIP } from '../../content/targets.js';

const KM = 1000;
const ENGINE_DT = 0.02;   // fixed sub-step the ported engine's autopilot gains are tuned for

function machToMps(mach, altM) { return mach * atmosphere(altM)[2]; }

/** Builds the live world: ownship + every contact, in metres, east/north. */
export function buildWorld() {
  const rng = makeRng(77331);
  const engine = new EngineWorld({ dt: ENGINE_DT, collisions: false, separationM: 0 });

  const ownSpeed = machToMps(OWNSHIP.mach, OWNSHIP.altM);
  const ownBody = engine.spawn(
    profiles.get('fighter'),
    new Vec3(0, 0, OWNSHIP.altM),
    headingVector(OWNSHIP.headingDeg).scale(ownSpeed),
    { name: 'ownship', command: new Command({
      mode: Mode.HEADING, headingDeg: OWNSHIP.headingDeg, altitudeM: OWNSHIP.altM, speedMps: ownSpeed,
    }) },
  );

  const own = { x: 0, y: 0, altM: OWNSHIP.altM, headingDeg: OWNSHIP.headingDeg, mach: OWNSHIP.mach, speedMps: ownSpeed };

  const contacts = [];
  for (const t of TARGETS) { contacts.push(makeContact(t, false, engine)); }
  for (const t of BOGEYS) { contacts.push(makeContact(t, true, engine)); }

  return { own, ownBody, contacts, rng, time: 0, engine };
}

function makeContact(def, decorative, engine) {
  const c = {
    id: def.id, name: def.name, kind: def.kind, decorative,
    href: def.href || null, locked: def.locked || null,
    accent: def.accent || '#2dff6a', dossier: def.dossier || null,
    x: def.x * KM, y: def.y * KM, altM: def.altM || 0,
    home: { x: def.x * KM, y: def.y * KM },
    alive: true,
    // Bumped on any discontinuous jump (behind-respawn, far-side wrap) so a
    // radar lock can tell "the target moved" apart from "the target teleported".
    warpGen: 0,
  };
  if (c.kind === 'air') {
    c.headingDeg = def.headingDeg;
    c.mach = def.mach;
    const speed = machToMps(def.mach, c.altM);
    c.engineBody = engine.spawn(
      profiles.get('fighter'),
      new Vec3(c.x, c.y, c.altM),
      headingVector(def.headingDeg).scale(speed),
      { name: def.id, command: new Command({
        mode: Mode.HEADING, headingDeg: def.headingDeg, altitudeM: c.altM, speedMps: speed,
      }) },
    );
  }
  if (c.kind === 'ground_mover') {
    c.wanderPhase = Math.random() * Math.PI * 2;
  }
  return c;
}

const AREA_KM = 160;   // air contacts beyond this respawn on the far side

// Ownship only ever flies straight ahead, so anything stationary eventually
// falls behind it and can never be seen or reached again. To keep at least
// one target of every kind available at all times, a stationary contact
// that falls this far behind gets teleported back out ahead instead.
const BEHIND_MARGIN_M = 4000;
const RESPAWN_MIN_M = 18000, RESPAWN_MAX_M = 55000, CROSSRANGE_HALF_M = 38000;

function respawnAhead(world, c) {
  const own = world.own;
  const x = own.x + (world.rng() * 2 - 1) * CROSSRANGE_HALF_M;
  const y = own.y + RESPAWN_MIN_M + world.rng() * (RESPAWN_MAX_M - RESPAWN_MIN_M);
  c.x = x; c.y = y;
  c.home.x = x; c.home.y = y;
  c.warpGen = (c.warpGen || 0) + 1;
  if (c.kind === 'ground_mover') { c.wanderPhase = world.rng() * Math.PI * 2; }
  if (c.kind === 'air' && c.engineBody) {
    const speed = machToMps(c.mach, c.altM);
    c.engineBody.position = new Vec3(x, y, c.altM);
    c.engineBody.velocity = headingVector(c.headingDeg).scale(speed);
  }
}

/** Advance ownship and every contact by dt seconds. */
export function tickWorld(world, dt) {
  world.time += dt;

  // The engine integrates ownship and every air contact together (thrust,
  // drag, lift, gravity, RK4) - one physics step for the whole airspace.
  world.engine.step(dt);

  const ob = world.ownBody;
  const own = world.own;
  own.x = ob.position.x; own.y = ob.position.y; own.altM = ob.position.z;
  own.headingDeg = ob.headingDeg(); own.mach = ob.mach; own.speedMps = ob.speedMps;

  for (const c of world.contacts) {
    if (!c.alive) {
      // Decorative contacts (no href) have nowhere to navigate to on a
      // kill, so bring them back rather than leaving their kind short a
      // target forever.
      if (c.href) { continue; }
      c.alive = true;
      respawnAhead(world, c);
      continue;
    }
    if (c.kind === 'air') {
      const body = c.engineBody;
      c.x = body.position.x; c.y = body.position.y; c.altM = body.position.z;
      c.headingDeg = body.headingDeg(); c.mach = body.mach;
      // Re-spawn on the far side of the operating area rather than fly away
      // forever, so a practice contact keeps coming back around.
      const dx = c.x - own.x, dy = c.y - own.y;
      if (Math.hypot(dx, dy) > AREA_KM * KM) {
        const back = Math.atan2(-dx, -dy);
        const nx = own.x + Math.sin(back) * AREA_KM * KM * 0.85;
        const ny = own.y + Math.cos(back) * AREA_KM * KM * 0.85;
        const speed = machToMps(c.mach, c.altM);
        body.position = new Vec3(nx, ny, c.altM);
        body.velocity = headingVector(c.headingDeg).scale(speed);
        c.x = nx; c.y = ny;
        c.warpGen = (c.warpGen || 0) + 1;
      }
    } else if (c.kind === 'ground_mover') {
      if (own.y - c.home.y > BEHIND_MARGIN_M) { respawnAhead(world, c); }
      // Stays put on the map, but a slow leashed wander sells "moving
      // column" up close without ever leaving its GMTI footprint.
      c.wanderPhase += dt * 0.15;
      c.x = c.home.x + Math.sin(c.wanderPhase) * 260;
      c.y = c.home.y + Math.cos(c.wanderPhase * 0.7) * 180;
    } else {
      // ground_fixed / sea: fully stationary, so the same "fell behind"
      // check applies directly to its own position.
      if (own.y - c.y > BEHIND_MARGIN_M) { respawnAhead(world, c); }
    }
  }
}

/**
 * Floor for a missile's "phantom" target stand-in (see missile.js and
 * intercept.js) - without this, a target genuinely at ground level (z=0,
 * every ground/sea contact) would trip the engine's own ground-contact
 * check on the phantom's very first ballistic sub-step and get marked
 * destroyed, well before any real intercept geometry matters, silently
 * breaking guidance against anything but an airborne target. A couple of
 * metres of clearance is invisible next to the 45m fuze radius.
 */
export const PHANTOM_ALT_FLOOR_M = 2.0;

/**
 * Constant-velocity estimate of a contact's current motion, in m/s (engine
 * Vec3). Air contacts fly a held heading/mach; everything else (including a
 * ground_mover's leashed wander) is treated as stationary - the wander has
 * no net drift, so zero is the right forecast for it. Used to feed a
 * missile's phantom target (missileEngine.js) and the intercept-cue forecast.
 */
export function contactVelocityVec(c) {
  if (c.kind === 'air') {
    return headingVector(c.headingDeg).scale(machToMps(c.mach, c.altM));
  }
  return new Vec3();
}

/**
 * A missile's launch velocity, boresight-locked onto the target's current
 * bearing and elevation (both azimuth and depression angle) rather than
 * just inheriting the ownship's own level flight heading - the seeker/
 * computer has already got a fix on the target at the moment of release,
 * same convention as any BVR launch. Speed is carried over from the
 * ownship (the round leaves the rail already moving with the launch
 * platform). This matters most for a steep shot at a surface target far
 * below cruise altitude: without it, the round would have to claw its way
 * from level flight to a near-vertical dive using only the autopilot's
 * rate-limited pitch response, most of the flight.
 */
export function boresightVelocity(own, target) {
  const rel = relativeTo(own, target);
  const hRad = (own.headingDeg + rel.az) * DEG, pRad = rel.el * DEG;
  return new Vec3(
    Math.sin(hRad) * Math.cos(pRad) * own.speedMps,
    Math.cos(hRad) * Math.cos(pRad) * own.speedMps,
    Math.sin(pRad) * own.speedMps,
  );
}

/**
 * Range (km), relative azimuth (deg, +right of nose) and relative elevation
 * (deg, +above) of a contact from the ownship's current position/heading.
 */
export function relativeTo(own, c) {
  const dx = c.x - own.x, dy = c.y - own.y;
  const rangeKm = Math.hypot(dx, dy) / KM;
  const bearing = Math.atan2(dx, dy) * RAD;
  const az = wrapDeg(bearing - own.headingDeg);
  const el = Math.atan2(c.altM - own.altM, Math.hypot(dx, dy)) * RAD;
  return { rangeKm, az, el };
}

export { KM };
