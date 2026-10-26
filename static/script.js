const receiver = document.getElementById('receiver');

if (receiver) {
  const player = document.getElementById('player');
  const playBtn = document.getElementById('play');
  const volume = document.getElementById('volume');
  const vu = document.getElementById('vu');
  const needle = document.getElementById('needle');
  const lcdChannel = document.getElementById('lcd-channel');
  const lcdStation = document.getElementById('lcd-station');
  const lcdTrack = document.getElementById('lcd-track');
  const lcdListeners = document.getElementById('lcd-listeners');

  const stations = [...document.querySelectorAll('.station')];
  const BARS = 24;
  let current = -1;
  let status = {};
  let analyser = null;

  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} },
  };

  for (let i = 0; i < BARS; i++) vu.appendChild(document.createElement('span'));
  const bars = [...vu.children];

  stations.forEach((station, i) => {
    station.querySelector('.tune').addEventListener('click', () => {
      if (i === current && !player.paused) {
        player.pause();
      } else {
        tune(i, true);
      }
    });
  });

  function streamUrl(mount) {
    return `https://nigga.pt/${mount}.ogg`;
  }

  function channelLabel(i) {
    return 'CH ' + String(i + 1).padStart(2, '0');
  }

  function tune(i, autoplay) {
    i = (i + stations.length) % stations.length;
    const changed = i !== current;
    current = i;
    const mount = stations[i].dataset.mount;

    stations.forEach((s, j) => s.classList.toggle('active', j === i));
    needle.style.left = `${(i + 0.5) / stations.length * 100}%`;
    lcdChannel.textContent = channelLabel(i);
    lcdStation.textContent = mount.toUpperCase();
    store.set('station', mount);
    renderNowPlaying();

    if (changed) player.src = streamUrl(mount);
    if (autoplay) play();
  }

  function play() {
    if (current < 0) tune(0, false);
    setupAnalyser();
    // live streams: reload so we join "now" instead of resuming a stale buffer
    if (player.paused && player.currentTime > 0) player.src = streamUrl(stations[current].dataset.mount);
    player.play().catch(err => console.error('Playback failed:', err));
  }

  function setupAnalyser() {
    if (analyser || !window.AudioContext) return;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(player);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      player.addEventListener('play', () => ctx.resume());
      requestAnimationFrame(drawVu);
    } catch (err) {
      console.error('VU meter unavailable:', err);
      analyser = null;
      vu.classList.add('fake');
    }
  }

  function drawVu() {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const step = Math.floor(data.length / BARS) || 1;
    bars.forEach((bar, i) => {
      const level = player.paused ? 0 : data[i * step] / 255;
      bar.style.transform = `scaleY(${Math.max(level, 0.04)})`;
    });
    requestAnimationFrame(drawVu);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderNowPlaying() {
    if (current < 0) return;
    const mount = stations[current].dataset.mount;
    const source = status[mount];
    if (!source) {
      lcdTrack.textContent = 'NO SIGNAL';
      lcdListeners.textContent = '';
      return;
    }
    const track = `${source.artist || 'Unknown'} - ${source.title || 'Unknown'}`;
    if (lcdTrack.textContent !== track) {
      const box = lcdTrack.parentElement;
      lcdTrack.textContent = track;
      // only scroll titles that don't fit the display
      box.classList.remove('scroll');
      box.classList.toggle('scroll', lcdTrack.offsetWidth > box.clientWidth);
    }
    lcdListeners.textContent = `${source.listeners || 0}\u{1F3A7}`;

    if (!player.paused) {
      document.title = `${track} | Radio Nigga`;
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: source.title || 'Unknown',
          artist: source.artist || 'Unknown',
          album: `Radio Nigga - ${mount}`,
          artwork: [{ src: '/favicon.png', sizes: '300x300', type: 'image/png' }],
        });
      }
    }
  }

  function updateAllStreams() {
    return fetch('https://nigga.pt/status')
      .then(response => response.json())
      .then(data => {
        const sources = [].concat(data.icestats.source || []);
        let totalListeners = 0;
        status = {};

        stations.forEach(station => {
          const mount = station.dataset.mount;
          const info = document.getElementById(`${mount}-info`);
          const source = sources.find(s => s.listenurl.includes(`/${mount}.ogg`));
          if (!source) {
            info.innerHTML = '';
            return;
          }
          status[mount] = source;
          const listeners = source.listeners || 0;
          totalListeners += listeners;
          info.innerHTML = `
            <p><strong>${escapeHtml(source.artist || 'Unknown')} - ${escapeHtml(source.title || 'Unknown')}</strong></p>
            <p><strong>Listeners:</strong> ${listeners}</p>
          `;
        });

        document.getElementById('total-listeners').innerHTML = `
          <p><strong>Total Listeners:</strong> ${totalListeners}</p>
        `;
        renderNowPlaying();
      })
      .catch(err => console.error('Failed to fetch status:', err));
  }

  player.addEventListener('playing', () => {
    receiver.classList.add('on');
    receiver.classList.remove('loading');
    playBtn.innerHTML = '&#9208;';
    playBtn.setAttribute('aria-label', 'Pause');
    renderNowPlaying();
  });
  player.addEventListener('waiting', () => receiver.classList.add('loading'));
  player.addEventListener('pause', () => {
    receiver.classList.remove('on', 'loading');
    playBtn.innerHTML = '&#9654;';
    playBtn.setAttribute('aria-label', 'Play');
    document.title = 'Radio Nigga';
  });

  playBtn.addEventListener('click', () => (player.paused ? play() : player.pause()));
  document.getElementById('prev').addEventListener('click', () => tune(current - 1, !player.paused));
  document.getElementById('next').addEventListener('click', () => tune(current + 1, !player.paused));

  volume.value = store.get('volume') ?? volume.value;
  player.volume = volume.value;
  volume.addEventListener('input', () => {
    player.volume = volume.value;
    store.set('volume', volume.value);
  });

  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, button, [contenteditable]')) return;
    if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
    if (e.code === 'ArrowRight') tune(current + 1, !player.paused);
    if (e.code === 'ArrowLeft') tune(current - 1, !player.paused);
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', () => player.pause());
    navigator.mediaSession.setActionHandler('nexttrack', () => tune(current + 1, true));
    navigator.mediaSession.setActionHandler('previoustrack', () => tune(current - 1, true));
  }

  const saved = stations.findIndex(s => s.dataset.mount === store.get('station'));
  tune(saved >= 0 ? saved : 0, false);

  updateAllStreams();
  setInterval(updateAllStreams, 3000);
}
