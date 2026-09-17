import { machToMps } from '../core/atmos.js';
import { wrapDeg, DEG, RAD, makeRng } from '../core/rng.js';
import { TARGETS, BOGEYS, OWNSHIP } from '../../content/targets.js';

const KM = 1000;

/** Builds the live world: ownship + every contact, in metres, east/north. */
export function buildWorld() {
  const rng = makeRng(77331);
  const own = {
    x: 0, y: 0, altM: OWNSHIP.altM, headingDeg: OWNSHIP.headingDeg,
    mach: OWNSHIP.mach,
    get speedMps() { return machToMps(this.mach, this.altM); },
  };

  const contacts = [];
  for (const t of TARGETS) { contacts.push(makeContact(t, false)); }
  for (const t of BOGEYS) { contacts.push(makeContact(t, true)); }

  const world = { own, contacts, rng, time: 0 };
  return world;
}

function makeContact(def, decorative) {
  const c = {
    id: def.id, name: def.name, kind: def.kind, decorative,
    href: def.href || null, locked: def.locked || null,
    accent: def.accent || '#2dff6a', dossier: def.dossier || null,
    x: def.x * KM, y: def.y * KM, altM: def.altM || 0,
    home: { x: def.x * KM, y: def.y * KM },
    alive: true,
  };
  if (c.kind === 'air') {
    c.headingDeg = def.headingDeg;
    c.mach = def.mach;
  }
  if (c.kind === 'ground_mover') {
    c.wanderPhase = Math.random() * Math.PI * 2;
  }
  return c;
}

const AREA_KM = 160;   // contacts beyond this respawn on the far side

/** Advance ownship and every contact by dt seconds. */
export function tickWorld(world, dt) {
  world.time += dt;
  const own = world.own;
  const hdg = own.headingDeg * DEG;
  own.x += Math.sin(hdg) * own.speedMps * dt;
  own.y += Math.cos(hdg) * own.speedMps * dt;

  for (const c of world.contacts) {
    if (!c.alive) { continue; }
    if (c.kind === 'air') {
      const spd = machToMps(c.mach, c.altM);
      const h = c.headingDeg * DEG;
      c.x += Math.sin(h) * spd * dt;
      c.y += Math.cos(h) * spd * dt;
      // Re-spawn on the far side of the operating area rather than fly away
      // forever, so a practice contact keeps coming back around.
      const dx = c.x - own.x, dy = c.y - own.y;
      if (Math.hypot(dx, dy) > AREA_KM * KM) {
        const back = Math.atan2(-dx, -dy);
        c.x = own.x + Math.sin(back) * AREA_KM * KM * 0.85;
        c.y = own.y + Math.cos(back) * AREA_KM * KM * 0.85;
      }
    } else if (c.kind === 'ground_mover') {
      // Stays put on the map, but a slow leashed wander sells "moving
      // column" up close without ever leaving its GMTI footprint.
      c.wanderPhase += dt * 0.15;
      c.x = c.home.x + Math.sin(c.wanderPhase) * 260;
      c.y = c.home.y + Math.cos(c.wanderPhase * 0.7) * 180;
    }
  }
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
