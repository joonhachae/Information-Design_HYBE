// Boot controller — mounts the SAME orbital app on every viewport.
//   The app (app.jsx) detects portrait/phone widths itself and rotates the
//   constellation into a vertical arrangement; it is NOT a separate layout.
//   This keeps the orbit, the landing motion, the focus-zoom and every
//   interaction identical between desktop and mobile — only the canvas
//   orientation (and a little chrome) adapts.
(function () {
  const mq = window.matchMedia("(max-width: 760px)");
  const root = ReactDOM.createRoot(document.getElementById("root"));
  document.body.classList.toggle("is-mobile", mq.matches);

  root.render(React.createElement(window.OrbitalApp));

  // Keep the body flag in sync so CSS that keys off `.is-mobile` follows
  // a rotate / resize. The app itself re-renders on the same breakpoint.
  const sync = () => document.body.classList.toggle("is-mobile", mq.matches);
  if (mq.addEventListener) mq.addEventListener("change", sync);
  else if (mq.addListener) mq.addListener(sync);
})();
