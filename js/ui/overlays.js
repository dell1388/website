const $ = (s) => document.querySelector(s);

/** Pause menu + the breach transition. There is no title screen: you start driving. */
export class Overlays {
  constructor(game) {
    this.game = game;
    this.pause = $('#pauseScreen');
    this.transition = $('#transition');
    this.transTitle = $('#transTitle');
    this.transSub = $('#transSub');
    this.leaving = false;

    const resume = $('#resumeBtn');
    if (resume) { resume.addEventListener('click', () => this.setPaused(false)); }
    document.querySelectorAll('[data-close-pause]').forEach((el) =>
      el.addEventListener('click', () => this.setPaused(false)));
  }

  setPaused(p) {
    if (this.leaving || !this.pause) { return; }
    this.game.paused = p;
    this.pause.classList.toggle('hidden', !p);
    this.game.registry.emit(p ? 'pause' : 'resume', null);
  }

  /** Full-screen breach animation, then navigate. */
  breach(target, done) {
    if (this.leaving) { return; }
    this.leaving = true;
    if (!this.transition) { done(); return; }
    if (this.transTitle) { this.transTitle.textContent = target.label; }
    if (this.transSub) { this.transSub.textContent = 'breaching…'; }
    this.transition.classList.add('show');
    setTimeout(() => {
      if (this.transSub) { this.transSub.textContent = 'entering'; }
      done();
    }, 1150);
  }
}
