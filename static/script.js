let totalListeners = 0;

function updateStream(mount, elementId, ext = 'ogg') {
  return fetch(`https://nigga.pt/status?mount=/${mount}.${ext}`)
    .then(response => response.json())
    .then(data => {
      let source = Array.isArray(data.icestats.source)
        ? data.icestats.source.find(s => s.listenurl.includes(`${mount}.${ext}`))
        : data.icestats.source;

      if (!source) throw new Error("No source found");

      const listeners = source.listeners || 0;

      totalListeners += listeners;

      const artist = source.artist || 'Unknown';
      const title = source.title || 'Unknown';

      document.getElementById(elementId).innerHTML = `
        <p><strong>${artist} - ${title}</strong></p>
        <p><strong>Listeners:</strong> ${listeners}</p>
      `;
    })
    .catch(err => {
      console.error(`Failed to fetch ${mount} status:`, err);
      document.getElementById(elementId).innerHTML =
        '';
    });
}

function updateAllStreams() {
  totalListeners = 0;

  Promise.all([
    updateStream('chill', 'chill-info'),
    updateStream('party', 'party-info'),
    updateStream('hood', 'hood-info'),
    updateStream('brutal', 'brutal-info'),
    updateStream('doom', 'doom-info'),
    updateStream('alt', 'alt-info'),
  ]).then(() => {
    document.getElementById('total-listeners').innerHTML = `
      <p><strong>Total Listeners:</strong> ${totalListeners}</p>
    `;
  });
}

updateAllStreams();
setInterval(updateAllStreams, 3000);
