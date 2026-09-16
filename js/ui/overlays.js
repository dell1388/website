const $ = (s) => document.querySelector(s);

export class Overlays {
  constructor(game) {
    this.game = game;
    this.title = $('#titleScreen');
    this.pause = $('#pauseScreen');
    this.transition = $('#transition');
    this.transTitle = $('#transTitle');
    this.transSub = $('#transSub');
    this.started = false;

    $('#startBtn').addEventListener('click', () => this.start());
    this.title.addEventListener('click', () => this.start());
    $('#resumeBtn').addEventListener('click', () => this.setPaused(false));
    document.querySelectorAll('[data-close-pause]').forEach((el) =>
      el.addEventListener('click', () => this.setPaused(false)));
  }

  start() {
    if (this.started) { return; }
    this.started = true;
    this.title.classList.add('hidden');
    document.body.classList.add('playing');
    this.game.begin();
  }

  setPaused(p) {
    if (!this.started) { return; }
    this.game.paused = p;
    this.pause.classList.toggle('hidden', !p);
    this.game.registry.emit(p ? 'pause' : 'resume', null);
  }

  /** Full-screen breach animation, then navigate. */
  breach(target, done) {
    this.transTitle.textContent = target.label;
    this.transSub.textContent = 'breaching…';
    this.transition.classList.add('show');
    setTimeout(() => {
      this.transSub.textContent = 'entering';
      done();
    }, 1150);
  }
}
