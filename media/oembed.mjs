for (const id of process.argv.slice(2)) {
  try {
    const r = await fetch(`https://embed.gettyimages.com/oembed?url=${encodeURIComponent(`https://gty.im/${id}`)}`);
    if (!r.ok) { console.log('OE', id, 'HTTP', r.status); continue; }
    const d = await r.json(); const html = d.html || '';
    const et = html.match(/id:'([^']+)'/)?.[1], sig = html.match(/sig:'([^']+)'/)?.[1];
    const w = +(html.match(/w:'(\d+)px'/)?.[1] || 0), h = +(html.match(/h:'(\d+)px'/)?.[1] || 0);
    console.log('OE', JSON.stringify({ id, et, sig, w, h, t: (d.title || '').slice(0, 70) }));
  } catch (e) { console.log('OE', id, 'ERR', e.message); }
}
