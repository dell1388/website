/**
 * The simulation world: fixed-step RK4 over up to 32 objects. A port of
 * skysim/world.py - one flat block of airspace, every object a point mass
 * obeying the same force model. Step it, read the state, repeat.
 */
import * as control from './control.js';
import * as physics from './physics.js';
import * as profiles from './profiles.js';
import { Body, Command, MAX_OBJECTS, Mode, Status } from './bodies.js';
import { UP, Vec3 } from './vec.js';

export const DEFAULT_DT = 0.02;
export const DEFAULT_CEILING_M = 60000.0;
export const DEFAULT_EXTENT_M = 200000.0;
export const SURVIVABLE_TOUCHDOWN_MPS = 12.0;
export const MAX_EVENTS = 4096;

export class WorldFull extends Error {}

export class Bounds {
  constructor({ xMin = -DEFAULT_EXTENT_M, xMax = DEFAULT_EXTENT_M, yMin = -DEFAULT_EXTENT_M,
                yMax = DEFAULT_EXTENT_M, ceilingM = DEFAULT_CEILING_M } = {}) {
    this.xMin = xMin; this.xMax = xMax; this.yMin = yMin; this.yMax = yMax; this.ceilingM = ceilingM;
  }
  contains(p) {
    return p.x >= this.xMin && p.x <= this.xMax
        && p.y >= this.yMin && p.y <= this.yMax
        && p.z <= this.ceilingM;
  }
}

export class World {
  constructor({
    dt = DEFAULT_DT, bounds = null, wind = new Vec3(), separationM = 1000.0,
    collisions = true, gravityFalloff = true,
  } = {}) {
    this.dt = dt;
    this.timeS = 0.0;
    this.bounds = bounds || new Bounds();
    this.wind = wind;
    this.separationM = separationM;
    this.collisions = collisions;
    this.gravityFalloff = gravityFalloff;
    this.bodies = new Map();          // id -> Body
    this.events = [];
    this._conflicts = new Set();      // "minId:maxId"
  }

  // -- population ---------------------------------------------------------

  spawn(profile, position, velocity = new Vec3(), { name = '', label = '', command = null, fuelKg = null } = {}) {
    if (this.bodies.size >= MAX_OBJECTS) { throw new WorldFull(`world already holds ${MAX_OBJECTS} objects`); }
    const prof = typeof profile === 'string' ? profiles.get(profile) : profile;
    const body = new Body({
      profile: prof, position, velocity, name, label,
      command: command || new Command(), fuelKg: fuelKg == null ? -1.0 : fuelKg,
    });
    this.bodies.set(body.id, body);
    this._emit('spawn', { id: body.id, name: body.name, profile: prof.name, object_kind: prof.kind });
    return body;
  }

  remove(bodyId) {
    const gone = this.bodies.get(bodyId);
    if (gone) {
      this.bodies.delete(bodyId);
      this._conflicts = new Set([...this._conflicts].filter((k) => !k.split(':').map(Number).includes(bodyId)));
      this._emit('removed', { id: bodyId, name: gone.name });
    }
    return !!gone;
  }

  get(bodyId) { return this.bodies.get(bodyId) || null; }

  setCommand(bodyId, command) {
    const body = this.bodies.get(bodyId);
    if (!body) { throw new Error(`no object ${bodyId}`); }
    body.command = command;
    this._emit('command', { id: bodyId, mode: command.mode });
    return body;
  }

  /**
   * Release a search-and-rescue drone from a carrier aircraft. The drone
   * inherits the carrier's position and velocity, then flies Mode.PURSUE
   * toward the designated aircraft to attach a locator beacon - see
   * _checkCaptures.
   */
  releaseSarDrone(carrierId, targetId, profile = 'sar_drone', name = '') {
    const carrier = this.bodies.get(carrierId);
    const target = this.bodies.get(targetId);
    if (!carrier || !carrier.active) { throw new Error(`carrier ${carrierId} not available`); }
    if (!target || !target.active) { throw new Error(`target ${targetId} not available`); }
    const prof = typeof profile === 'string' ? profiles.get(profile) : profile;
    if (prof.captureRadiusM <= 0.0) {
      throw new Error(`profile ${prof.name} cannot attach a beacon (captureRadiusM is 0)`);
    }
    const clearance = carrier.profile.radiusM + prof.radiusM + 20.0;
    const offset = (carrier.velocity.mag > 1e-6 ? carrier.velocity.unit().scale(-clearance) : new Vec3())
      .add(UP.scale(-0.25 * clearance));
    const drone = this.spawn(prof, carrier.position.add(offset), carrier.velocity, {
      name, command: new Command({ mode: Mode.PURSUE, targetId }),
    });
    this._emit('sar_drone_released', { id: drone.id, carrier_id: carrierId, target_id: targetId });
    return drone;
  }

  get active() { return [...this.bodies.values()].filter((b) => b.active); }
  /** Active objects still under their own control - excludes anything that
   *  has attached to and is now riding with another object. */
  get flying() { return [...this.bodies.values()].filter((b) => b.active && b.attachedTo == null); }
  get count() { return this.bodies.size; }
  get capacity() { return MAX_OBJECTS; }

  clear() {
    this.bodies.clear(); this.events.length = 0; this._conflicts.clear(); this.timeS = 0.0;
  }

  _emit(kind, data) {
    this.events.push({ t: this.timeS, kind, ...data });
    if (this.events.length > MAX_EVENTS) { this.events.splice(0, this.events.length - MAX_EVENTS); }
  }

  // -- forces ---------------------------------------------------------------

  _thrustMagnitude(body, throttle) {
    const p = body.profile;
    if (!profiles.isPowered(p) || throttle <= 0.0) { return 0.0; }
    if (p.fuelKg > 0.0 && body.fuelKg <= 0.0) { return 0.0; }
    return p.thrustN * throttle;
  }

  /** Net acceleration (m/s^2) from thrust, drag, lift, buoyancy, weight. */
  acceleration(body, pos, vel, demand) {
    const p = body.profile;
    const [density, , sound] = physics.atmosphere(pos.z);
    const airspeedVec = vel.sub(this.wind);
    const airspeed = airspeedVec.mag;
    const mach = physics.machNumber(airspeed, sound);
    const mass = Math.max(1e-6, body.massKg);

    let lift = new Vec3();
    let cl = 0.0;
    if (p.clMax > 0.0 && airspeed > 1e-3) {
      const want = demand.accel.clamp(p.maxG * physics.G0).perpTo(airspeedVec);
      if (want.mag > 1e-9) {
        cl = physics.liftCoefficientFor(want.mag, mass, density, airspeed, p.refAreaM2, p.clMax);
        lift = physics.liftForce(airspeedVec, density, cl, p.refAreaM2, want);
      }
    }

    const volume = physics.balloonVolume(body.volumeM3, p.expansionRatio, density);
    let area = p.refAreaM2;
    if (volume > 0.0 && p.volumeM3 > 0.0) { area *= Math.pow(volume / p.volumeM3, 2.0 / 3.0); }

    const cdi = physics.inducedDragCoefficient(cl, p.aspectRatio);
    const cd = physics.dragCoefficient(body.dragCd0, mach, cdi);
    const drag = physics.dragForce(airspeedVec, density, cd, area);

    let thrustDir;
    if (p.thrustMode === 'vector') { thrustDir = demand.thrustDir; }
    else if (airspeed > 1e-3) { thrustDir = airspeedVec.unit(); }
    else { thrustDir = demand.thrustDir; }
    const thrust = physics.thrustForce(thrustDir, this._thrustMagnitude(body, demand.throttle));

    const buoyancy = physics.buoyancyForce(volume, density, pos.z);
    const weight = physics.weightForce(mass, pos, this.gravityFalloff);

    return thrust.add(drag).add(lift).add(buoyancy).add(weight).scale(1 / mass);
  }

  // -- integration ------------------------------------------------------

  /** Classical RK4 on (position, velocity) with the tick's demand frozen. */
  _integrate(body, demand, dt) {
    const p0 = body.position, v0 = body.velocity;
    const a1 = this.acceleration(body, p0, v0, demand);

    const p2 = p0.add(v0.scale(dt / 2)), v2 = v0.add(a1.scale(dt / 2));
    const a2 = this.acceleration(body, p2, v2, demand);

    const p3 = p0.add(v2.scale(dt / 2)), v3 = v0.add(a2.scale(dt / 2));
    const a3 = this.acceleration(body, p3, v3, demand);

    const p4 = p0.add(v3.scale(dt)), v4 = v0.add(a3.scale(dt));
    const a4 = this.acceleration(body, p4, v4, demand);

    const pos = p0.add(v0.add(v2.scale(2)).add(v3.scale(2)).add(v4).scale(dt / 6));
    const vel = v0.add(a1.add(a2.scale(2)).add(a3.scale(2)).add(a4).scale(dt / 6));
    return [pos, vel];
  }

  // -- per-tick bookkeeping -----------------------------------------------

  _burnFuel(body, throttle, dt) {
    const p = body.profile;
    if (p.burnRateKgs <= 0.0 || throttle <= 0.0 || body.fuelKg <= 0.0) { return; }
    body.fuelKg = Math.max(0.0, body.fuelKg - p.burnRateKgs * throttle * dt);
    if (body.fuelKg === 0.0) { this._emit('fuel_exhausted', { id: body.id, name: body.name }); }
  }

  _postUpdate(body, prevVel, dt) {
    const p = body.profile;
    const [, , sound] = physics.atmosphere(body.altitudeM);

    if (body.speedMps > p.maxSpeedMps && p.maxSpeedMps > 0.0) {
      body.velocity = body.velocity.unit().scale(p.maxSpeedMps);
    }

    body.mach = physics.machNumber(body.velocity.sub(this.wind).mag, sound);
    if (dt > 0.0 && body.speedMps > 1e-6) {
      const dv = body.velocity.sub(prevVel).scale(1 / dt);
      body.loadFactorG = dv.perpTo(body.velocity).mag / physics.G0;
    }

    if (p.burstAltitudeM > 0.0 && !body.burst && body.altitudeM >= p.burstAltitudeM) {
      body.burst = true;
      this._emit('balloon_burst', { id: body.id, name: body.name, altitude_m: body.altitudeM });
    }
  }

  _checkLimits(body) {
    if (body.altitudeM <= 0.0) {
      const descent = -body.velocity.z;
      const gentle = descent <= SURVIVABLE_TOUCHDOWN_MPS && body.kind !== 'projectile';
      body.status = gentle ? Status.LANDED : Status.DESTROYED;
      body.position = new Vec3(body.position.x, body.position.y, 0.0);
      body.velocity = new Vec3();
      this._emit('ground_contact', { id: body.id, name: body.name, descent_rate_mps: descent, outcome: body.status });
      return;
    }
    if (!this.bounds.contains(body.position)) {
      body.status = Status.EXITED;
      this._emit('exited_volume', { id: body.id, name: body.name, position: body.position.toDict() });
    }
  }

  // -- separation and collisions -------------------------------------------

  /** Least distance between two objects over one tick's swept segments. */
  static _closestApproach(a0, a1, b0, b1) {
    const r0 = a0.sub(b0);
    const dr = a1.sub(b1).sub(r0);
    const denom = dr.mag2;
    if (denom < 1e-12) { return r0.mag; }
    const s = Math.max(0.0, Math.min(1.0, -r0.dot(dr) / denom));
    return r0.add(dr.scale(s)).mag;
  }

  _checkPairs(prev) {
    const live = this.flying;
    const seen = new Set();
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        if (!(a.active && b.active)) { continue; }
        const key = `${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}`;
        const miss = World._closestApproach(
          prev.get(a.id) || a.position, a.position, prev.get(b.id) || b.position, b.position);

        const hitRadius = a.profile.radiusM + b.profile.radiusM;
        if (this.collisions && miss <= hitRadius) {
          a.status = b.status = Status.DESTROYED;
          this._conflicts.delete(key);
          this._emit('collision', { ids: [a.id, b.id], names: [a.name, b.name], separation_m: miss });
          continue;
        }

        if (miss <= this.separationM) {
          seen.add(key);
          if (!this._conflicts.has(key)) {
            this._conflicts.add(key);
            this._emit('proximity_alert', { ids: [a.id, b.id], names: [a.name, b.name], separation_m: miss });
          }
        }
      }
    }
    for (const key of [...this._conflicts]) {
      if (!seen.has(key)) {
        this._conflicts.delete(key);
        this._emit('proximity_clear', { ids: key.split(':').map(Number) });
      }
    }
  }

  // -- search-and-rescue beacons --------------------------------------------

  /** Carry along any drone that attached in an earlier tick - it rides at
   *  its target's position and velocity until the target is no longer
   *  active, at which point it detaches and goes back to flying on its own. */
  _slaveAttached(dt) {
    for (const body of this.bodies.values()) {
      if (!body.active || body.attachedTo == null) { continue; }
      const target = this.bodies.get(body.attachedTo);
      if (!target || !target.active) {
        body.attachedTo = null;
        body.command = new Command({ mode: Mode.BALLISTIC });
        this._emit('beacon_detached', { id: body.id, name: body.name, reason: 'target_lost' });
        continue;
      }
      body.position = target.position;
      body.velocity = target.velocity;
      body.ageS += dt;
    }
  }

  /** Attach any PURSUE body that has closed to its capture radius. */
  _checkCaptures(prev) {
    for (const body of this.flying) {
      if (body.command.mode !== Mode.PURSUE || body.command.targetId == null) { continue; }
      if (body.profile.captureRadiusM <= 0.0) { continue; }
      const target = this.bodies.get(body.command.targetId);
      if (!target || !target.active) { continue; }
      const miss = World._closestApproach(
        prev.get(body.id) || body.position, body.position,
        prev.get(target.id) || target.position, target.position);
      if (miss <= body.profile.captureRadiusM) {
        body.attachedTo = target.id;
        body.position = target.position;
        body.velocity = target.velocity;
        this._emit('beacon_attached', {
          id: body.id, name: body.name, target_id: target.id, target_name: target.name,
          position: target.position.toDict(),
        });
      }
    }
  }

  // -- the step -----------------------------------------------------------

  step(dt = null) {
    const h = dt == null ? this.dt : dt;
    const prevPositions = new Map([...this.bodies.values()].map((b) => [b.id, b.position]));
    const flying = this.flying;

    const demands = new Map();
    for (const body of flying) {
      const target = body.command.targetId != null ? this.bodies.get(body.command.targetId) : null;
      demands.set(body.id, control.solve(body, target || null));
    }

    for (const body of flying) {
      const demand = demands.get(body.id);
      const prevVel = body.velocity;
      [body.position, body.velocity] = this._integrate(body, demand, h);
      body.ageS += h;
      body.throttle = demand.throttle;
      body.thrustDir = demand.thrustDir;
      body.accelCmd = demand.accel;
      this._burnFuel(body, demand.throttle, h);
      this._postUpdate(body, prevVel, h);
    }

    this._slaveAttached(h);
    this._checkCaptures(prevPositions);
    this._checkPairs(prevPositions);

    for (const body of this.active) { this._checkLimits(body); }

    this.timeS += h;
  }

  /** Step for `durationS` of sim time. Returns ticks executed. */
  run(durationS, dt = null) {
    const h = dt == null ? this.dt : dt;
    const ticks = Math.max(0, Math.round(durationS / h));
    for (let i = 0; i < ticks; i++) { this.step(h); }
    return ticks;
  }

  runUntilQuiet(maxTimeS = 600.0) {
    const end = this.timeS + maxTimeS;
    while (this.timeS < end && this.active.length) { this.step(); }
    return this.timeS;
  }

  // -- reporting ------------------------------------------------------------

  snapshot() {
    return {
      time_s: this.timeS, dt: this.dt, count: this.count, active: this.active.length,
      capacity: MAX_OBJECTS,
      objects: [...this.bodies.values()].map((b) => b.toDict()),
    };
  }

  drainEvents() {
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }
}
