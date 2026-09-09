(function () {
  const el = document.getElementById('about-body');
  ABOUT_PARAGRAPHS.forEach(text => {
    const p = document.createElement('p');
    p.textContent = text;
    el.appendChild(p);
  });
})();
